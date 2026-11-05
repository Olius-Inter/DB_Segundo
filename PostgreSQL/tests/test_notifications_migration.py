from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2] / "PostgreSQL"


class NotificationsMigrationTests(unittest.TestCase):
    def test_migration_matches_canonical_definitions(self):
        migration = (ROOT / "migrations/20261104_notifications.sql").read_text(encoding="utf-8")
        structure = (ROOT / "01_structure.sql").read_text(encoding="utf-8")
        indexes = (ROOT / "03_indexes.sql").read_text(encoding="utf-8")
        triggers = (ROOT / "05_triggers.sql").read_text(encoding="utf-8")
        roles = (ROOT / "access_control/01_roles.sql").read_text(encoding="utf-8")
        blocks = [
            structure[structure.index("-- Central de notificações"):].strip(),
            indexes[indexes.index("CREATE INDEX idx_notification_recipient_recent"):].strip(),
            triggers[triggers.index("CREATE FUNCTION public.notify_pev_status_change"):
                     triggers.rindex("COMMIT;")].strip(),
            "GRANT SELECT, UPDATE (read_at) ON public.notification TO olius_api;",
        ]
        for block in blocks:
            with self.subTest(block=block.splitlines()[0]):
                self.assertIn(block, migration)
        self.assertIn(blocks[-1], roles)


if __name__ == "__main__":
    unittest.main()
