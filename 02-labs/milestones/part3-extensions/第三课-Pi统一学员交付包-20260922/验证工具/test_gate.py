"""Synthetic receipts test the validator only; they are never Pi acceptance evidence."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import gate


class GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='pi-acceptance-gate-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.doc = gate.template('agent-teams')
        self.doc['runtime'] = dict(pi_version='fixture-version', node_version='fixture',
                                   os='fixture', terminal='fixture', extensions=['fixture'])
        for name in ['source', 'installed', 'extracted']:
            folder = self.root / name; folder.mkdir(); (folder / 'index.ts').write_text('// synthetic\n')
        self.doc['delivery'] = {'source_root': str(self.root/'source'),
                               'installed_root': str(self.root/'installed'),
                               'extracted_root': str(self.root/'extracted'),
                               'sha256_by_path': gate.tree(self.root/'source')}
        evidence = self.root/'synthetic.txt'; evidence.write_text('SYNTHETIC VALIDATOR FIXTURE ONLY\n')
        self.ref = {'path': evidence.name, 'sha256': gate.sha(evidence)}
        self.doc['prompt'] = self.ref.copy()
        required = gate.COMMON | gate.TEAMS
        for c in self.doc['checks']:
            c.update(status='PASS', driver='tmux', provider='real',
                     prompt_sha256=self.ref['sha256'], evidence=[self.ref.copy()],
                     observations=copy.deepcopy(required[c['id']]))
            c['observations'].update(first_feedback_ms=100, progress_refresh_ms=1000,
                                     cancel_ack_ms=100, children_exit_ms=500,
                                     deadline_ms=1000, failure_ms=1500,
                                     business_deadline_ms=10000, duration_ms=900000)
            c['runs'] = [{'session_id': str(i), 'status': 'PASS',
                          'prompt_sha256': self.ref['sha256'], 'evidence': self.ref.copy()} for i in range(3)]

    def check(self, name):
        return next(c for c in self.doc['checks'] if c['id'] == name)

    def errors(self):
        return gate.validate(self.doc, self.root)

    def test_complete_synthetic_receipt_validates_structure_only(self):
        self.assertEqual(self.errors(), [])

    def test_empty_or_legacy_pass_claim_fails(self):
        self.assertTrue(gate.validate({'status': 'PASS', 'checks': []}, self.root))

    def test_missing_case_blocks(self):
        self.doc['checks'].pop(); self.assertTrue(self.errors())

    def test_any_failure_blocks(self):
        self.check('cancel_wait')['status'] = 'FAIL'; self.assertTrue(self.errors())

    def test_mock_cannot_replace_real_prompt(self):
        self.check('prompt_fresh')['provider'] = 'fixture'; self.assertTrue(self.errors())

    def test_rpc_cannot_replace_native_ui(self):
        self.check('combo_tui')['driver'] = 'rpc'; self.assertTrue(self.errors())

    def test_preseed_cannot_replace_user_journey(self):
        self.check('prompt_fresh')['observations']['no_preseed_or_probe'] = False
        self.assertTrue(self.errors())

    def test_changed_prompt_blocks(self):
        self.check('global_journey')['prompt_sha256'] = 'changed'; self.assertTrue(self.errors())

    def test_reusing_same_session_blocks(self):
        self.check('prompt_fresh')['runs'][1]['session_id'] = '0'; self.assertTrue(self.errors())

    def test_one_success_does_not_erase_recent_failure(self):
        self.check('prompt_fresh')['runs'][1]['status'] = 'FAIL'; self.assertTrue(self.errors())

    def test_missing_or_changed_evidence_blocks(self):
        (self.root/'synthetic.txt').unlink(); self.assertTrue(self.errors())

    def test_installed_or_extracted_source_drift_blocks(self):
        (self.root/'installed/index.ts').write_text('changed'); self.assertTrue(self.errors())

    def test_unlisted_new_source_blocks(self):
        (self.root/'source/hidden.ts').write_text('new'); self.assertTrue(self.errors())

    def test_hung_task_heartbeat_is_not_progress(self):
        self.check('heartbeat_stall')['observations']['business_deadline_enforced'] = False
        self.assertTrue(self.errors())

    def test_timeout_and_cancel_deadlines_enforced(self):
        for name, key, value in [('cancel_wait','children_exit_ms',11000),
                                 ('no_events','failure_ms',999999),
                                 ('heartbeat_stall','failure_ms',999999),
                                 ('combo_tui','first_feedback_ms',float('nan'))]:
            with self.subTest(name=name):
                old = self.check(name)['observations'][key]
                self.check(name)['observations'][key] = value
                self.assertTrue(self.errors())
                self.check(name)['observations'][key] = old

    def test_known_blocker_not_waived(self):
        self.doc['blockers'].append('reply disappears'); self.assertTrue(self.errors())

    def test_children_must_be_gone(self):
        self.check('teams_messages')['observations']['children_remaining'] = 1
        self.assertTrue(self.errors())

    def test_duplicate_case_rejected(self):
        self.doc['checks'].append(copy.deepcopy(self.doc['checks'][0])); self.assertTrue(self.errors())

    def test_evidence_path_escape_rejected(self):
        self.check('unit')['evidence'] = [{'path': '../outside', 'sha256': '0'}]
        self.assertTrue(self.errors())


if __name__ == '__main__':
    unittest.main()
