/*
===============================================================================
PROJETO.............: ÓLEO AMIGO
BANCO DE DADOS......: PostgreSQL
SCRIPT..............: 03 - Índices

DESCRIÇÃO
-------------------------------------------------------------------------------
Este script cria os índices recomendados para o banco, com base nas FKs sem
cobertura automática, nos padrões de consulta esperados da aplicação e na
divisão de responsabilidades entre PostgreSQL (fonte de verdade) e Redis
(ranking via ZSET).

Não duplica nenhum índice já criado automaticamente pelo PostgreSQL através
de PRIMARY KEY ou UNIQUE.

Recomenda-se avaliar o uso de CREATE INDEX CONCURRENTLY em produção, para
evitar bloqueio de escrita durante a criação (não pode ser usado dentro de
uma transação).

===============================================================================
*/

-- ============================================================================
-- OBRIGATÓRIOS
-- ============================================================================

-- telephone: telefones de um usuário (tela de perfil, JOIN users -> telephone)
CREATE INDEX idx_telephone_user
ON telephone (user_id);

-- establishment: listagem/filtro de estabelecimentos por tipo (ex.: categorias no app)
CREATE INDEX idx_establishment_type
ON establishment (type_id);

-- collection_request: solicitações de coleta de um estabelecimento específico
CREATE INDEX idx_collection_request_establishment
ON collection_request (establishment_id);

-- collection: histórico de coletas de um motorista, ordenado por data
CREATE INDEX idx_collection_driver_date
ON collection (driver_id, collection_date DESC);

-- delivery_pev: histórico de entregas de um cidadão, ordenado por data
-- (também é a base para auditoria/recomputo de citizens.points)
CREATE INDEX idx_delivery_pev_citizen_date
ON delivery_pev (citizen_id, delivery_date DESC);

-- delivery_pev: entregas realizadas em um PEV específico, ordenadas por data
CREATE INDEX idx_delivery_pev_pev_date
ON delivery_pev (pev_id, delivery_date DESC);

-- certificate: certificados de um estabelecimento (tela de perfil do estabelecimento)
CREATE INDEX idx_certificate_establishment
ON certificate (establishment_id);


-- ============================================================================
-- RECOMENDADOS
-- ============================================================================

-- certificate: estabelecimentos que possuem certificado em determinado nível
CREATE INDEX idx_certificate_level
ON certificate (certificate_level_id);

-- pev: fila de aprovação (painel administrativo) — índice parcial, só cobre
-- o subconjunto de linhas realmente consultado com frequência
CREATE INDEX idx_pev_status_pending
ON pev (status)
WHERE status = 'PENDING';

-- collection_request: fila de aprovação (painel administrativo) — índice parcial
CREATE INDEX idx_collection_request_status_pending
ON collection_request (status)
WHERE status = 'PENDING';


-- ============================================================================
-- OPCIONAIS (avaliar com dados reais de uso antes de criar)
-- ============================================================================

-- driver: só compensa se a frota crescer muito e houver filtro frequente
-- por motoristas ativos na tela de alocação de coletas.
-- CREATE INDEX idx_driver_status_active
-- ON driver (status)
-- WHERE status = 'ACTIVE';

-- pev / collection_request: útil somente se existir tela de auditoria
-- "o que este admin aprovou/rejeitou".
-- CREATE INDEX idx_pev_approved_by ON pev (approved_by);
-- CREATE INDEX idx_collection_request_approved_by ON collection_request (approved_by);