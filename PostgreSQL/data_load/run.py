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

REPORT_ROOT = Path(__file__).resolve().parents[2]


def report_directory(value):
    root = REPORT_ROOT.resolve()
    candidate = value.resolve()
    for relative in ('PostgreSQL/data_load/reports', 'coverage'):
        allowed = root / relative
        if candidate.is_relative_to(allowed):
            candidate.mkdir(parents=True, exist_ok=True)
            return candidate
    raise ValueError("Relatórios devem ficar em PostgreSQL/data_load/reports ou coverage, dentro do projeto.")


def report_file(directory, name):
    if re.fullmatch(r'[A-Za-z0-9_.-]+', name) is None:
        raise ValueError('Nome de relatório inválido.')
    file = directory / name
    if file.is_symlink() or file.resolve().parent != directory:
        raise ValueError('Links simbólicos ou caminhos externos não são aceitos para relatórios.')
    return file


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


def load_config(path):
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict) or set(value) != {"seed"}:
        raise ValueError("Configuração aceita somente seed; catálogos oficiais vêm de initial_data.")
    seed = value["seed"]
    if not isinstance(seed, str) or re.fullmatch(r"[A-Za-z0-9_-]{1,64}", seed) is None:
        raise ValueError("Seed deve conter de 1 a 64 letras, números, hífen ou underscore.")
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


def install_main_scripts(source, manifest, execute):
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
    # A entrega Data Mart deve preceder o controle de acesso que a utiliza.
    file = source / "08_materialized_views.sql"
    if file.is_file():
        manifest["scripts"][file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
        execute(file.stem, file.read_text(encoding="utf-8-sig"))


def install_scripts(args, source, manifest, execute):
    if args.install:
        install_main_scripts(source, manifest, execute)
    if args.install_access_control:
        for relative in ("data_catalog/01_structure.sql", "data_catalog/02_check_constraints.sql",
                         "data_catalog/03_view.sql", "data_catalog/04_load.sql",
                         "access_control/01_roles.sql", "access_control/02_users.sql"):
            file = source / relative
            manifest["scripts"][relative] = hashlib.sha256(file.read_bytes()).hexdigest()
            execute(relative.replace("/", "_"), file.read_text(encoding="utf-8-sig"))


def load_reference_data(source, manifest, execute):
    for name in ("01_reference_data.sql", "02_validate.sql"):
        file = source / "initial_data" / name
        manifest["scripts"]["initial_data/" + name] = hashlib.sha256(file.read_bytes()).hexdigest()
        execute("initial_data_" + file.stem, file.read_text(encoding="utf-8-sig"))
    manifest["reference_data"] = "validated"


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
    report_dir = report_directory(args.report_dir)
    manifest = {"source_root": str(source), "config": config, "scripts": {}, "completed": []}
    manifest["target"] = {"transport": "docker" if args.container else "postgresql",
                          "container": args.container, "host": args.host, "port": args.port if args.host else None,
                          "database": args.database, "user": args.user,
                          "ssl_mode": args.ssl_mode if args.host else None}

    def execute(label, sql=None, path=None):
        parameters = {"environment": environment} if environment is not None else {}
        output = command(psql + (["-qAt", "-f", path] if path else ["-qAt"]), sql, timeout=240, **parameters)
        report_file(report_dir, label + ".log").write_text(output, encoding="utf-8")
        print("PASS:", label, flush=True)
        return output

    temporary_dir = None
    try:
        version = execute("version", "SELECT current_setting('server_version');").strip()
        if not version.startswith("16.15"):
            raise ValueError("Validação direcionada ao PostgreSQL 16.15; versão encontrada: " + version)
        manifest["postgresql_version"] = version
        if args.development:
            structure = execute("existing-structure", "SELECT count(*) = 5 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('users','citizens','establishment','delivery_pev','collection');").strip()
            if structure != "t":
                raise ValueError("Banco de desenvolvimento sem as tabelas principais esperadas; carga recusada.")
        install_scripts(args, source, manifest, execute)
        # Referências oficiais podem existir; operações e seus logs continuam proibidos.
        guard = """DO $$ DECLARE t RECORD; n BIGINT; BEGIN
        FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
            AND tablename NOT IN ('data_catalog_table','data_catalog_column','data_catalog_role',
                'subscription_plan','certificate_level','establishment_type','collection_failure_reason','admin_guard_state',
                'subscription_plan_log','certificate_level_log','collection_failure_reason_log') LOOP
            EXECUTE format('SELECT count(*) FROM public.%I',t.tablename) INTO n;
            IF n<>0 THEN RAISE EXCEPTION 'Tabela % não vazia; carga recusada.',t.tablename; END IF;
        END LOOP;
        FOR t IN SELECT * FROM (VALUES ('subscription_plan'),('certificate_level'),('collection_failure_reason')) r(base) LOOP
            EXECUTE format('SELECT count(*) FROM public.%I l WHERE l.actor_kind IS DISTINCT FROM ''SYSTEM'' OR NOT EXISTS (SELECT 1 FROM public.%I b WHERE b.id=l.id)',
                t.base || '_log',t.base) INTO n;
            IF n<>0 THEN RAISE EXCEPTION 'Histórico de catálogo % incompatível com banco de demonstração.',t.base; END IF;
        END LOOP;
        IF (SELECT count(*) FROM public.admin_guard_state WHERE singleton)<>1 THEN
            RAISE EXCEPTION 'Controle administrativo ausente.';
        END IF;
        END $$;"""
        execute("empty-data", guard)
        load_reference_data(source, manifest, execute)
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
        # O conteúdo do manifesto nunca participa da escolha do caminho.
        manifest_path = report_file(report_dir, "manifest.json")
        with manifest_path.open("w", encoding="utf-8") as manifest_stream:
            json.dump(manifest, manifest_stream, ensure_ascii=False, indent=2)
    print("Relatório:", report_dir / "manifest.json")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, FileNotFoundError, subprocess.TimeoutExpired) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
