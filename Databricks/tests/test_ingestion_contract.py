"""Testes locais, sem Spark/Databricks/credenciais: python -m unittest discover -s Databricks/tests."""
import argparse
import importlib.util
from pathlib import Path
import re
import unittest
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("ingestion", ROOT / "Databricks/02_ingestion.py")
ingestion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingestion)


class IngestionContractTests(unittest.TestCase):
    def test_fingerprint_accepts_decimal_numeric_equivalence(self):
        ingestion.verify_fingerprint(
            {"rows": 2, "volume": Decimal("10.20")},
            {"rows": 2, "volume": Decimal("10.200")}, "fato",
        )

    def test_fingerprint_rejects_missing_rows_or_changed_measures(self):
        for actual in ({"rows": 1, "volume": 10}, {"rows": 2, "volume": 11}):
            with self.assertRaises(ValueError):
                ingestion.verify_fingerprint({"rows": 2, "volume": 10}, actual, "fato")

    def test_empty_snapshot_is_valid(self):
        ingestion.verify_fingerprint({"rows": 0, "volume": 0}, {"rows": 0, "volume": Decimal(0)}, "fato")

    def test_contract_change_fails(self):
        with self.assertRaises(ValueError):
            ingestion.verify_fingerprint({"rows": 1}, {"rows": 1, "volume": 0}, "fato")

    def test_identifier_blocks_sql_fragments(self):
        self.assertEqual(ingestion.identifier("olius_2026"), "olius_2026")
        for value in ("catalog;DROP TABLE x", "a.b", "a`", "", "123"):
            with self.assertRaises(argparse.ArgumentTypeError):
                ingestion.identifier(value)

    def test_every_dataset_has_source_target_and_published_view(self):
        source = (ROOT / "PostgreSQL/07_materialized_views.sql").read_text(encoding="utf-8")
        target = (ROOT / "Databricks/01_structure.sql").read_text(encoding="utf-8")
        views = (ROOT / "Databricks/03_views.sql").read_text(encoding="utf-8")
        for name, keys in ingestion.DATASETS.items():
            with self.subTest(dataset=name):
                self.assertIn(f"CREATE MATERIALIZED VIEW dm.{name} AS", source)
                match = re.search(rf"CREATE TABLE IF NOT EXISTS olius_bi_landing\.{name} \((.*?)\) USING DELTA;", target, re.S)
                self.assertIsNotNone(match)
                columns = re.findall(r"^\s*(\w+)\s+\w+", match.group(1), re.M)
                self.assertTrue(set(keys).issubset(columns))
                self.assertTrue(set(ingestion.MEASURES.get(name, [])).issubset(columns))
                view_match = re.search(rf"CREATE OR REPLACE VIEW olius_bi\.{name} AS\s*SELECT (.*?)\s*FROM", views, re.S)
                self.assertIsNotNone(view_match)
                projected = re.findall(r"d\.(\w+)", view_match.group(1))
                self.assertEqual(projected, [c for c in columns if c != "_lote_id"])
                self.assertIn(f"REFRESH MATERIALIZED VIEW dm.{name};", source)

    def test_all_relationships_have_registered_endpoints(self):
        for child, _, parent, _ in ingestion.RELATIONS:
            self.assertIn(child, ingestion.DATASETS)
            self.assertIn(parent, ingestion.DATASETS)

    def test_ranking_not_implemented(self):
        views = (ROOT / "Databricks/03_views.sql").read_text(encoding="utf-8")
        self.assertNotRegex(views, r"(?i)\b(?:DENSE_RANK|ROW_NUMBER|RANK)\s*\(")


if __name__ == "__main__":
    unittest.main()
