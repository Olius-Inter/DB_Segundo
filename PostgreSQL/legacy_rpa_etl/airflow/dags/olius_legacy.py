"""Manual B2C migration; destination loading requires explicit opt-in configuration."""
import json
import os
import shutil
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path

import pendulum
from airflow.sdk import dag, get_current_context, task
from airflow.sdk.exceptions import AirflowSkipException


@dag(dag_id='olius_legacy_preparation', schedule=None,
     start_date=pendulum.datetime(2026, 11, 1, tz='UTC'), catchup=False,
     max_active_runs=1, max_active_tasks=1, tags=['olius', 'legacy', 'preparation'])
def legacy_preparation():
    @task(retries=1, retry_delay=timedelta(seconds=30), show_return_value_in_logs=False)
    def extract_legacy():
        import psycopg2
        from pipeline import extract, open_stage

        connection = {key: os.environ['OLIUS_LEGACY_' + env] for key, env in
                      [('host', 'HOST'), ('port', 'PORT'), ('dbname', 'DATABASE'),
                       ('user', 'USER'), ('sslrootcert', 'CA')]}
        connection.update(sslmode='verify-full',
                          connect_timeout=15, application_name='olius_airflow_etl',
                          options='-c default_transaction_read_only=on -c statement_timeout=60000')
        context = get_current_context()
        identity = context['dag'].dag_id + '/' + context['run_id']
        run_id = str(uuid.uuid5(uuid.NAMESPACE_URL, identity))
        stage = open_stage(os.environ['OLIUS_STAGE_PATH'])
        try:
            with tempfile.TemporaryDirectory(prefix='olius-passfile-') as folder:
                passfile = os.path.join(folder, 'pgpass.conf')
                shutil.copyfile('/run/secrets/source_pgpass', passfile)
                os.chmod(passfile, 0o600)
                connection['passfile'] = passfile
                return extract(stage, connection['host'] + ':' + connection['port'] + '/' + connection['dbname'],
                               lambda: psycopg2.connect(**connection), run_id=run_id,
                               credential_key=Path('/run/secrets/credential_key').read_bytes().strip())
        except Exception as exc:
            raise RuntimeError('Legacy extraction failed: ' + type(exc).__name__) from None
        finally:
            stage.close()

    @task(show_return_value_in_logs=False)
    def prepare_citizens(batch_id):
        from pipeline import open_stage, prepare, read_cpf_key
        stage = open_stage(os.environ['OLIUS_STAGE_PATH'])
        try:
            key_path = os.environ.get('OLIUS_LEGACY_CPF_KEY_FILE')
            prepare(stage, batch_id, read_cpf_key(key_path) if key_path else None)
            for kind, variable in (('b2b', 'OLIUS_B2B_COMPLEMENT_FILE'),
                                   ('driver', 'OLIUS_DRIVER_COMPLEMENT_FILE')):
                path = os.environ.get(variable)
                if path:
                    from extended import prepare_extended
                    prepare_extended(stage, batch_id, kind, path)
            return batch_id
        except Exception as exc:
            raise RuntimeError('Legacy preparation failed: ' + type(exc).__name__) from None
        finally:
            stage.close()

    @task(show_return_value_in_logs=False)
    def summarize(batch_id):
        from pipeline import open_stage, report
        stage = open_stage(os.environ['OLIUS_STAGE_PATH'])
        try:
            summary = report(stage, batch_id)
            print(json.dumps(summary))
            return batch_id
        finally:
            stage.close()

    @task(show_return_value_in_logs=False)
    def load_citizens(batch_id):
        from connections import destination_connection
        from loader import load
        from pipeline import open_stage
        if os.environ.get('OLIUS_ETL_LOAD_ENABLED') != 'true':
            raise AirflowSkipException('Destination loading disabled; preparation only.')
        stage = open_stage(os.environ['OLIUS_STAGE_PATH'])
        try:
            load(stage, batch_id, Path('/run/secrets/credential_key').read_bytes().strip(),
                 destination_connection, enabled=True)
            if os.environ.get('OLIUS_ETL_EXTENDED_LOAD_ENABLED') == 'true':
                from extended import run_extended
                run_extended(stage, batch_id, destination_connection, enabled=True)
            return batch_id
        except Exception as exc:
            raise RuntimeError('Destination loading failed: ' + type(exc).__name__) from None
        finally:
            stage.close()

    @task(show_return_value_in_logs=False)
    def reconcile_destination(batch_id):
        from connections import destination_connection
        from loader import reconcile
        from pipeline import open_stage, report
        stage = open_stage(os.environ['OLIUS_STAGE_PATH'])
        try:
            reconcile(stage, batch_id, destination_connection)
            if os.environ.get('OLIUS_ETL_EXTENDED_LOAD_ENABLED') == 'true':
                from extended import run_extended
                run_extended(stage, batch_id, destination_connection, enabled=True, reconcile_only=True)
            print(json.dumps(report(stage, batch_id)))
        except Exception as exc:
            raise RuntimeError('Destination reconciliation failed: ' + type(exc).__name__) from None
        finally:
            stage.close()

    @task(trigger_rule='all_done', show_return_value_in_logs=False)
    def archive_history(batch_id=None):
        if os.environ.get('OLIUS_ETL_ARCHIVE_ENABLED') != 'true':
            raise AirflowSkipException('History export disabled; no shared output written.')
        if batch_id is None:
            batch_id = get_current_context()['ti'].xcom_pull(task_ids='extract_legacy')
        if not batch_id:
            raise AirflowSkipException('No prepared snapshot to archive.')
        from archive import export_history
        from pipeline import open_stage
        stage = open_stage(os.environ['OLIUS_STAGE_PATH'])
        try:
            stage.execute('BEGIN')
            if stage.execute('SELECT status FROM runs WHERE id=?', (batch_id,)).fetchone() != ('PREPARED',):
                raise AirflowSkipException('No prepared snapshot to archive.')
            result = export_history(stage, batch_id, int(os.environ.get('OLIUS_ETL_ARCHIVE_VERSION', '1')),
                                    '/run/secrets/archive_key', '/opt/olius-history/private',
                                    '/opt/olius-history/backup', '/opt/olius-history/reports',
                                    os.environ.get('OLIUS_ETL_EVALUATION_DATE') or None)
            print(json.dumps(result))
        except AirflowSkipException:
            raise
        except Exception as exc:
            raise RuntimeError('History export failed: ' + type(exc).__name__) from None
        finally:
            stage.rollback()
            stage.close()

    extracted = extract_legacy()
    prepared = summarize(prepare_citizens(extracted))
    loaded = load_citizens(prepared)
    checked = reconcile_destination(loaded)
    archived = archive_history()
    prepared >> archived
    checked >> archived

    @task(trigger_rule='none_failed')
    def workflow_finished():
        # This final leaf prevents all_done archival from masking upstream failures.
        return None

    finished = workflow_finished()
    loaded >> finished
    checked >> finished
    archived >> finished


legacy_preparation()
