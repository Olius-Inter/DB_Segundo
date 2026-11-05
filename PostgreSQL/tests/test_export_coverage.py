import ast
import tempfile
from pathlib import Path
import unittest

from export_coverage import build_report


class CoverageMappingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "PostgreSQL").mkdir()
        self.body = "\nBEGIN\n IF true THEN RETURN 1; END IF;\n RETURN 2;\nEND;\n"
        self.file = self.root / "PostgreSQL/04_functions_procedures.sql"
        self.file.write_text("-- heading\nCREATE FUNCTION f() RETURNS int LANGUAGE plpgsql AS $$" + self.body + "$$;\n", encoding="utf-8", newline="\n")

    def routine(self, statements):
        return {"signature": "f()", "source": self.body, "statements": statements}

    def test_null_and_partial_line_are_not_covered(self):
        statements = [
            {"lineno": 2, "stmtname": "statement block", "exec_stmts": 1},
            {"lineno": 3, "stmtname": "IF", "exec_stmts": 1},
            {"lineno": 3, "stmtname": "RETURN", "exec_stmts": 0},
            {"lineno": 4, "stmtname": "RETURN", "exec_stmts": None},
        ]
        report, covered, total = build_report(self.root, [self.routine(statements)])
        self.assertEqual((covered, total), (0, 2))
        self.assertEqual([n.attrib for n in report.find("file")], [
            {"lineNumber": "4", "covered": "false"},
            {"lineNumber": "5", "covered": "false"},
        ])

    def test_error_path_counts_as_exercised_and_crlf_maps_correctly(self):
        self.file.write_bytes(self.file.read_bytes().replace(b"\n", b"\r\n"))
        statement = {"lineno": 4, "stmtname": "RAISE", "exec_stmts": 0, "exec_stmts_err": 1}
        report, covered, total = build_report(self.root, [self.routine([statement])])
        self.assertEqual((covered, total), (1, 1))
        self.assertEqual(report.find("file/lineToCover").attrib["lineNumber"], "5")

    def test_mismatched_source_fails_instead_of_fabricating_coverage(self):
        routine = self.routine([])
        routine["source"] = "body from another commit"
        with self.assertRaises(ValueError):
            build_report(self.root, [routine])

    def test_identical_migration_maps_measured_lines_and_keeps_uncovered_lines(self):
        migrations = self.root / "PostgreSQL/migrations"
        migrations.mkdir()
        mirror = migrations / "test.sql"
        mirror.write_text("-- migration\n-- preflight\n" + self.file.read_text(encoding="utf-8"),
                          encoding="utf-8")
        statements = [
            {"lineno": 3, "stmtname": "RETURN", "exec_stmts": 1},
            {"lineno": 4, "stmtname": "RETURN", "exec_stmts": 0},
        ]
        report, covered, total = build_report(self.root, [self.routine(statements)])
        self.assertEqual((covered, total), (2, 4))
        files = {node.attrib["path"]: list(node) for node in report}
        canonical = files["PostgreSQL/04_functions_procedures.sql"]
        mirrored = files["PostgreSQL/migrations/test.sql"]
        self.assertEqual([node.attrib["covered"] for node in mirrored], ["true", "false"])
        self.assertEqual([int(node.attrib["lineNumber"]) for node in mirrored],
                         [int(node.attrib["lineNumber"]) + 2 for node in canonical])

    def test_changed_migration_body_does_not_inherit_coverage(self):
        migrations = self.root / "PostgreSQL/migrations"
        migrations.mkdir()
        (migrations / "test.sql").write_text(
            self.file.read_text(encoding="utf-8").replace("RETURN 2", "RETURN 3"), encoding="utf-8")
        statement = {"lineno": 4, "stmtname": "RETURN", "exec_stmts": 1}
        report, covered, total = build_report(self.root, [self.routine([statement])])
        self.assertEqual((covered, total), (1, 1))
        self.assertEqual(len(report), 1)


class CoverageOrchestrationTests(unittest.TestCase):
    def test_role_reinstallation_precedes_profile_inventory_and_measurement(self):
        source = Path(__file__).with_name("run_ci.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "main")

        def line_for(name, label):
            calls = [node.lineno for node in ast.walk(main)
                     if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                     and node.func.id == name and node.args
                     and isinstance(node.args[0], ast.Constant) and node.args[0].value == label]
            self.assertEqual(len(calls), 1, label)
            return calls[0]

        reinstallation = line_for("sql_file", "PostgreSQL/tests/ranking_access_regression.sql")
        inventory = line_for("query", "routine-inventory")
        reset = line_for("query", "profiler-reset")
        regression = line_for("sql_file", "PostgreSQL/tests/failed_visit_regression.sql")
        self.assertLess(reinstallation, inventory)
        self.assertLess(inventory, reset)
        self.assertLess(reset, regression)


if __name__ == "__main__":
    unittest.main()
