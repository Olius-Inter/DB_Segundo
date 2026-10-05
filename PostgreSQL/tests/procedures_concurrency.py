"""Duas sessões reais via psql. Execute somente em banco descartável com 01..05.

Local: OLIUS_TEST_DOCKER_CONTAINER=nome (Docker com usuário postgres/db olius_test).
CI: usa psql e as variáveis PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
Não instala os scripts 01..05. Lê apenas a fixture SQL ao lado deste arquivo
e a envia pelo stdin ao psql; não é necessário copiá-la para o contêiner.
Cria dados artificiais no banco descartável e não escreve arquivos locais.
"""
import os
import subprocess
import time
from pathlib import Path

container = os.environ.get("OLIUS_TEST_DOCKER_CONTAINER")
base = (["docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", os.environ.get("PGDATABASE", "olius_test")]
        if container else ["psql"])
command = base + ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"]
process_options = {"encoding": "utf-8"}
if os.name == "nt":
    process_options["creationflags"] = subprocess.CREATE_NO_WINDOW


def query(sql):
    result = subprocess.run(command, input=sql, text=True, capture_output=True,
                            timeout=30, check=False, **process_options)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def pair(label, first, second, second_should_fail=False, rollback_first=False):
    """A segura locks até receber COMMIT; confirma que B realmente espera lock."""
    a = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, bufsize=1, **process_options)
    b = None
    try:
        a.stdin.write("BEGIN; SET statement_timeout='15s';\n" + first + "\n\\echo READY\n")
        a.stdin.flush()
        # statement_timeout e timeout externo do CI limitam qualquer falha.
        while True:
            line = a.stdout.readline()
            if line.strip() == "READY":
                break
            if not line:
                raise RuntimeError(a.stderr.read())
        b = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, text=True, **process_options)
        b.stdin.write("SET application_name='olius_pr13_session_b'; SET statement_timeout='15s';\n" + second + "\n")
        b.stdin.close()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            waiting = query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='olius_pr13_session_b' AND wait_event_type='Lock');")
            if waiting == "t":
                break
            if b.poll() is not None:
                raise RuntimeError("Sessão B terminou sem esperar o lock: " + b.stderr.read())
            time.sleep(0.05)
        else:
            raise RuntimeError("Não foi observada espera de lock")
        a.stdin.write("ROLLBACK;\n" if rollback_first else "COMMIT;\n")
        a.stdin.close()
        a.wait(timeout=20)
        b.wait(timeout=20)
        error_a, error_b = a.stderr.read(), b.stderr.read()
        if a.returncode or (bool(b.returncode) != second_should_fail):
            raise RuntimeError(error_a + error_b)
        if second_should_fail and "Recarregue" not in error_b:
            raise RuntimeError("Falha inesperada: " + error_b)
        print("PASS:", label, "(espera de lock observada)")
    finally:
        for proc in (a, b):
            if proc is not None and proc.poll() is None:
                proc.kill()
                proc.wait()


fixture_sql = Path(__file__).with_name("fixtures_procedures.sql").read_text(encoding="utf-8")
query(fixture_sql)

query("""
DO $$ DECLARE r UUID; c UUID; d UUID; BEGIN
FOR i IN 1..2 LOOP
    r := olius_test.request();
    CALL record_collection(r,olius_test.id('driver'),10,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],NULL,CURRENT_TIMESTAMP - INTERVAL '1 hour',c);
    INSERT INTO olius_test.ids(name,id) VALUES ('collection' || i,c);
    CALL record_pev_delivery(gen_random_uuid(),olius_test.id('citizen'),olius_test.id('pev'),olius_test.id('validator'),10,CURRENT_TIMESTAMP - INTERVAL '1 hour',d);
    INSERT INTO olius_test.ids(name,id) VALUES ('delivery' || i,d);
END LOOP; END $$;
""")
pair("correções de duas coletas do mesmo estabelecimento",
     "CALL correct_collection(olius_test.id('collection1'),1,olius_test.id('admin'),'RECORDED',9,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],NULL,'Concorrência A');",
     "CALL correct_collection(olius_test.id('collection2'),1,olius_test.id('admin'),'RECORDED',10,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],NULL,'Concorrência B');")
query("SELECT olius_test.assert((SELECT COUNT(*)=2 FROM collection WHERE revision=2),'revisões B2B');")
pair("correções de duas entregas do mesmo cidadão",
     "CALL correct_pev_delivery(olius_test.id('delivery1'),1,olius_test.id('admin'),'RECORDED',5,CURRENT_TIMESTAMP - INTERVAL '2 hours','Concorrência A');",
     "CALL correct_pev_delivery(olius_test.id('delivery2'),1,olius_test.id('admin'),'RECORDED',7,CURRENT_TIMESTAMP - INTERVAL '2 hours','Concorrência B');")
query("SELECT olius_test.assert((SELECT points=12 FROM citizens WHERE id=olius_test.id('citizen')),'saldo B2C concorrente');")
pair("mesma entrega: revisão desatualizada é rejeitada",
     "CALL correct_pev_delivery(olius_test.id('delivery1'),2,olius_test.id('admin'),'RECORDED',6,CURRENT_TIMESTAMP - INTERVAL '2 hours','Concorrência A');",
     "CALL correct_pev_delivery(olius_test.id('delivery1'),2,olius_test.id('admin'),'RECORDED',8,CURRENT_TIMESTAMP - INTERVAL '2 hours','Concorrência B');",
     second_should_fail=True)
pair("mesma coleta: revisão desatualizada é rejeitada",
     "CALL correct_collection(olius_test.id('collection1'),2,olius_test.id('admin'),'RECORDED',10,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],NULL,'Concorrência A');",
     "CALL correct_collection(olius_test.id('collection1'),2,olius_test.id('admin'),'RECORDED',9,10,'ACCEPTABLE',FALSE,ARRAY[]::TEXT[],NULL,'Concorrência B');",
     second_should_fail=True)

delivery_date = query("SELECT CURRENT_TIMESTAMP - INTERVAL '1 hour';")
key = query("SELECT gen_random_uuid();")
delivery_call = ("CALL record_pev_delivery('%s',olius_test.id('citizen'),olius_test.id('pev'),"
                 "olius_test.id('validator'),2,'%s',NULL);") % (key, delivery_date)
pair("mesma chave concorrente não duplica", delivery_call, delivery_call)
query("SELECT olius_test.assert((SELECT COUNT(*)=1 FROM delivery_pev WHERE idempotency_key='%s'),'mesma chave');" % key)
key_a, key_b = query("SELECT gen_random_uuid();"), query("SELECT gen_random_uuid();")
pair("duas novas entregas têm ordens diferentes",
     delivery_call.replace(key, key_a), delivery_call.replace(key, key_b))
query("SELECT olius_test.assert((SELECT COUNT(*)=COUNT(DISTINCT processing_order) FROM delivery_pev WHERE citizen_id=olius_test.id('citizen')),'ordem única');")
before = query("SELECT MAX(processing_order) FROM delivery_pev WHERE citizen_id=olius_test.id('citizen');")
key_a, key_b = query("SELECT gen_random_uuid();"), query("SELECT gen_random_uuid();")
pair("rollback não deixa uma entrega fantasma",
     delivery_call.replace(key, key_a), delivery_call.replace(key, key_b), rollback_first=True)
query("SELECT olius_test.assert(NOT EXISTS(SELECT 1 FROM delivery_pev WHERE idempotency_key='%s') AND (SELECT processing_order=%s+1 FROM delivery_pev WHERE idempotency_key='%s'),'rollback de emissão');" % (key_a, before, key_b))
print("PASS: sete cenários concorrentes concluídos")
