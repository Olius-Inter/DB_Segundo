"""Testes de falha controlada e dependências do runner, sem banco real."""
import ast
from pathlib import Path
import unittest
from unittest.mock import patch
import password_reset_migration_regression as migration
import run_ci


class MigrationCleanupTests(unittest.TestCase):
    def scenario(self, failing_prefix):
        calls=[]
        def execute(sql,*args,**kwargs):
            calls.append(sql)
            if sql.startswith('SELECT EXISTS'): return 'f'
            if sql.startswith(failing_prefix): raise RuntimeError('falha simulada')
            return ''
        with patch.dict(migration.os.environ,{'OLIUS_CI_DISPOSABLE':'1'}), patch.object(migration,'execute',side_effect=execute):
            with self.assertRaisesRegex(RuntimeError,'falha simulada'): migration.main()
        return calls

    def test_grant_failure_removes_created_role(self):
        calls=self.scenario('GRANT ')
        self.assertIn('DROP ROLE '+migration.DEPLOYER+';',calls)
        self.assertFalse(any(s.startswith('DROP DATABASE') for s in calls))

    def test_create_failure_does_not_remove_role(self):
        calls=self.scenario('CREATE ROLE ')
        self.assertFalse(any(s.startswith('DROP ') or s.startswith('SET SESSION AUTHORIZATION') for s in calls))

    def test_occupied_server_is_never_modified(self):
        with patch.dict(migration.os.environ,{'OLIUS_CI_DISPOSABLE':'1'}), patch.object(migration,'execute',return_value='t') as execute:
            with self.assertRaisesRegex(RuntimeError,'preexistente'): migration.main()
        self.assertEqual(execute.call_count,1)


class RunnerDependencyTests(unittest.TestCase):
    def test_new_regressions_require_access_control(self):
        tree=ast.parse(Path(run_ci.__file__).read_text(encoding='utf-8'))
        required={'password-reset-migration','password-reset-concurrency','PostgreSQL/tests/password_reset_regression.sql'}
        found=set()
        def visit(node,guarded=False):
            if isinstance(node,ast.Call) and node.args and isinstance(node.args[0],ast.Constant):
                label=node.args[0].value
                if label in required:
                    self.assertTrue(guarded,label+' exige access_control')
                    found.add(label)
            if isinstance(node,ast.If) and isinstance(node.test,ast.Name) and node.test.id=='has_access':
                for child in node.body: visit(child,True)
                for child in node.orelse: visit(child,guarded)
            else:
                for child in ast.iter_child_nodes(node): visit(child,guarded)
        visit(tree)
        self.assertEqual(found,required)


if __name__=='__main__': unittest.main()
