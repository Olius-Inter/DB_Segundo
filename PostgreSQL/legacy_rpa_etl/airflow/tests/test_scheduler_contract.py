"""Contract tests for host/container validation; no Docker access required."""
import json
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import scheduler_check


class ReportValidationTests(unittest.TestCase):
    def test_report_contents_are_inspected_inside_the_producer_container(self):
        with patch.object(scheduler_check, 'command',
                return_value=SimpleNamespace(stdout=json.dumps({'shared_reports': 4}))) as command:
            self.assertEqual(scheduler_check.validate_reports('fixture-airflow'), {'shared_reports': 4})
            args = command.call_args.args
            self.assertEqual(args[:4], ('exec', 'fixture-airflow', 'python', '-c'))
            self.assertIn("report.read_text(encoding='utf-8')", args[4])
            self.assertNotIn('--user', args)
            self.assertEqual(args[-2:], ('/opt/olius-history/reports', '4'))

    def test_real_permission_probe_requires_denial_for_the_unrelated_uid(self):
        replies = [SimpleNamespace(stdout=''), SimpleNamespace(stdout='DENIED'),
                   SimpleNamespace(stdout=json.dumps({'shared_reports': 1}))]
        with patch.object(scheduler_check, 'command', side_effect=replies) as command:
            scheduler_check.validate_private_report_access('fixture-airflow')
            self.assertIn('0o600', command.call_args_list[0].args[-1])
            self.assertEqual(command.call_args_list[1].args[:4],
                ('exec', '--user', '65534:65534', 'fixture-airflow'))
            self.assertNotIn('--user', command.call_args_list[2].args)
        with patch.object(scheduler_check, 'command', side_effect=[SimpleNamespace(stdout=''),
                           SimpleNamespace(stdout='UNEXPECTED')]):
            with self.assertRaises(AssertionError):
                scheduler_check.validate_private_report_access('fixture-airflow')


if __name__ == '__main__':
    unittest.main()
