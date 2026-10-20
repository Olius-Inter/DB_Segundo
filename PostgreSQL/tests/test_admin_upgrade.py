"""Extração da migração: fonte canônica, limites e ausência de execução remota."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "admin_management/build_upgrade.py"
SPEC = importlib.util.spec_from_file_location("admin_upgrade", SCRIPT)
upgrade = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(upgrade)


class UpgradeTests(unittest.TestCase):
    def test_section_requires_one_explicit_pair_of_markers(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(upgrade, "ROOT", Path(folder)):
            source = Path(folder) / "part.sql"
            source.write_text("outside\n-- BEGIN ADMIN_MANAGEMENT\nSELECT 1;\n-- END ADMIN_MANAGEMENT\noutside", encoding="utf-8")
            self.assertEqual(upgrade.section("part.sql"), "SELECT 1;")
            for text in ("SELECT 1;", "-- BEGIN ADMIN_MANAGEMENT\n-- BEGIN ADMIN_MANAGEMENT\n-- END ADMIN_MANAGEMENT"):
                source.write_text(text, encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "ambíguo"):
                    upgrade.section("part.sql")

    def test_transaction_extraction_preserves_inner_body(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(upgrade, "ROOT", Path(folder)):
            source = Path(folder) / "matrix.sql"
            source.write_text("-- header\nBEGIN;\nSELECT 'matrix';\nCOMMIT;\nSELECT 'report';", encoding="utf-8")
            self.assertEqual(upgrade.transaction_body("matrix.sql"), "SELECT 'matrix';")

    def test_real_sources_generate_one_reviewable_transaction(self):
        with tempfile.TemporaryDirectory() as folder, \
                patch.object(upgrade, "__file__", str(Path(folder) / "build_upgrade.py")), \
                patch("builtins.print"):
            upgrade.main()
            result = (Path(folder) / "upgrade.generated.sql").read_text(encoding="utf-8")
            self.assertIn("CREATE TABLE public.admin_invitation", result)
            self.assertIn("CREATE TRIGGER trg_users_admin_guard", result)
            self.assertIn("Rotina administrativa", result)
            self.assertIn("LOCK TABLE public.users", result)
            self.assertNotIn("CREATE TABLE users (", result)
            self.assertTrue(result.rstrip().endswith("COMMIT;"))
            self.assertEqual(sum(line.strip() == "BEGIN;" for line in result.splitlines()), 1)
            self.assertEqual(sum(line.strip() == "COMMIT;" for line in result.splitlines()), 1)


if __name__ == "__main__":
    unittest.main()
