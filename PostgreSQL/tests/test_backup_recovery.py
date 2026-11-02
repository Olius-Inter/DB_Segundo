"""Regressões de segurança da seleção de relatórios, sem acessar PostgreSQL."""
import contextlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'backup_recovery/validate_recovery.py'
SPEC = importlib.util.spec_from_file_location('backup_recovery_validation', SCRIPT)
validation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validation)


class ReportDirectorySecurityTests(unittest.TestCase):
    def setUp(self):
        self.project = tempfile.TemporaryDirectory(prefix='olius-report-test-')
        self.addCleanup(self.project.cleanup)
        self.root = Path(self.project.name).resolve()
        self.root_patch = patch.object(validation, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def test_default_destination_is_fixed_and_not_created_by_selection(self):
        args = validation.parse_args(['--pg-bin', 'postgres-bin'])
        self.assertFalse(args.ci_reports)
        path = validation.report_directory(args.ci_reports)
        self.assertEqual(path, self.root / 'PostgreSQL/backup_recovery/artifacts')
        self.assertFalse(path.exists())

    def test_ci_destination_is_fixed(self):
        args = validation.parse_args(['--pg-bin', 'postgres-bin', '--ci-reports'])
        self.assertEqual(validation.report_directory(args.ci_reports),
                         self.root / 'coverage/backup-recovery/artifacts')

    def test_arbitrary_path_arguments_are_rejected(self):
        for path in ('../../outside', str(self.root.parent / 'outside')):
            with self.subTest(path=path), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error:
                    validation.parse_args(['--pg-bin', 'postgres-bin', '--report-dir', path])
                self.assertEqual(error.exception.code, 2)
        self.assertFalse((self.root.parent / 'outside').exists())

    def test_ci_flag_cannot_receive_a_path(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            validation.parse_args(['--pg-bin', 'postgres-bin', '--ci-reports=../../outside'])

    def test_parent_symlink_cannot_redirect_reports_outside_project(self):
        with tempfile.TemporaryDirectory(prefix='olius-outside-') as outside:
            parent = self.root / 'coverage'
            parent.mkdir()
            try:
                (parent / 'backup-recovery').symlink_to(outside, target_is_directory=True)
            except OSError as error:
                self.skipTest(f'Sistema não permite criar symlinks: {error}')
            with self.assertRaises(ValueError):
                validation.report_directory(True)
            self.assertFalse((Path(outside) / 'artifacts').exists())

    def test_symlink_to_another_project_directory_is_also_rejected(self):
        alternate = self.root / 'alternate'
        alternate.mkdir()
        parent = self.root / 'PostgreSQL/backup_recovery'
        parent.mkdir(parents=True)
        try:
            (parent / 'artifacts').symlink_to(alternate, target_is_directory=True)
        except OSError as error:
            self.skipTest(f'Sistema não permite criar symlinks: {error}')
        with self.assertRaises(ValueError):
            validation.report_directory(False)
        self.assertEqual(list(alternate.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
