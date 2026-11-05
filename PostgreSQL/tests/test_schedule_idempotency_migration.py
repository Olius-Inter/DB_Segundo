from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2] / "PostgreSQL"


class ScheduleIdempotencyMigrationTests(unittest.TestCase):
    def test_migration_matches_canonical_definitions(self):
        migration = (ROOT / "migrations/20261104_schedule_idempotency.sql").read_text(encoding="utf-8")
        structure = (ROOT / "01_structure.sql").read_text(encoding="utf-8")
        routines = (ROOT / "04_functions_procedures.sql").read_text(encoding="utf-8")
        roles = (ROOT / "access_control/01_roles.sql").read_text(encoding="utf-8")
        blocks = [
            structure[structure.index("-- Guarda a chave"):].strip(),
            routines[routines.index("CREATE PROCEDURE public.schedule_collection_request_once"):
                     routines.rindex("COMMIT;")].strip(),
            "GRANT EXECUTE ON PROCEDURE public.schedule_collection_request_once(UUID,TIMESTAMPTZ,TIMESTAMPTZ,UUID,TEXT,UUID) TO olius_api;",
        ]
        for block in blocks:
            with self.subTest(block=block.splitlines()[0]):
                self.assertIn(block, migration)
        self.assertIn(blocks[-1], roles)


if __name__ == "__main__":
    unittest.main()
