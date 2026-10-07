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
        self.file = self.root / "PostgreSQL/04_functions_procedures_window_functions.sql"
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


if __name__ == "__main__":
    unittest.main()
