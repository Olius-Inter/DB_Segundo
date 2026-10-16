"""Carga artificial via Docker ou psql local, com confirmação explícita do destino."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import re
import shutil
from decimal import Decimal


def command(args, input_text=None, timeout=180, environment=None):
    options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
    if not args or args[0] not in ("docker", "psql"):
        raise ValueError("Somente comandos Docker e psql são permitidos.")
    executable = shutil.which(args[0])
    if executable is None:
        raise FileNotFoundError(f"Cliente {args[0]} não encontrado no PATH.")
    if environment is not None:
        options["env"] = environment
    result = subprocess.run([executable, *args[1:]], input=input_text, capture_output=True, text=True,
                            encoding="utf-8", timeout=timeout, **options)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:] or result.stdout[-6000:])
    return result.stdout


def validate_plan(plan):
    if not plan.get("name", "").strip():
        raise ValueError("Nome do plano obrigatório.")
    for field in ("monthly_price", "volume_limit_liters"):
        number = Decimal(str(plan[field]))
        if not number.is_finite() or number <= 0 or number != number.quantize(Decimal("0.01")):
            raise ValueError(f"Valor inválido para {field}.")
    if type(plan["collection_limit"]) is not int or plan["collection_limit"] < 1:
        raise ValueError("Limite de coletas deve ser inteiro positivo.")


def load_config(path):
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    plans = value.get("plans", [])
    if len(plans) != 3:
        raise ValueError("Configurar os três planos oficiais em ordem crescente.")
    for plan in plans:
        validate_plan(plan)
    for lower, higher in zip(plans, plans[1:]):
        if any(Decimal(str(higher[f])) <= Decimal(str(lower[f])) for f in
               ("monthly_price", "volume_limit_liters", "collection_limit")):
            raise ValueError("Os upgrades exigem aumento do preço e de ambos os limites.")
    if plans[2]["collection_limit"] < 8 or Decimal(str(plans[2]["volume_limit_liters"])) < 250:
        raise ValueError("A distribuição aprovada exige pelo menos 8 vagas e 250 L no plano superior.")
    if value.get("certificate_levels") != []:
        raise ValueError("As metas oficiais ainda estão pendentes: manter certificate_levels vazio nesta versão.")
    return value


def identifier(value):
    match = re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,62}", value)
    if match is None:
        raise argparse.ArgumentTypeError("Identificador inválido: use letras, números, ponto, hífen ou underscore.")
    return match.group(0)


def hostname(value):
    match = re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{0,252}", value)
    if match is None:
        raise argparse.ArgumentTypeError("Host inválido; informe somente o DNS ou IPv4, sem URL ou credenciais.")
    return match.group(0)


def port_number(value):
    number = int(value)
    if not 1 <= number <= 65535:
        raise argparse.ArgumentTypeError("Porta deve estar entre 1 e 65535.")
    return number


def validate_target(args):
    if args.install_access_control and not args.install:
        raise ValueError("--install-access-control requer --install em uma base vazia.")
    if args.host and not args.development:
        raise ValueError("Conexão direta exige --development e estrutura já instalada.")
    if args.development and (args.install or args.install_access_control):
        raise ValueError("Modo desenvolvimento não permite reinstalar estrutura ou permissões.")
    target = f"{args.host}:{args.port}/{args.database}" if args.host else args.container + "/" + args.database
    if args.development:
        if os.environ.get("OLIUS_DATA_LOAD_DEVELOPMENT_TARGET") != target:
            raise ValueError("Confirme exatamente o destino " + target + " em OLIUS_DATA_LOAD_DEVELOPMENT_TARGET.")
    elif os.environ.get("OLIUS_DATA_LOAD_DISPOSABLE") != "1":
        raise ValueError("Defina OLIUS_DATA_LOAD_DISPOSABLE=1 apenas para um ambiente descartável.")


def connection(args):
    flags = ["-U", args.user, "-d", args.database, "-X", "-w", "-v", "ON_ERROR_STOP=1"]
    if args.container:
        labels = json.loads(command(["docker", "inspect", "--format", "{{json .Config.Labels}}", args.container])) or {}
        if not args.development and labels.get("org.olius.data_load.disposable") != "true":
            raise ValueError("Container sem identificação de ambiente descartável; carga recusada.")
        return ["docker", "exec", "-i", args.container, "psql", *flags], None
    environment = {**os.environ, "PGSSLMODE": args.ssl_mode, "PGCONNECT_TIMEOUT": "10",
                   "PGHOSTADDR": "", "PGSERVICE": "", "PGOPTIONS": ""}
    if args.ssl_root_cert:
        certificate = args.ssl_root_cert.resolve(strict=True)
        if not certificate.is_file():
            raise ValueError("O certificado CA deve ser um arquivo.")
        environment["PGSSLROOTCERT"] = str(certificate)
    return ["psql", "-h", args.host, "-p", str(args.port), *flags], environment


def prepare_files(args, folder, manifest):
    if not args.container:
        for file in sorted(folder.glob("*.sql")):
            manifest["scripts"]["data_load/" + file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
        return folder.as_posix()
    directory = command(["docker", "exec", args.container, "mktemp", "-d", "--", "/var/lib/postgresql/olius-data-load.XXXXXXXXXX"]).strip()
    if re.fullmatch(r"/var/lib/postgresql/olius-data-load\.[A-Za-z0-9]{10}", directory) is None:
        raise ValueError("Docker retornou um diretório temporário inválido.")
    # A limpeza também acontece se uma cópia falhar.
    try:
        for file in sorted(folder.glob("*.sql")):
            command(["docker", "cp", str(file), args.container + ":" + directory + "/" + file.name])
            manifest["scripts"]["data_load/" + file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
    except Exception:
        command(["docker", "exec", args.container, "rm", "-rf", "--", directory])
        raise
    return directory


def install_scripts(args, source, manifest, execute):
    if args.install:
        count = execute("empty-schema", "SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','v','m');").strip()
        if count != "0":
            raise ValueError("Instalação requer schema public vazio; nenhum objeto será apagado.")
        candidates = [p for p in source.glob("04_functions_procedures*.sql") if p.is_file()]
        if len(candidates) != 1:
            raise ValueError("Deve existir exatamente um script principal 04.")
        names = ["01_structure.sql", "02_check_constraints.sql", "03_indexes.sql", candidates[0].name, "05_triggers.sql"]
        for name in names:
            file = source / name
            manifest["scripts"][name] = hashlib.sha256(file.read_bytes()).hexdigest()
            execute(file.stem, file.read_text(encoding="utf-8-sig"))
        # O 06 antigo é uma consulta. Só instalar o par quando houver o 07.
        if (source / "07_window_functions.sql").is_file():
            for name in ("06_ctes.sql", "07_window_functions.sql"):
                file = source / name
                manifest["scripts"][name] = hashlib.sha256(file.read_bytes()).hexdigest()
                execute(file.stem, file.read_text(encoding="utf-8-sig"))
    if args.install_access_control:
        for relative in ("data_catalog/01_structure.sql", "data_catalog/02_check_constraints.sql",
                         "data_catalog/03_view.sql", "data_catalog/04_load.sql",
                         "access_control/01_roles.sql", "access_control/02_users.sql"):
            file = source / relative
            manifest["scripts"][relative] = hashlib.sha256(file.read_bytes()).hexdigest()
            execute(relative.replace("/", "_"), file.read_text(encoding="utf-8-sig"))


def run_stages(temporary_dir, manifest, execute):
    for name in ("01_seed.sql", "02_contracts.sql", "03_journeys.sql", "04_validate.sql"):
        output = execute(name[:-4], path=temporary_dir + "/" + name)
        manifest["completed"].append(name)
        if name == "04_validate.sql":
            rows = [line for line in output.splitlines() if line.strip().startswith("{")]
            # psql tabular sem -At é evitado para o relatório em JSON.
            if rows:
                manifest["result"] = json.loads(rows[-1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--container", type=identifier)
    target.add_argument("--host", type=hostname, help="DNS ou IPv4 para conexão direta usando psql instalado localmente.")
    parser.add_argument("--port", type=port_number, default=5432)
    parser.add_argument("--ssl-mode", choices=("disable", "require", "verify-ca", "verify-full"), default="verify-full")
    parser.add_argument("--ssl-root-cert", type=Path, help="Arquivo CA para validar o certificado do PostgreSQL.")
    parser.add_argument("--database", default="olius_data_load", type=identifier)
    parser.add_argument("--user", default="postgres", type=identifier)
    parser.add_argument("--development", action="store_true", help="Carregar banco de desenvolvimento existente e vazio; exige confirmação do destino por variável de ambiente.")
    parser.add_argument("--source-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("config.json"))
    parser.add_argument("--install", action="store_true", help="Instalar scripts principais em banco vazio.")
    parser.add_argument("--install-access-control", action="store_true", help="Instalar catálogo/papéis e testar jornadas com olius_api.")
    parser.add_argument("--report-dir", type=Path, default=Path(__file__).with_name("reports"))
    args = parser.parse_args()
    args.container = identifier(args.container) if args.container else None
    args.database = identifier(args.database)
    args.user = identifier(args.user)
    validate_target(args)
    config = load_config(args.config)
    psql, environment = connection(args)
    source = args.source_root.resolve()
    report_dir = args.report_dir.resolve()
    report_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"source_root": str(source), "config": config, "scripts": {}, "completed": []}
    manifest["target"] = {"transport": "docker" if args.container else "postgresql",
                          "container": args.container, "host": args.host, "port": args.port if args.host else None,
                          "database": args.database, "user": args.user,
                          "ssl_mode": args.ssl_mode if args.host else None}

    def execute(label, sql=None, path=None):
        parameters = {"environment": environment} if environment is not None else {}
        output = command(psql + (["-qAt", "-f", path] if path else ["-qAt"]), sql, timeout=240, **parameters)
        (report_dir / (label + ".log")).write_text(output, encoding="utf-8")
        print("PASS:", label, flush=True)
        return output

    temporary_dir = None
    try:
        version = execute("version", "SELECT current_setting('server_version');").strip()
        if not version.startswith("16.15"):
            raise ValueError("Validação direcionada ao PostgreSQL 16.15; versão encontrada: " + version)
        manifest["postgresql_version"] = version
        if args.development:
            structure = execute("existing-structure", "SELECT to_regclass('public.users') IS NOT NULL AND to_regclass('public.citizens') IS NOT NULL AND to_regclass('public.establishment') IS NOT NULL AND to_regclass('public.delivery_pev') IS NOT NULL AND to_regclass('public.collection') IS NOT NULL;").strip()
            if structure != "t":
                raise ValueError("Banco de desenvolvimento sem as tabelas principais esperadas; carga recusada.")
        install_scripts(args, source, manifest, execute)
        # Um banco parcialmente carregado também é recusado. Recriar só o container de teste.
        guard = "DO $$ DECLARE t RECORD; n BIGINT; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('data_catalog_table','data_catalog_column','data_catalog_role') LOOP EXECUTE format('SELECT count(*) FROM public.%I',t.tablename) INTO n; IF n<>0 THEN RAISE EXCEPTION 'Tabela % não vazia; carga recusada.',t.tablename; END IF; END LOOP; END $$;"
        execute("empty-data", guard)
        # Em conexão direta, psql lê os includes locais, sem enviar arquivos ao servidor.
        folder = Path(__file__).resolve().parent
        temporary_dir = prepare_files(args, folder, manifest)
        psql.extend(["-v", "load_config=" + json.dumps(config, ensure_ascii=False)])
        has_api = execute("api-role", "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='olius_api');").strip() == "t"
        psql.extend(["-v", "use_api=" + ("true" if has_api else "false")])
        manifest["journeys_role"] = "olius_api" if has_api else args.user
        run_stages(temporary_dir, manifest, execute)
        manifest["status"] = "validated"
    except Exception as exc:
        manifest["status"] = "failed"
        manifest["error"] = str(exc)
        raise
    finally:
        if args.container and temporary_dir and re.fullmatch(r"/var/lib/postgresql/olius-data-load\.[A-Za-z0-9]{10}", temporary_dir):
            try:
                command(["docker", "exec", args.container, "rm", "-rf", "--", temporary_dir])
            except (RuntimeError, subprocess.TimeoutExpired) as cleanup_error:
                manifest["cleanup_error"] = str(cleanup_error)
                print("Falha ao limpar os arquivos temporários:", cleanup_error, file=sys.stderr)
        (report_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Relatório:", report_dir / "manifest.json")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, FileNotFoundError, subprocess.TimeoutExpired) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
