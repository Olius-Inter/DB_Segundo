"""Pré-condições relevantes da carga; nenhum teste conecta ao banco real."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import run


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads(Path(__file__).with_name("config.json").read_text(encoding="utf-8"))

    def check_config(self, value):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "config.json"
            file.write_text(json.dumps(value), encoding="utf-8")
            return run.load_config(file)

    def test_official_plans_without_invented_certificate_levels(self):
        self.assertEqual(self.check_config(self.config)["certificate_levels"], [])

    def test_upgrades_require_increasing_both_limits(self):
        self.config["plans"][2]["collection_limit"] = 4
        with self.assertRaisesRegex(ValueError, "ambos os limites"):
            self.check_config(self.config)

    def test_mass_refuses_capacity_below_eight_requests(self):
        self.config["plans"][2]["collection_limit"] = 7
        with self.assertRaisesRegex(ValueError, "8 vagas"):
            self.check_config(self.config)

    def test_undefined_certificates_cannot_be_silently_filled(self):
        self.config["certificate_levels"] = [{"name": "Não aprovado", "required_liters": 1}]
        with self.assertRaisesRegex(ValueError, "pendentes"):
            self.check_config(self.config)

    def test_container_without_disposable_label_refuses_sql_execution(self):
        with patch("sys.argv", ["run.py", "--container", "untrusted"]), \
             patch.dict("os.environ", {"OLIUS_DATA_LOAD_DISPOSABLE": "1"}), \
             patch.object(run, "command", return_value="{}") as execute:
            with self.assertRaisesRegex(ValueError, "descartável"):
                run.main()
            self.assertEqual(execute.call_count, 1)


if __name__ == "__main__":
    unittest.main()
