# Databricks notebook source
# MAGIC %md
# MAGIC # Gold — Silver → métricas e KPIs com pandas
# MAGIC Execute **silver_note → gold_note** depois do refresh da bronze `dm`.
# MAGIC Origem padrão: `silver.olius`; destino: **`gold.olius`**. Configure os widgets
# MAGIC para seus catálogos. Spark somente transporta/persiste dados e executa DDL;
# MAGIC joins, filtros, calendários, estatísticas e KPIs são calculados em **pandas**.
# MAGIC Este notebook é independente de arquivos auxiliares e pronto para futura migração.
# MAGIC
# MAGIC **Definições:** coleta B2B é uma visita vigente, inclusive malsucesso/zero litros;
# MAGIC B2C é uma entrega recebida em PEV, não uma retirada física do PEV. Litros dos
# MAGIC dois fluxos permanecem separados para evitar dupla contagem de óleo.
# MAGIC “DP” é desvio padrão populacional (`ddof=0`); amostral (`ddof=1`) é outro campo.
# MAGIC Desvio médio = média de `|x − média|`. Grupos sem observações têm estatísticas
# MAGIC NULL; DP amostral com uma observação é NULL. Pontos ausentes não viram zero.
# MAGIC
# MAGIC As médias por B2B/PEV são calculadas sobre o **total mensal por participante**,
# MAGIC incluindo participantes com zero eventos. Há também estatísticas por evento,
# MAGIC cidadão e motorista. O universo de participantes é o cadastro atual das
# MAGIC dimensões; o dm não tem histórico de ativação para reconstruir cada mês.
# MAGIC O ranking oficial é preservado: soma de pontos nominais não reproduz o piso
# MAGIC sequencial nem a ordem operacional e não é usada para recalcular esse ranking.
# MAGIC
# MAGIC Pendentes = `PENDING`; agendadas hoje e restantes = `APPROVED` sem coleta vigente.
# MAGIC Restantes considera datas de hoje até o fim do mês; atrasos anteriores são outro
# MAGIC KPI. Datas são avaliadas em `America/Sao_Paulo`. A agenda usa o estado atual da
# MAGIC silver, mesmo com `reference_date` passado; não reconstrói estados históricos.
# MAGIC Séries mostram todos os meses do calendário e marcam meses futuros; filtre
# MAGIC `periodo_futuro=false` nos gráficos. Variação sem base anterior ou base zero é NULL.
# MAGIC Motivos de falha são N:N: uma visita pode aparecer em mais de um motivo.
# MAGIC
# MAGIC **Saídas:** `kpis`, `serie_diaria`, `serie_mensal`, `serie_anual`,
# MAGIC `participantes_mensais`, `estatisticas_eventos`, `estatisticas_participantes`,
# MAGIC `estatisticas_solicitacoes`, `solicitacoes_mensais`, `agenda_coletas`,
# MAGIC `motivos_falha_mensais`, `classificacoes_mensais`, `geografia_mensal`,
# MAGIC `tipos_estabelecimento_mensais`, `detalhe_b2b`, `detalhe_b2c`,
# MAGIC `detalhe_solicitacoes`, `ranking_anual`, `qualidade_silver`, `catalogo_metricas`.
# MAGIC Consulte `gold.olius.<tabela>` para dashboards. `_dados_*` são tabelas físicas
# MAGIC versionadas; `pipeline_state` aponta a publicação completa. O Job deve ter
# MAGIC concorrência máxima 1. Nenhuma migração de repositórios é feita aqui.
# MAGIC
# MAGIC Referências: [pandas no Databricks](https://docs.databricks.com/aws/en/pandas),
# MAGIC [tabelas no Unity Catalog](https://docs.databricks.com/aws/en/pyspark/basics).

# COMMAND ----------
import json
import uuid

import numpy as np
import pandas as pd

TIMEZONE = 'America/Sao_Paulo'
SILVER_TABLES = ['dim_estabelecimento', 'dim_cidadao', 'dim_motorista', 'dim_pev',
    'dim_classificacao_coleta', 'dim_status_solicitacao', 'dim_motivo_falha', 'dim_tempo',
    'fato_coleta', 'fato_entrega_pev', 'fato_solicitacao', 'ponte_coleta_motivo',
    'ranking_anual', 'qualidade_dados']
STAT_FIELDS = ['n', 'nulos', 'total', 'media', 'mediana', 'desvio_padrao', 'variancia',
    'desvio_medio', 'desvio_padrao_amostral', 'variancia_amostral', 'minimo', 'maximo',
    'percentil_25', 'percentil_75', 'amplitude', 'coeficiente_variacao_pct']


def describe(values):
    values = pd.to_numeric(values, errors='raise')
    clean = values.dropna().astype(float)
    result = {field: np.nan for field in STAT_FIELDS}
    result.update(n=len(clean), nulos=int(values.isna().sum()))
    if clean.empty:
        return result
    mean = clean.mean()
    result.update(total=clean.sum(), media=mean, mediana=clean.median(),
        desvio_padrao=clean.std(ddof=0), variancia=clean.var(ddof=0),
        desvio_medio=(clean - mean).abs().mean(),
        desvio_padrao_amostral=clean.std(ddof=1), variancia_amostral=clean.var(ddof=1),
        minimo=clean.min(), maximo=clean.max(), percentil_25=clean.quantile(.25),
        percentil_75=clean.quantile(.75), amplitude=clean.max() - clean.min(),
        coeficiente_variacao_pct=clean.std(ddof=0) / abs(mean) * 100 if mean else np.nan)
    return result


def statistics_table(frame, groups, metrics):
    rows = []
    for group, block in frame.groupby(groups, dropna=False, sort=True):
        group = group if isinstance(group, tuple) else (group,)
        for metric in metrics:
            rows.append(dict(zip(groups, group), metrica=metric, **describe(block[metric])))
    return pd.DataFrame(rows, columns=groups + ['metrica'] + STAT_FIELDS)


def prefixed(frame, key, prefix):
    return frame.rename(columns={name: prefix + name for name in frame if name != key})


def dated(frame):
    result = frame.copy()
    result['data_id'] = pd.to_datetime(result['data_id']).dt.normalize()
    result['ano'] = result['data_id'].dt.year
    result['mes'] = result['data_id'].dt.month
    result['periodo'] = result['data_id'].dt.strftime('%Y-%m')
    return result


def event_rollup(frame, groups):
    return frame.groupby(groups, dropna=False).agg(
        quantidade_eventos=('evento_id', 'size'), litros=('litros', 'sum'),
        pontos_nominais_disponiveis=('pontos_nominais', lambda s: s.sum(min_count=1)),
        eventos_sem_calculo=('pontos_nominais', lambda s: s.isna().sum()),
        sucessos=('sucesso', 'sum'), insucessos=('insucesso', 'sum')).reset_index()


def calculate_gold(silver, reference_date=None, max_output_rows=2000000):
    reference = pd.Timestamp(reference_date or pd.Timestamp.now(tz=TIMEZONE).date()).normalize()
    tables = {name: frame.copy() for name, frame in silver.items()}
    for name in ('fato_coleta', 'fato_entrega_pev', 'fato_solicitacao', 'dim_tempo'):
        tables[name]['data_id'] = pd.to_datetime(tables[name]['data_id']).dt.normalize()
    r = tables['fato_solicitacao']
    for field in ('solicitada_em', 'agendada_em', 'chegada_em', 'coletada_em', 'cancelada_em'):
        r[field] = pd.to_datetime(r[field], utc=True, errors='raise')
    c = tables['fato_coleta'].loc[tables['fato_coleta']['data_id'] <= reference].copy()
    d = tables['fato_entrega_pev'].loc[tables['fato_entrega_pev']['data_id'] <= reference].copy()

    # Relacionamentos com validate impedem multiplicar litros e contagens em joins.
    b2b = c.merge(tables['dim_classificacao_coleta'], on='classificacao_id', validate='many_to_one')
    b2b = b2b.merge(prefixed(tables['dim_estabelecimento'], 'estabelecimento_id', 'est_'),
                    on='estabelecimento_id', validate='many_to_one')
    b2b = b2b.merge(prefixed(tables['dim_motorista'], 'motorista_id', 'motorista_'),
                    on='motorista_id', validate='many_to_one')
    b2b = b2b.merge(prefixed(r, 'solicitacao_id', 'pedido_'), on='solicitacao_id', validate='one_to_one')
    b2b = dated(b2b)
    b2b['perfil'] = 'B2B'
    b2b['desvio_volume_litros'] = b2b['volume_coletado_litros'] - b2b['volume_estimado_litros']
    b2b['desvio_volume_pct'] = b2b['desvio_volume_litros'] / b2b['volume_estimado_litros'].replace(0, np.nan) * 100
    b2b['sucesso'] = b2b['resultado'].eq('SUCCESSFUL')
    b2b['insucesso'] = b2b['resultado'].eq('UNSUCCESSFUL')

    b2c = d.merge(prefixed(tables['dim_cidadao'], 'cidadao_id', 'cidadao_'), on='cidadao_id', validate='many_to_one')
    b2c = b2c.merge(prefixed(tables['dim_pev'], 'pev_id', 'pev_'), on='pev_id', validate='many_to_one')
    b2c = dated(b2c)
    b2c['perfil'] = 'B2C'
    requests = dated(r.merge(prefixed(tables['dim_estabelecimento'], 'estabelecimento_id', 'est_'),
                             on='estabelecimento_id', validate='many_to_one'))
    for field in ('solicitada_em', 'agendada_em', 'chegada_em', 'coletada_em', 'cancelada_em'):
        requests[field + '_data_local'] = requests[field].dt.tz_convert(TIMEZONE).dt.tz_localize(None).dt.normalize()
    requests['desvio_chegada_absoluto_minutos'] = requests['desvio_chegada_minutos'].abs()
    requests['atendida'] = requests['coletada_em'].notna()
    requests['aguardando_coleta'] = requests['status_id'].isin(['PENDING', 'APPROVED']) & ~requests['atendida']

    event_columns = ['evento_id', 'data_id', 'ano', 'mes', 'periodo', 'perfil', 'litros', 'pontos_nominais',
                     'sucesso', 'insucesso', 'estado', 'cidade', 'bairro']
    b_events = b2b.rename(columns={'coleta_id': 'evento_id', 'volume_coletado_litros': 'litros',
                                  'est_estado': 'estado', 'est_cidade': 'cidade', 'est_bairro': 'bairro'})
    d_events = b2c.rename(columns={'entrega_id': 'evento_id', 'volume_entregue_litros': 'litros',
                                  'pev_estado': 'estado', 'pev_cidade': 'cidade', 'pev_bairro': 'bairro'}).copy()
    # Entrega não possui classificação de sucesso/falha B2B; somas não são taxa B2C.
    d_events['sucesso'], d_events['insucesso'] = False, False
    events = pd.concat([b_events[event_columns], d_events[event_columns]], ignore_index=True)
    calendar = dated(tables['dim_tempo'])
    if calendar.empty:
        raise ValueError('Silver sem calendário válido')
    start = min(calendar['data_id'].min(), reference.replace(month=1, day=1))
    end = max(calendar['data_id'].max(), reference.replace(month=12, day=31))
    months = pd.date_range(start.replace(day=1), end.replace(day=1), freq='MS').strftime('%Y-%m').tolist()
    observed_months = [m for m in months if m <= reference.strftime('%Y-%m')]

    monthly = event_rollup(events, ['periodo', 'perfil'])
    month_index = pd.MultiIndex.from_product([months, ['B2B', 'B2C']], names=['periodo', 'perfil'])
    monthly = monthly.set_index(['periodo', 'perfil']).reindex(month_index).reset_index()
    for field in ('quantidade_eventos', 'litros', 'eventos_sem_calculo', 'sucessos', 'insucessos'):
        monthly[field] = monthly[field].fillna(0)
    monthly.loc[monthly['quantidade_eventos'].eq(0), 'pontos_nominais_disponiveis'] = 0
    monthly['ano'] = monthly['periodo'].str[:4].astype(int)
    monthly['mes'] = monthly['periodo'].str[5:].astype(int)
    monthly['periodo_futuro'] = monthly['periodo'] > reference.strftime('%Y-%m')
    monthly = monthly.sort_values(['perfil', 'periodo']).reset_index(drop=True)
    monthly['litros_mes_anterior'] = monthly.groupby('perfil')['litros'].shift()
    monthly['variacao_litros'] = monthly['litros'] - monthly['litros_mes_anterior']
    monthly['variacao_litros_pct'] = monthly['variacao_litros'] / monthly['litros_mes_anterior'].replace(0, np.nan) * 100
    monthly['eventos_mes_anterior'] = monthly.groupby('perfil')['quantidade_eventos'].shift()
    monthly['variacao_eventos_pct'] = ((monthly['quantidade_eventos'] - monthly['eventos_mes_anterior'])
                                      / monthly['eventos_mes_anterior'].replace(0, np.nan) * 100)
    monthly.loc[monthly['periodo_futuro'], ['variacao_litros', 'variacao_litros_pct', 'variacao_eventos_pct']] = np.nan
    monthly['litros_acumulados_ano'] = monthly.groupby(['perfil', 'ano'])['litros'].cumsum()
    monthly['eventos_acumulados_ano'] = monthly.groupby(['perfil', 'ano'])['quantidade_eventos'].cumsum()
    monthly['taxa_sucesso_b2b_pct'] = (monthly['sucessos'] / monthly['quantidade_eventos'].replace(0, np.nan) * 100).where(monthly['perfil'].eq('B2B'))
    daily = event_rollup(events, ['data_id', 'perfil'])
    day_index = pd.MultiIndex.from_product([pd.date_range(start, reference), ['B2B', 'B2C']], names=['data_id', 'perfil'])
    daily = daily.set_index(['data_id', 'perfil']).reindex(day_index).reset_index()
    for field in ('quantidade_eventos', 'litros', 'eventos_sem_calculo', 'sucessos', 'insucessos'):
        daily[field] = daily[field].fillna(0)
    daily.loc[daily['quantidade_eventos'].eq(0), 'pontos_nominais_disponiveis'] = 0
    annual = monthly.loc[~monthly['periodo_futuro']].groupby(['ano', 'perfil']).agg(
        quantidade_eventos=('quantidade_eventos', 'sum'), litros=('litros', 'sum'),
        pontos_nominais_disponiveis=('pontos_nominais_disponiveis', lambda s: s.sum(min_count=1)),
        eventos_sem_calculo=('eventos_sem_calculo', 'sum'), sucessos=('sucessos', 'sum'), insucessos=('insucessos', 'sum')).reset_index()

    participants = []
    participant_inputs = [
        ('B2B', 'B2B', tables['dim_estabelecimento'], 'estabelecimento_id', b_events),
        ('PEV', 'B2C', tables['dim_pev'], 'pev_id', d_events),
        ('CIDADAO', 'B2C', tables['dim_cidadao'], 'cidadao_id', d_events),
        ('MOTORISTA', 'B2B', tables['dim_motorista'], 'motorista_id', b_events),
    ]
    required_grid = sum(len(dim) * len(observed_months) for _, _, dim, _, _ in participant_inputs)
    if required_grid > max_output_rows:
        raise MemoryError('Grade participante × mês excede max_output_rows; nenhuma publicação foi feita')
    for kind, profile, dimension, key, source in participant_inputs:
        totals = event_rollup(source, ['periodo', key])
        index = pd.MultiIndex.from_product([observed_months, dimension[key]], names=['periodo', key])
        totals = totals.set_index(['periodo', key]).reindex(index).reset_index().rename(columns={key: 'participante_id'})
        for field in ('quantidade_eventos', 'litros', 'eventos_sem_calculo', 'sucessos', 'insucessos'):
            totals[field] = totals[field].fillna(0)
        totals.loc[totals['quantidade_eventos'].eq(0), 'pontos_nominais_disponiveis'] = 0
        totals['tipo_participante'], totals['perfil'] = kind, profile
        totals['ano'] = totals['periodo'].str[:4].astype(int)
        totals['mes'] = totals['periodo'].str[5:].astype(int)
        participants.append(totals)
    participants = pd.concat(participants, ignore_index=True)
    participant_stats = statistics_table(participants, ['periodo', 'perfil', 'tipo_participante'], ['litros', 'quantidade_eventos', 'pontos_nominais_disponiveis'])

    event_stats = []
    for level, group_columns in [('MES', ['periodo', 'perfil']), ('ANO', ['ano', 'perfil']), ('HISTORICO', ['perfil'])]:
        block = statistics_table(events, group_columns, ['litros', 'pontos_nominais'])
        block['granularidade'] = level
        if 'periodo' not in block:
            block['periodo'] = block['ano'].astype(str) if 'ano' in block else 'HISTORICO'
        event_stats.append(block.drop(columns='ano', errors='ignore'))
    event_stats = pd.concat(event_stats, ignore_index=True)
    # Volumes apresentados/estimados e desvios só existem no fluxo B2B.
    extra = statistics_table(b2b, ['periodo', 'perfil'],
        ['volume_coletado_litros', 'volume_apresentado_litros', 'volume_estimado_litros', 'desvio_volume_litros', 'desvio_volume_pct'])
    extra['granularidade'] = 'MES'
    event_stats = pd.concat([event_stats, extra], ignore_index=True)
    request_metrics = ['volume_estimado_litros', 'volume_franquia_perdida_litros', 'vagas_perdidas',
        'quantidade_reagendamentos', 'tempo_ate_coleta_horas', 'desvio_chegada_minutos', 'desvio_chegada_absoluto_minutos']
    request_stats = statistics_table(requests, ['periodo', 'status_id'], request_metrics)

    request_summary = requests.groupby(['periodo', 'status_id'], dropna=False).agg(
        quantidade_solicitacoes=('solicitacao_id', 'size'), estimativa_litros=('volume_estimado_litros', 'sum'),
        franquia_perdida_litros=('volume_franquia_perdida_litros', 'sum'), vagas_perdidas=('vagas_perdidas', 'sum'),
        reagendamentos=('quantidade_reagendamentos', 'sum'), atendidas=('atendida', 'sum'),
        tempo_medio_ate_coleta_horas=('tempo_ate_coleta_horas', 'mean'),
        desvio_medio_chegada_minutos=('desvio_chegada_minutos', 'mean')).reset_index()
    request_summary['participacao_status_pct'] = (request_summary['quantidade_solicitacoes']
        / request_summary.groupby('periodo')['quantidade_solicitacoes'].transform('sum').replace(0, np.nan) * 100)
    agenda = requests.loc[requests['aguardando_coleta']].copy()
    agenda['situacao_agenda'] = np.select([
        agenda['agendada_em'].isna(), agenda['agendada_em_data_local'] < reference,
        agenda['agendada_em_data_local'].eq(reference)], ['SEM_AGENDAMENTO', 'ATRASADA', 'HOJE'], default='FUTURA')
    bridge = tables['ponte_coleta_motivo'].merge(b2b[['coleta_id', 'periodo']], on='coleta_id', validate='many_to_one')
    bridge = bridge.merge(tables['dim_motivo_falha'], on='motivo_id', validate='many_to_one')
    reasons = bridge.groupby(['periodo', 'motivo_id', 'codigo', 'nome', 'descricao'], dropna=False).agg(
        quantidade_coletas=('coleta_id', 'nunique')).reset_index()
    classifications = b2b.groupby(['periodo', 'resultado', 'condicao_oleo', 'ocorrencia_comprometedora'], dropna=False).agg(
        quantidade_coletas=('coleta_id', 'size'), litros=('volume_coletado_litros', 'sum')).reset_index()
    geography = event_rollup(events, ['periodo', 'perfil', 'estado', 'cidade', 'bairro'])
    establishment_types = b2b.groupby(['periodo', 'est_tipo_estabelecimento'], dropna=False).agg(
        quantidade_coletas=('coleta_id', 'size'), litros=('volume_coletado_litros', 'sum'),
        estabelecimentos_com_movimento=('estabelecimento_id', 'nunique')).reset_index()

    # Cards: todas as medidas com unidade, denominador e data de referência.
    kpis = []

    def card(name, value, unit, definition, profile='B2B'):
        kpis.append(dict(metrica=name, perfil=profile, valor=value, unidade=unit,
                         definicao=definition, data_referencia=reference))

    approved = requests['status_id'].eq('APPROVED') & requests['coletada_em'].isna() & requests['agendada_em'].notna()
    scheduled_day = requests['agendada_em_data_local']
    month_end = reference + pd.offsets.MonthEnd(0)
    card('solicitacoes_pendentes', requests['status_id'].eq('PENDING').sum(), 'solicitacoes', 'Status PENDING no snapshot atual')
    card('coletas_agendadas_hoje', (approved & scheduled_day.eq(reference)).sum(), 'coletas', 'APPROVED, sem coleta, data agendada igual a hoje')
    card('coletas_restantes_mes', (approved & scheduled_day.between(reference, month_end)).sum(), 'coletas', 'Datas de hoje até o fim do mês; não é franquia restante')
    card('coletas_atrasadas', (approved & (scheduled_day < reference)).sum(), 'coletas', 'Agenda anterior a hoje, ainda sem coleta')
    current_period = reference.strftime('%Y-%m')
    for profile, source in [('B2B', b2b), ('B2C', b2c)]:
        volume = 'volume_coletado_litros' if profile == 'B2B' else 'volume_entregue_litros'
        in_month = source['periodo'].eq(current_period)
        in_year = source['ano'].eq(reference.year)
        for suffix, mask in [('mes', in_month), ('ano', in_year)]:
            card('coletas_' + suffix if profile == 'B2B' else 'entregas_pev_' + suffix,
                 mask.sum(), 'eventos', 'Visitas B2B / entregas B2C vigentes pela data física', profile)
            card('litros_' + suffix, source.loc[mask, volume].sum(), 'litros', 'Volume físico do perfil, sem somar os dois fluxos', profile)
        card('eventos_sem_calculo', source['pontos_nominais'].isna().sum(), 'eventos', 'Pontos nominais indisponíveis; não substituídos por zero', profile)
    for kind, profile in [('B2B', 'B2B'), ('PEV', 'B2C')]:
        block = participants.loc[participants['periodo'].eq(current_period) & participants['tipo_participante'].eq(kind)]
        for metric in ('litros', 'quantidade_eventos'):
            stats = describe(block[metric])
            for measure in ('media', 'mediana', 'desvio_padrao', 'variancia', 'desvio_medio'):
                card(f'{measure}_{metric}_por_{kind.lower()}', stats[measure], 'litros' if metric == 'litros' else 'eventos',
                     'Totais mensais por participante da dimensão atual, incluindo zeros', profile)
    month_b2b = b2b.loc[b2b['periodo'].eq(current_period)]
    card('taxa_sucesso_mes', month_b2b['sucesso'].mean() * 100 if len(month_b2b) else np.nan,
         'percentual', 'Visitas SUCCESSFUL / todas as visitas B2B do mês × 100')
    card('tempo_medio_ate_coleta_horas', requests['tempo_ate_coleta_horas'].mean(), 'horas', 'Média entre solicitações com coleta e tempo disponível')
    quality = tables['qualidade_dados']
    card('linhas_rejeitadas_silver', quality['linhas_rejeitadas'].sum(), 'linhas', 'Exclui duplicatas idênticas contabilizadas separadamente', 'QUALIDADE')
    card('duplicatas_removidas_silver', quality['duplicadas_identicas'].sum(), 'linhas', 'Cópias idênticas removidas na silver', 'QUALIDADE')
    cards = pd.DataFrame(kpis)
    catalog = cards[['metrica', 'perfil', 'unidade', 'definicao']].drop_duplicates().reset_index(drop=True)

    outputs = dict(detalhe_b2b=b2b, detalhe_b2c=b2c, detalhe_solicitacoes=requests,
        serie_diaria=daily, serie_mensal=monthly, serie_anual=annual,
        participantes_mensais=participants, estatisticas_eventos=event_stats,
        estatisticas_participantes=participant_stats, estatisticas_solicitacoes=request_stats,
        solicitacoes_mensais=request_summary, agenda_coletas=agenda,
        motivos_falha_mensais=reasons, classificacoes_mensais=classifications,
        geografia_mensal=geography, tipos_estabelecimento_mensais=establishment_types,
        kpis=cards, ranking_anual=tables['ranking_anual'], qualidade_silver=quality, catalogo_metricas=catalog)
    # Invariantes de reconciliação, sem somar B2B com B2C.
    for profile in ('B2B', 'B2C'):
        expected = events.loc[events['perfil'].eq(profile)]
        actual = monthly.loc[monthly['perfil'].eq(profile)]
        if int(actual['quantidade_eventos'].sum()) != len(expected) or not np.isclose(actual['litros'].sum(), expected['litros'].sum()):
            raise AssertionError('Reconciliação mensal falhou para ' + profile)
    if any(len(frame) > max_output_rows for frame in outputs.values()):
        raise MemoryError('Uma saída gold excedeu max_output_rows; publicação interrompida')
    return outputs

# COMMAND ----------
# Ponte de persistência autocontida: este notebook pode migrar sozinho.
def quoted(value):
    if not value or '\x00' in value:
        raise ValueError('Nome de objeto inválido')
    return '`' + value.replace('`', '``') + '`'


def full_name(catalog, schema, table):
    return '.'.join(quoted(value) for value in (catalog, schema, table))


def gold_schema(frame):
    # Números são DOUBLE na camada agregada, inclusive contagens. A silver mantém
    # LONG para identidades numéricas/contadores; UUIDs permanecem STRING em ambas.
    numeric_names = set(STAT_FIELDS + ['valor', 'pontos_nominais', 'pontos_anuais', 'posicao', 'ano', 'mes',
        'linhas_bronze', 'linhas_silver', 'duplicadas_identicas', 'linhas_rejeitadas', 'percentual_aproveitamento'])
    numeric_prefixes = ('volume_', 'quantidade_', 'tempo_', 'desvio_', 'vagas_', 'pontos_',
        'litros', 'eventos_', 'variacao_', 'taxa_', 'franquia_', 'estimativa_', 'reagendamentos',
        'atendidas', 'sucessos', 'insucessos', 'estabelecimentos_com_', 'participacao_')
    specs = {}
    for name, dtype in frame.dtypes.items():
        base_name = name.removeprefix('pedido_')
        if pd.api.types.is_bool_dtype(dtype) or name in ('periodo_futuro', 'sucesso', 'insucesso', 'atendida', 'aguardando_coleta'):
            kind = 'BOOLEAN'
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            kind = 'TIMESTAMP'
        elif pd.api.types.is_numeric_dtype(dtype) or base_name in numeric_names or base_name.startswith(numeric_prefixes):
            kind = 'DOUBLE'
        else:
            kind = 'STRING'
        specs[name] = kind
    return specs


def write_pandas(spark_session, frame, table, schema, mode='append'):
    def scalar(value, kind):
        if pd.isna(value):
            return None
        if kind == 'DOUBLE':
            return float(value)
        if kind == 'BOOLEAN':
            return bool(value)
        if kind == 'TIMESTAMP':
            value = pd.Timestamp(value)
            if value.tzinfo:
                value = value.tz_convert('UTC').tz_localize(None)
            return value.to_pydatetime()
        return str(value)
    records = [tuple(scalar(value, kind) for value, kind in zip(row, schema.values()))
               for row in frame[list(schema)].itertuples(index=False, name=None)]
    ddl = ', '.join(f'{quoted(name)} {kind}' for name, kind in schema.items())
    writer = spark_session.createDataFrame(records, schema=ddl).write.format('delta').mode(mode)
    if mode == 'overwrite':
        writer = writer.option('overwriteSchema', 'true')
    writer.saveAsTable(table)


def publish_gold(spark_session, catalog, schema, outputs, state):
    spark_session.sql(f'CREATE CATALOG IF NOT EXISTS {quoted(catalog)}')
    spark_session.sql(f'CREATE SCHEMA IF NOT EXISTS {quoted(catalog)}.{quoted(schema)}')
    pointer = full_name(catalog, schema, 'pipeline_state')
    spark_session.sql(f'CREATE TABLE IF NOT EXISTS {pointer} ('
        + ', '.join(f'{quoted(name)} STRING' for name in state) + ') USING DELTA')
    for name, frame in outputs.items():
        schema_types = gold_schema(frame)
        payload = frame.copy()
        payload['_execucao_id'] = state['execucao_id']
        physical = full_name(catalog, schema, '_dados_' + name)
        write_pandas(spark_session, payload, physical, dict(schema_types, _execucao_id='STRING'))
        columns = ', '.join(quoted(field) for field in schema_types)
        spark_session.sql(f'CREATE OR REPLACE VIEW {full_name(catalog, schema, name)} AS '
                          f'SELECT {columns} FROM {physical} WHERE _execucao_id = '
                          f'(SELECT execucao_id FROM {pointer})')
    write_pandas(spark_session, pd.DataFrame([state]), pointer,
                 {name: 'STRING' for name in state}, mode='overwrite')

# COMMAND ----------
def run_gold(spark_session, widgets):
    for name, default in dict(silver_catalog='silver', silver_schema='olius', gold_catalog='gold',
                             gold_schema='olius', reference_date='', max_rows_per_table='200000',
                             max_output_rows='2000000').items():
        widgets.text(name, default)
    source_catalog, source_schema = widgets.get('silver_catalog').strip(), widgets.get('silver_schema').strip()
    target_catalog, target_schema = widgets.get('gold_catalog').strip(), widgets.get('gold_schema').strip()
    if source_catalog == target_catalog:
        raise ValueError('Gold e silver devem usar catálogos diferentes')
    max_rows, max_output_rows = int(widgets.get('max_rows_per_table')), int(widgets.get('max_output_rows'))
    if min(max_rows, max_output_rows) < 1:
        raise ValueError('Limites de linhas devem ser positivos')
    reference = widgets.get('reference_date').strip() or pd.Timestamp.now(tz=TIMEZONE).date().isoformat()
    if pd.Timestamp(reference).strftime('%Y-%m-%d') != reference:
        raise ValueError('reference_date deve usar AAAA-MM-DD')
    spark_session.conf.set('spark.sql.session.timeZone', 'UTC')
    pointer = spark_session.table(full_name(source_catalog, source_schema, 'pipeline_state')).limit(2).toPandas()
    if len(pointer) != 1:
        raise ValueError('Execute silver_note com sucesso antes de gold_note')
    source_state = pointer.iloc[0]
    run_id = str(uuid.UUID(str(source_state['execucao_id'])))
    # O ponteiro é lido uma vez. Cada tabela é filtrada pela mesma execução imutável,
    # mesmo que outra silver seja publicada enquanto gold está lendo.
    tables = {}
    for name in SILVER_TABLES:
        sql = (f'SELECT * FROM {full_name(source_catalog, source_schema, "_dados_" + name)} '
               f"WHERE _execucao_id = '{run_id}' LIMIT {max_rows + 1}")
        tables[name] = spark_session.sql(sql).toPandas().drop(columns='_execucao_id')
        if len(tables[name]) > max_rows:
            raise MemoryError(f'{name}: limite de linhas excedido')
    outputs = calculate_gold(tables, reference, max_output_rows)
    state = dict(execucao_id=str(uuid.uuid4()), execucao_silver=run_id,
        snapshot_bronze=str(source_state['snapshot_bronze']), data_referencia=reference,
        publicada_em=pd.Timestamp.now(tz='UTC').isoformat(), silver_catalog=source_catalog,
        silver_schema=source_schema, versao='1')
    publish_gold(spark_session, target_catalog, target_schema, outputs, state)
    print(json.dumps(dict(state, catalogo=target_catalog, schema=target_schema,
                          tabelas_publicadas=list(outputs)), ensure_ascii=False))
    return outputs['kpis']


if __name__ == '__main__':
    display(run_gold(spark, dbutils.widgets))  # noqa: F821 — ambiente Databricks
