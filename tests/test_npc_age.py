"""GitHub #17 — NPC age must be computed from year_born, never read from the
stored `age` snapshot. Run: .venv/bin/python -m unittest tests.test_npc_age
"""
import importlib.util
import json
import logging
from pathlib import Path
import shutil
import tempfile
import unittest


class NpcAgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        server_path = root / 'server.py'
        shutil.copyfile(Path(__file__).resolve().parents[1] / 'server.py', server_path)
        spec = importlib.util.spec_from_file_location('age_test_server', server_path)
        self.server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.server)
        self.server.log.setLevel(logging.ERROR)
        self.server.MCP_KEY = 'test-only'
        self.server.BOT_KEY = 'bot-only'
        self.save = root / 'binder.json'
        self.save.write_text(json.dumps({
            'year': 507,
            'living': [
                {'id': 'npc-001', 'name': 'Bran', 'status': 'Alive', 'year_born': 464, 'age': 34},
                {'id': 'npc-002', 'name': 'Arthur', 'status': 'Alive', 'year_born': 492, 'age': 6},
                {'id': 'npc-003', 'name': 'Merlin', 'status': 'Alive', 'year_born': None, 'age': 70},
            ],
            'dead': [
                {'id': 'npc-100', 'name': 'Sir Geren', 'status': 'Dead', 'year_born': 440, 'year_died': 496, 'age': 59},
            ],
            'relationships': [],
        }))
        (root / 'config.json').write_text(json.dumps({'saveFile': str(self.save)}))
        self.client = self.server.app.test_client()
        self.headers = {'Authorization': 'Bearer test-only'}

    def _stored(self, npc_id):
        b = json.loads(self.save.read_text())
        return next(n for n in b['living'] + b['dead'] if n['id'] == npc_id)

    def test_search_and_get_report_computed_age(self):
        r = self.client.get('/api/mcp/npcs', headers=self.headers)
        self.assertEqual(r.status_code, 200, r.json)
        by_name = {n['name']: n for n in r.json['npcs']}
        self.assertEqual(by_name['Bran']['age'], 43)       # stored 34 is ignored
        self.assertEqual(by_name['Arthur']['age'], 15)
        self.assertEqual(by_name['Merlin']['age'], 70)     # no year_born → stored fallback
        self.assertEqual(by_name['Sir Geren']['age'], 56)  # dead: year_died − year_born, not stored 59
        r = self.client.get('/api/mcp/npc/bran', headers=self.headers)
        self.assertEqual(r.json['age'], 43)
        r = self.client.get('/api/mcp/npc/npc-100', headers=self.headers)
        self.assertEqual(r.json['age'], 56)

    def test_bot_endpoint_reports_computed_age(self):
        r = self.client.get('/api/bot/npcs', headers={'Authorization': 'Bearer bot-only'})
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual({n['name']: n['age'] for n in r.json['npcs']}['Bran'], 43)

    def test_update_with_age_sets_year_born_and_clears_snapshot(self):
        r = self.client.patch('/api/mcp/npc/npc-001', json={'age': '45'}, headers=self.headers)  # Claude.ai sends text
        self.assertEqual(r.status_code, 200, r.json)
        self.assertIn('year_born', r.json['changed'])
        self.assertEqual(r.json['npc']['year_born'], 462)
        self.assertEqual(r.json['npc']['age'], 45)
        stored = self._stored('npc-001')
        self.assertEqual(stored['year_born'], 462)
        self.assertIsNone(stored['age'])
        # year_born wins when both are passed
        r = self.client.patch('/api/mcp/npc/npc-001', json={'age': 10, 'year_born': 470}, headers=self.headers)
        self.assertEqual(r.json['npc']['year_born'], 470)
        self.assertEqual(r.json['npc']['age'], 37)
        # dead NPC: age at death anchors on year_died
        r = self.client.patch('/api/mcp/npc/npc-100', json={'age': 60}, headers=self.headers)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(r.json['npc']['year_born'], 436)
        self.assertEqual(r.json['npc']['age'], 60)
        r = self.client.patch('/api/mcp/npc/npc-001', json={'age': 'old'}, headers=self.headers)
        self.assertEqual(r.status_code, 400)

    def test_create_with_age(self):
        r = self.client.post('/api/mcp/npc', json={'name': 'Newcomer', 'age': 21}, headers=self.headers)
        self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual(r.json['npc']['year_born'], 486)
        self.assertEqual(r.json['npc']['age'], 21)
        self.assertIsNone(self._stored(r.json['id'])['age'])

    def test_normalize_clears_only_where_year_born_exists(self):
        b = json.loads(self.save.read_text())
        self.assertEqual(self.server._normalize_npc_ages(b), 3)
        ages = {n['name']: n['age'] for n in b['living'] + b['dead']}
        self.assertEqual(ages, {'Bran': None, 'Arthur': None, 'Merlin': 70, 'Sir Geren': None})
        self.assertEqual(self.server._normalize_npc_ages(b), 0)

    def test_npc_age_helper_edge_cases(self):
        f = self.server._npc_age
        self.assertIsNone(f({'year_born': 464}, None))
        self.assertIsNone(f({}, 507))
        self.assertEqual(f({'year_born': 464, 'status': 'Dead'}, 507), 43)  # dead without year_died → current year
        self.assertEqual(f({'year_born': 448, 'year_died': 488, 'status': 'Unknown'}, 507), 40)  # death year wins over status label
        self.assertEqual(f({'year_born': True}, 507) , None)


if __name__ == '__main__':
    unittest.main()
