import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from file_policy import checked_path, read_secret


class PathTestCase(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.policy_root = Path(folder.name)
        self.enterContext(patch('tempfile.tempdir', folder.name))
        self.enterContext(patch.dict(os.environ, {
            'OLIUS_ETL_STAGE_ROOT': folder.name, 'OLIUS_ETL_KEY_ROOT': folder.name,
            'OLIUS_ETL_COMPLEMENT_ROOT': folder.name}))


class FilePolicyTests(PathTestCase):
    def test_private_inputs_and_escape_rejections(self):
        key = self.policy_root / 'key'
        key.write_bytes(b'secret')
        self.assertEqual(read_secret(key), b'secret')
        self.assertEqual(checked_path(self.policy_root/'safe.sqlite','stage',must_exist=False).parent, self.policy_root.resolve())
        for value in ('file:secret.sqlite', ':memory:', 'https://host/file.sqlite', str(self.policy_root.parent/'outside.sqlite')):
            with self.assertRaises(ValueError):
                checked_path(value,'stage',must_exist=False)
        for kind,name in (('stage','bad.txt'),('complement','bad.txt'),('key','missing')):
            with self.assertRaises(ValueError):
                checked_path(self.policy_root/name,kind)
        key.write_bytes(b'x'*4097)
        with self.assertRaises(ValueError):
            read_secret(key)
