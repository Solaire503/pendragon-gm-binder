"""Run: .venv/bin/python -m unittest discover -s tests

MCP Winter Phase & solo endpoints: roll endpoints never write; confirm
endpoints mirror the Winter tab exactly. Uses an isolated server copy and a
synthetic save (plus the roll bridge, which needs node on PATH).
"""
import importlib.util
import json
import logging
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def _binder():
    return {
        'year': 506,
        'living': [
            {'id': 'npc-001', 'name': 'Sir Gareth', 'role': 'Vassal Knight', 'household': 'Cador', 'pronoun': 'he/him', 'year_born': 480, 'glory': 1200, 'con': 14},
            {'id': 'npc-002', 'name': 'Lady Anwen', 'role': 'Lady', 'household': 'Cador', 'pronoun': 'she/her', 'year_born': 484, 'con': 15},
            {'id': 'npc-003', 'name': 'Elin', 'role': 'Daughter', 'household': 'Cador', 'pronoun': 'she/her', 'year_born': 488},
            {'id': 'npc-004', 'name': 'Sir Bedwyr', 'role': 'Household Knight', 'household': 'Cador', 'pronoun': 'he/him', 'year_born': 482, 'courtesy': 12, 'glory': 'Respected'},
            {'id': 'npc-005', 'name': 'Old Maelgwn', 'role': 'Steward', 'household': 'Cador', 'pronoun': 'he/him', 'year_born': 436},
            {'id': 'npc-006', 'name': 'Aberthol Cador', 'role': 'Player Knight', 'household': 'Cador', 'pronoun': 'he/him', 'year_born': 480},
            {'id': 'npc-007', 'name': 'Nest', 'role': 'Lady', 'household': 'Dawnwell', 'pronoun': 'she/her', 'year_born': 470},
        ],
        'dead': [{'id': 'npc-008', 'name': 'Sir Old', 'role': 'Knight', 'household': 'Dawnwell', 'pronoun': 'he/him', 'year_born': 440, 'year_died': 500, 'status': 'Dead'}],
        'relationships': [
            {'id': 'rel-1', 'sourceId': 'npc-001', 'targetId': 'npc-002', 'type': 'Spouse'},
            {'id': 'rel-2', 'sourceId': 'npc-007', 'targetId': 'npc-008', 'type': 'Spouse'},
        ],
        'chronicle': {}, 'households': [], 'manors': {}, 'npcManors': [],
    }


class WinterApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        shutil.copyfile(ROOT / 'server.py', root / 'server.py')
        # The bridge loads the tab files relative to its own location.
        (root / 'scripts').mkdir(); (root / 'js' / 'tabs').mkdir(parents=True)
        shutil.copyfile(ROOT / 'scripts' / 'roll-bridge.cjs', root / 'scripts' / 'roll-bridge.cjs')
        for f in ('winter.js', 'solos.js'):
            shutil.copyfile(ROOT / 'js' / 'tabs' / f, root / 'js' / 'tabs' / f)
        spec = importlib.util.spec_from_file_location('winter_test_server', root / 'server.py')
        self.server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.server)
        self.server.log.setLevel(logging.ERROR)
        self.server.MCP_KEY = 'test-only'
        self.save = root / 'binder.json'
        self.save.write_text(json.dumps(_binder()))
        (root / 'config.json').write_text(json.dumps({'saveFile': str(self.save)}))
        self.client = self.server.app.test_client()
        self.h = {'Authorization': 'Bearer test-only'}

    def _disk(self):
        return json.loads(self.save.read_text())

    def _npc(self, nid):
        d = self._disk()
        for lst in ('living', 'dead'):
            for n in d[lst]:
                if n['id'] == nid:
                    return n, lst
        return None, None

    # ── rolls are advisory ────────────────────────────────────────────────

    def test_overview_and_rolls_never_write(self):
        before = self.save.read_text()
        r = self.client.get('/api/mcp/winter/overview', headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        o = r.json
        cats = {s['id']: s for s in o['survival']}
        self.assertTrue(cats['npc-006']['autoExempt'])          # player knight
        self.assertEqual(cats['npc-005']['category'], 'Very Old')
        self.assertEqual(cats['npc-002']['category'], 'Women')  # married to a non-PK
        births = {b['id']: b for b in o['births']}
        self.assertTrue(births['npc-002']['spouse']['alive'])
        self.assertFalse(births['npc-007']['spouse']['alive'])   # widow
        self.assertEqual(births['npc-007']['autoMods'], -1)      # age 36 → −1
        self.assertIn('npc-003', {m['id'] for m in o['marriage']['maidens']})
        self.assertIn('npc-004', {k['id'] for k in o['marriage']['knights']})
        self.assertNotIn('npc-001', {k['id'] for k in o['marriage']['knights']})  # married
        self.assertIn('confirmation', o)

        r = self.client.post('/api/mcp/winter/survival', headers=self.h, json={'household': 'Cador'})
        self.assertEqual(r.status_code, 200, r.json)
        rolled = [x for x in r.json['results'] if x['roll']]
        self.assertTrue(all(x['roll']['result'] in ('Death', 'Safe') for x in rolled))
        self.assertTrue(any(x['skipped'] == 'auto-exempt' for x in r.json['results']))
        r = self.client.post('/api/mcp/winter/survival', headers=self.h, json={'npc_ids': ['npc-006'], 'include_exempt': True})
        self.assertEqual(r.json['rolled'], 1)

        r = self.client.post('/api/mcp/winter/childbirth', headers=self.h, json={})
        self.assertEqual([x['id'] for x in r.json['results']], ['npc-002'])   # only living-spouse wives
        self.assertEqual(r.json['results'][0]['effectiveCon'], 15)
        r = self.client.post('/api/mcp/winter/childbirth', headers=self.h, json={'npc_ids': ['npc-007'], 'con': 20, 'modifier': 3})
        self.assertEqual(r.json['results'][0]['effectiveCon'], 22)
        self.assertIn(r.json['results'][0]['result']['result'], ('success', 'critical', 'failure', 'fumble'))

        r = self.client.post('/api/mcp/winter/marriage', headers=self.h, json={'npc_id': 'npc-003'})
        self.assertEqual(r.json['kind'], 'maiden'); self.assertEqual(r.json['result']['ageMod'], 4)  # age 18 → +4
        r = self.client.post('/api/mcp/winter/marriage', headers=self.h, json={'npc_id': 'npc-004', 'roll_rank': True})
        self.assertEqual(r.json['kind'], 'knight'); self.assertEqual(r.json['result']['target'], 12)
        self.assertEqual(self.client.post('/api/mcp/winter/marriage', headers=self.h, json={'npc_id': 'npc-001'}).status_code, 400)
        r = self.client.post('/api/mcp/winter/marriage-rank', headers=self.h, json={'npc_id': 'npc-004'})
        self.assertIn('rank', r.json['rankEntry'])

        for mode in ('yearly', 'solo', 'kin'):
            r = self.client.post('/api/mcp/solo/roll', headers=self.h, json={'npc_id': 'npc-001', 'mode': mode})
            self.assertEqual(r.status_code, 200, (mode, r.json))
            self.assertEqual(r.json['wed'], 'wed')
            self.assertTrue(r.json['cards'] and all('mechDesc' in c for c in r.json['cards']))
            self.assertIn('flavorGuide', r.json)
        r = self.client.post('/api/mcp/solo/roll', headers=self.h, json={'npc_id': 'npc-004', 'mode': 'yearly', 'fixed_roll': 13})
        self.assertEqual(r.json['cards'][0]['tableRolls']['yearly'], 13)
        self.assertEqual(r.json['wed'], 'unwed')
        self.assertEqual(self.client.post('/api/mcp/solo/roll', headers=self.h, json={'npc_id': 'npc-999'}).status_code, 404)
        self.assertEqual(self.client.post('/api/mcp/solo/roll', headers=self.h, json={'npc_id': 'npc-001', 'mode': 'x'}).status_code, 400)
        self.assertEqual(self.client.get('/api/mcp/winter/overview').status_code, 401)
        self.assertEqual(self.save.read_text(), before, 'roll endpoints must never write')

    # ── confirms write like the Winter tab ───────────────────────────────

    def test_confirm_death(self):
        r = self.client.post('/api/mcp/winter/death', headers=self.h, json={'npc_id': 'npc-005', 'cause': 'Fever'})
        self.assertEqual(r.status_code, 200, r.json)
        n, lst = self._npc('npc-005')
        self.assertEqual((lst, n['status'], n['year_died']), ('dead', 'Dead', 506))
        self.assertTrue(n['notes'].endswith('† Fever'))
        self.assertEqual(self.client.post('/api/mcp/winter/death', headers=self.h, json={'npc_id': 'npc-005'}).status_code, 409)
        self.assertEqual(self.client.post('/api/mcp/winter/death', headers=self.h, json={'npc_id': 'npc-999'}).status_code, 404)

    def test_record_birth_and_tragedies(self):
        r = self.client.post('/api/mcp/winter/birth', headers=self.h, json={
            'mother_id': 'npc-002', 'children': [{'name': 'Owain', 'pronoun': 'he/him'}, {'name': 'Gwen', 'pronoun': 'she/her', 'blessed': True, 'blessing': 'Sees far'}]})
        self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual(r.json['father_id'], 'npc-001')   # living spouse inferred
        ids = [c['id'] for c in r.json['children']]
        d = self._disk()
        kids = {n['id']: n for n in d['living'] if n['id'] in ids}
        self.assertEqual({k['role'] for k in kids.values()}, {'Baby'})
        self.assertEqual({k['year_born'] for k in kids.values()}, {506})
        self.assertIn('✦ Blessing: Sees far', kids[ids[1]]['notes'])
        rels = [(x['sourceId'], x['targetId'], x['type']) for x in d['relationships']]
        for cid in ids:
            self.assertIn((cid, 'npc-002', 'Child'), rels)
            self.assertIn((cid, 'npc-001', 'Child'), rels)
        # bastard with no father named → no father relationship
        r = self.client.post('/api/mcp/winter/birth', headers=self.h, json={'mother_id': 'npc-007', 'bastard': True, 'children': [{'name': 'Nobody'}]})
        self.assertEqual(r.status_code, 201, r.json)
        self.assertIsNone(r.json['father_id'])
        kid, _ = self._npc(r.json['children'][0]['id'])
        self.assertIn('⚔ Bastard', kid['notes'])
        self.assertEqual(self.client.post('/api/mcp/winter/birth', headers=self.h, json={'mother_id': 'npc-002', 'children': []}).status_code, 400)

        # tragedies
        r = self.client.post('/api/mcp/winter/birth-tragedy', headers=self.h, json={'mother_id': 'npc-002', 'tragedy': 'difficult_birth'})
        self.assertEqual(r.json['con'], 14)
        r = self.client.post('/api/mcp/winter/birth-tragedy', headers=self.h, json={'mother_id': 'npc-002', 'tragedy': 'child_dies', 'child_sex': 'girl'})
        self.assertEqual(r.status_code, 200, r.json)
        child, lst = self._npc(r.json['child']['id'])
        self.assertEqual((lst, child['status'], child['pronoun'], child['year_died']), ('dead', 'Dead', 'she/her', 506))
        r = self.client.post('/api/mcp/winter/birth-tragedy', headers=self.h, json={'mother_id': 'npc-007', 'tragedy': 'both_die', 'record_child': False})
        m, lst = self._npc('npc-007')
        self.assertEqual(lst, 'dead'); self.assertIsNone(r.json['child'])
        self.assertTrue(m['notes'].endswith('† Died in childbirth'))
        self.assertEqual(self.client.post('/api/mcp/winter/birth-tragedy', headers=self.h, json={'mother_id': 'npc-002', 'tragedy': 'plague'}).status_code, 400)

    def test_marriage_wait_and_marry(self):
        r = self.client.post('/api/mcp/winter/marriage-wait', headers=self.h, json={'npc_id': 'npc-004'})
        self.assertEqual(r.json['marriage_wait_years'], 1)
        # already married → refused
        self.assertEqual(self.client.post('/api/mcp/winter/marry', headers=self.h, json={'npc_id': 'npc-001', 'spouse_id': 'npc-003'}).status_code, 409)
        # marry an existing maiden
        r = self.client.post('/api/mcp/winter/marry', headers=self.h, json={'npc_id': 'npc-004', 'spouse_id': 'npc-003'})
        self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual(r.json['relationship']['notes'], 'Married 506 AD')
        n, _ = self._npc('npc-004'); self.assertEqual(n['marriage_wait_years'], 0)
        # a widow may remarry a new NPC
        r = self.client.post('/api/mcp/winter/marry', headers=self.h, json={'npc_id': 'npc-007', 'new_spouse': {'name': 'Sir Newman', 'pronoun': 'he/him', 'role': 'Knight', 'year_born': 478}})
        self.assertEqual(r.status_code, 201, r.json)
        sp, lst = self._npc(r.json['spouse']['id'])
        self.assertEqual((lst, sp['household']), ('living', 'Dawnwell'))
        self.assertEqual(self.client.post('/api/mcp/winter/marry', headers=self.h, json={'npc_id': 'npc-006', 'new_spouse': {}}).status_code, 400)

    def test_add_life_event_glory_and_full_npc(self):
        r = self.client.post('/api/mcp/npc/npc-001/events', headers=self.h, json={'title': 'Plunder Gained', 'year': 506, 'glory': 25})
        self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual(r.json['gloryApplied'], 1225)
        r = self.client.post('/api/mcp/npc/npc-004/events', headers=self.h, json={'title': 'Plunder Gained', 'year': 506, 'glory': 25})
        self.assertIsNone(r.json['gloryApplied']); self.assertIn('renown', r.json['gloryNote'])
        n, _ = self._npc('npc-004'); self.assertEqual(n['glory'], 'Respected')
        r = self.client.patch('/api/mcp/npc/npc-001', headers=self.h, json={'personalityNote': 'Proud, quick to anger', 'courtesy': 15})
        self.assertEqual(r.status_code, 200, r.json)
        r = self.client.get('/api/mcp/npc/npc-001', headers=self.h)
        self.assertEqual(r.json['personalityNote'], 'Proud, quick to anger')
        self.assertEqual(r.json['con'], 14)
        self.assertEqual(len(r.json['soloEvents']), 1)


if __name__ == '__main__':
    unittest.main()
