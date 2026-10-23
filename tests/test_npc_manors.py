"""Run: .venv/bin/python -m unittest discover -s tests

MCP NPC-manor registry API (the NPC Manors tab's data) and the Glory input
coercion on the NPC routes. Uses an isolated copy of the server and a
synthetic save, so nothing here touches real data.
"""
import importlib.util
import json
import logging
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def _fixture_binder() -> dict:
    return {
        'year': 507,
        'living': [
            {'id': 'npc-001', 'name': 'Sir Edric of Berwick', 'role': 'Knight', 'status': 'Alive', 'year_born': 470, 'glory': 2400},
            {'id': 'npc-002', 'name': 'Sir Jasper of Stapleford', 'role': 'Knight', 'status': 'Alive', 'year_born': 468, 'glory': 'Respected'},
            {'id': 'npc-003', 'name': 'Owain ap Edric', 'role': 'Squire', 'status': 'Alive', 'year_born': 492, 'glory': 'N/A'},
            {'id': 'npc-004', 'name': 'Dame Vesa Blackwood', 'status': 'Alive', 'year_born': 470, 'glory': 5000},
        ],
        'dead': [
            {'id': 'npc-009', 'name': 'Sir Old Gwion', 'role': 'Knight', 'status': 'Dead', 'year_born': 440, 'year_died': 506, 'glory': 3000},
        ],
        'households': [], 'relationships': [], 'chronicle': {},
        'npcManors': [
            {'id': 'nm-import-028', 'name': 'Steeple Langford', 'location': 'Salisbury', 'status': 'Granted',
             'holderId': 'npc-001', 'yearGranted': 495, 'notes': '', 'faction': '',
             'relatedNpcs': [{'npcId': 'npc-002', 'role': 'Steward', 'notes': ''}]},
            {'id': 'nm-import-039', 'name': 'Wilton (Castle/Town)', 'status': 'Granted', 'holderId': 'npc-002', 'yearGranted': 498},
            {'id': 'nm-import-040', 'name': 'Wilton (Manor)', 'status': 'Granted', 'holderId': 'npc-009', 'yearGranted': 490},
            {'id': 'nm-x-melksham', 'name': 'Melksham', 'status': 'Granted', 'holderId': '', 'yearGranted': 507},
        ],
        'manors': {
            'Blackwood': {
                'name': 'Blackwood', 'knight': 'Dame Vesa Blackwood', 'player': 'Zerk', 'lord_id': 'npc-004',
                'hatred': 6, 'care': 10, 'baseHarvest': 11, 'lifestyle': 'Normal', 'improvements': [],
                'propertyDamage': [],
                'vassals': [{'id': 21, 'manorName': 'Steeple Langford', 'tenure': 'Granted', 'knightId': 'npc-001', 'passiveIncome': 1}],
                'history': [{'year': 506, 'treasury': 10, 'prevTreasury': 9, 'family': 4, 'lifestyle': 'Normal'}],
            },
        },
    }


class NpcManorApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        server_path = root / 'server.py'
        shutil.copyfile(ROOT / 'server.py', server_path)
        shutil.copyfile(ROOT / 'manor-ref.json', root / 'manor-ref.json')
        spec = importlib.util.spec_from_file_location('npc_manor_test_server', server_path)
        self.server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.server)
        self.server.log.setLevel(logging.ERROR)
        self.server.MCP_KEY = 'test-only'
        self.binder = _fixture_binder()
        self.save = root / 'binder.json'
        self.save.write_text(json.dumps(self.binder))
        (root / 'config.json').write_text(json.dumps({'saveFile': str(self.save)}))
        self.client = self.server.app.test_client()
        self.h = {'Authorization': 'Bearer test-only'}

    def _disk(self):
        return json.loads(self.save.read_text())

    def _nm(self, nm_id, binder=None):
        return next(m for m in (binder or self._disk())['npcManors'] if m['id'] == nm_id)

    def _chron_texts(self, year):
        return [e['text'] for e in self._disk()['chronicle'].get(str(year), [])]

    # ── reads ──────────────────────────────────────────────────────────────

    def test_list_filters_and_flags(self):
        r = self.client.get('/api/mcp/npc-manors', headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(r.json['count'], 4)
        by = {m['name']: m for m in r.json['manors']}
        self.assertEqual(by['Steeple Langford']['holder']['name'], 'Sir Edric of Berwick')
        self.assertEqual(by['Steeple Langford']['liege'][0]['manor'], 'Blackwood')
        self.assertFalse(by['Steeple Langford']['vacant'])
        self.assertTrue(by['Wilton (Manor)']['vacant'])      # holder dead
        self.assertTrue(by['Wilton (Manor)']['holderDead'])
        self.assertTrue(by['Melksham']['vacant'])            # no holder
        self.assertEqual(r.json['vacantCount'], 2)
        r = self.client.get('/api/mcp/npc-manors?vacant=1', headers=self.h)
        self.assertEqual({m['name'] for m in r.json['manors']}, {'Wilton (Manor)', 'Melksham'})
        r = self.client.get('/api/mcp/npc-manors?q=edric', headers=self.h)
        self.assertEqual([m['name'] for m in r.json['manors']], ['Steeple Langford'])
        self.assertEqual(self.client.get('/api/mcp/npc-manors').status_code, 401)

    def test_get_by_id_name_and_base_name(self):
        for key in ('nm-import-028', 'Steeple Langford', 'steeple langford'):
            r = self.client.get(f'/api/mcp/npc-manor/{key}', headers=self.h)
            self.assertEqual(r.status_code, 200, (key, r.json))
            self.assertEqual(r.json['id'], 'nm-import-028')
        m = r.json
        self.assertEqual(m['relatedNpcs'][0]['name'], 'Sir Jasper of Stapleford')
        self.assertEqual(m['relatedNpcs'][0]['role'], 'Steward')
        self.assertIn('chronicle', m)
        # 'Wilton' is ambiguous (two registry entries) -> 404; a suffixed name resolves
        self.assertEqual(self.client.get('/api/mcp/npc-manor/Wilton', headers=self.h).status_code, 404)
        self.assertEqual(self.client.get('/api/mcp/npc-manor/Wilton (Manor)', headers=self.h).json['id'], 'nm-import-040')
        # names with a slash survive URL-encoding (the MCP tool quotes the key)
        from urllib.parse import quote
        r = self.client.get('/api/mcp/npc-manor/' + quote('Wilton (Castle/Town)', safe=''), headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(r.json['id'], 'nm-import-039')
        r = self.client.post('/api/mcp/npc-manor/' + quote('Wilton (Castle/Town)', safe='') + '/assign',
                             json={'holderId': 'npc-001', 'chronicle': False}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        # a player manor name is redirected, not silently 404'd
        r = self.client.get('/api/mcp/npc-manor/Blackwood', headers=self.h)
        self.assertEqual(r.status_code, 404)
        self.assertIn('player knight', r.json['error'])

    def test_player_manor_routes_point_at_registry(self):
        r = self.client.get('/api/mcp/manor/Steeple Langford', headers=self.h)
        self.assertEqual(r.status_code, 404)
        self.assertIn('NPC vassal manor', r.json['error'])
        self.assertEqual(r.json['npcManorId'], 'nm-import-028')
        r = self.client.patch('/api/mcp/manor/Steeple Langford', json={'notes': 'x'}, headers=self.h)
        self.assertEqual(r.status_code, 404)
        self.assertIn('assign_npc_manor', r.json['error'])
        self.assertEqual(self._disk(), self.binder)

    # ── writes ─────────────────────────────────────────────────────────────

    def test_assign_grant_syncs_vassal_ledger_and_chronicle(self):
        r = self.client.post('/api/mcp/npc-manor/Steeple Langford/assign',
                             json={'holderId': 'npc-002', 'year': 507}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(r.json['manor']['holder']['id'], 'npc-002')
        self.assertEqual(r.json['vassalRowsSynced'], 1)
        d = self._disk()
        self.assertEqual(self._nm('nm-import-028', d)['holderId'], 'npc-002')
        self.assertEqual(self._nm('nm-import-028', d)['status'], 'Granted')
        self.assertEqual(d['manors']['Blackwood']['vassals'][0]['knightId'], 'npc-002')
        self.assertEqual(self._chron_texts(507),
                         ['Sir Jasper of Stapleford became Knight of Steeple Langford (granted)'])
        self.assertEqual(d['chronicle']['507'][0]['cat'], 'political')
        self.assertTrue(d['chronicle']['507'][0]['id'].startswith('ev-'))

    def test_assign_by_unique_name_and_silent_mode(self):
        r = self.client.post('/api/mcp/npc-manor/nm-x-melksham/assign',
                             json={'holderId': 'Sir Jasper of Stapleford', 'chronicle': False, 'status': 'Gifted'}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(self._nm('nm-x-melksham')['holderId'], 'npc-002')
        self.assertEqual(self._nm('nm-x-melksham')['status'], 'Gifted')
        self.assertEqual(self._disk()['chronicle'], {})

    def test_under_age_holder_needs_trustee_or_override(self):
        r = self.client.post('/api/mcp/npc-manor/Steeple Langford/assign',
                             json={'holderId': 'npc-003', 'event': 'inherit'}, headers=self.h)
        self.assertEqual(r.status_code, 400, r.json)
        self.assertIn('not of age', r.json['error'])
        self.assertEqual(self._nm('nm-import-028')['holderId'], 'npc-001')   # nothing written
        r = self.client.post('/api/mcp/npc-manor/Steeple Langford/assign',
                             json={'holderId': 'npc-003', 'event': 'inherit', 'trusteeId': 'npc-002'}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        nm = self._nm('nm-import-028')
        self.assertEqual((nm['holderId'], nm['trusteeId'], nm['status']), ('npc-003', 'npc-002', 'Granted'))
        self.assertTrue(r.json['manor']['inTrust'])
        self.assertEqual(self._chron_texts(507), [
            "Owain ap Edric inherited Steeple Langford after Sir Edric of Berwick's death; "
            "manor held in trust by Sir Jasper of Stapleford until Owain ap Edric comes of age"])
        # come of age -> trust ends, NPC flagged
        r = self.client.post('/api/mcp/npc-manor/Steeple Langford/assign', json={'event': 'assume', 'year': 513}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        d = self._disk()
        self.assertNotIn('trusteeId', self._nm('nm-import-028', d))
        owain = next(n for n in d['living'] if n['id'] == 'npc-003')
        self.assertTrue(owain['came_of_age'])
        self.assertIn('came of age and assumed full control of Steeple Langford', self._chron_texts(513)[0])
        # of_age override on a fresh grant
        r = self.client.post('/api/mcp/npc-manor/Melksham/assign',
                             json={'holderId': 'npc-003', 'of_age': True}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertFalse(r.json['manor']['inTrust'])

    def test_escheat_and_abdication(self):
        r = self.client.post('/api/mcp/npc-manor/Wilton (Manor)/assign', json={'event': 'escheat', 'year': 506}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        nm = self._nm('nm-import-040')
        self.assertEqual((nm['holderId'], nm['status'], nm['yearGranted']), ('', 'Escheated', 506))
        self.assertEqual(self._chron_texts(506), ["Wilton (Manor) escheated to the liege after Sir Old Gwion's death"])
        r = self.client.post('/api/mcp/npc-manor/Steeple Langford/assign',
                             json={'event': 'abdication', 'holderId': 'npc-002'}, headers=self.h)
        self.assertEqual(r.status_code, 400)
        self.assertIn('reason', r.json['error'])
        r = self.client.post('/api/mcp/npc-manor/Steeple Langford/assign',
                             json={'event': 'abdication', 'holderId': 'npc-002', 'reason': 'took holy orders'}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(self._chron_texts(507), [
            'Sir Edric of Berwick abdicated Steeple Langford (took holy orders); '
            'Sir Jasper of Stapleford succeeded as Knight of Steeple Langford'])

    def test_assign_rejects_dead_or_unknown_holder(self):
        for bad in ('npc-009', 'npc-404', 'Nobody'):
            r = self.client.post('/api/mcp/npc-manor/Steeple Langford/assign', json={'holderId': bad}, headers=self.h)
            self.assertEqual(r.status_code, 400, (bad, r.json))
        r = self.client.post('/api/mcp/npc-manor/Steeple Langford/assign', json={}, headers=self.h)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._disk(), self.binder)

    def test_patch_fields_and_silent_holder_change(self):
        r = self.client.patch('/api/mcp/npc-manor/Steeple Langford',
                             json={'notes': 'Rebuilt the hall', 'status': 'Seized', 'yearGranted': 500, 'faction': 'Salisbury'}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(set(r.json['changed']), {'notes', 'status', 'yearGranted', 'faction'})
        nm = self._nm('nm-import-028')
        self.assertEqual((nm['notes'], nm['status'], nm['yearGranted']), ('Rebuilt the hall', 'Seized', 500))
        self.assertEqual(self._disk()['chronicle'], {})
        r = self.client.patch('/api/mcp/npc-manor/Steeple Langford', json={'holderId': 'npc-002'}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(r.json['vassalRowsSynced'], 1)
        self.assertEqual(self._disk()['manors']['Blackwood']['vassals'][0]['knightId'], 'npc-002')
        self.assertEqual(self._disk()['chronicle'], {})
        for bad in ({'status': 'Stolen'}, {'yearGranted': 'soon'}, {'name': ''}, {'name': 'Melksham'}, {}, {'holderId': 'npc-003'}):
            r = self.client.patch('/api/mcp/npc-manor/Steeple Langford', json=bad, headers=self.h)
            self.assertEqual(r.status_code, 400, (bad, r.json))
        r = self.client.patch('/api/mcp/npc-manor/Steeple Langford', json={'holderId': 'npc-003', 'trusteeId': 'npc-002'}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        r = self.client.patch('/api/mcp/npc-manor/Steeple Langford', json={'trusteeId': ''}, headers=self.h)
        self.assertNotIn('trusteeId', self._nm('nm-import-028'))

    def test_create(self):
        r = self.client.post('/api/mcp/npc-manor', json={'name': 'Tilshead', 'holderId': 'npc-002', 'location': 'Salisbury'}, headers=self.h)
        self.assertEqual(r.status_code, 201, r.json)
        m = r.json['manor']
        self.assertTrue(m['id'].startswith('nm-'))
        self.assertEqual((m['status'], m['yearGranted'], m['holder']['id']), ('Granted', 507, 'npc-002'))
        self.assertEqual(self._chron_texts(507), ['Sir Jasper of Stapleford became Knight of Tilshead (granted)'])
        self.assertEqual(len(self._disk()['npcManors']), 5)
        r = self.client.post('/api/mcp/npc-manor', json={'name': 'tilshead'}, headers=self.h)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.post('/api/mcp/npc-manor', json={'name': ''}, headers=self.h).status_code, 400)
        r = self.client.post('/api/mcp/npc-manor', json={'name': 'Vacant Hall', 'status': 'Escheated'}, headers=self.h)
        self.assertEqual(r.status_code, 201, r.json)
        self.assertTrue(r.json['manor']['vacant'])
        self.assertIsNone(r.json['chronicleEntry'])


class GloryCoercionTests(NpcManorApiTests):
    """The Claude.ai MCP client sends int|str tool arguments as text — '1500'
    used to be refused with a 400 on every attempt."""

    def _glory(self, npc_id):
        d = self._disk()
        return next(n for n in d['living'] + d['dead'] if n['id'] == npc_id)['glory']

    def test_numeric_strings_and_integral_floats_are_exact_scores(self):
        for raw, want in (('1500', 1500), (' 2,400 ', 2400), (1500.0, 1500), ('+25', 25), ('0', 0)):
            r = self.client.patch('/api/mcp/npc/npc-001', json={'glory': raw}, headers=self.h)
            self.assertEqual(r.status_code, 200, (raw, r.json))
            self.assertEqual(self._glory('npc-001'), want)
            self.assertIs(type(self._glory('npc-001')), int)
        r = self.client.post('/api/mcp/npc', json={'name': 'Newcomer', 'glory': '120'}, headers=self.h)
        self.assertEqual(r.status_code, 201, r.json)
        self.assertEqual(r.json['npc']['glory'], 120)

    def test_categories_case_insensitive_and_garbage_still_refused(self):
        r = self.client.patch('/api/mcp/npc/npc-001', json={'glory': 'veteran'}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(self._glory('npc-001'), 'Veteran')
        r = self.client.patch('/api/mcp/npc/npc-001', json={'glory': 'n/a'}, headers=self.h)
        self.assertEqual(self._glory('npc-001'), 'N/A')
        for bad in ('lots', '-5', '12.5', 12.5, True, None, [1]):
            r = self.client.patch('/api/mcp/npc/npc-002', json={'glory': bad}, headers=self.h)
            self.assertEqual(r.status_code, 400, (bad, r.json))
        self.assertEqual(self._glory('npc-002'), 'Respected')

    def test_glory_add(self):
        r = self.client.patch('/api/mcp/npc/npc-001', json={'glory_add': 50}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(self._glory('npc-001'), 2450)
        self.assertEqual(r.json['gloryNote'], 'Glory 2400 + 50 = 2450')
        r = self.client.patch('/api/mcp/npc/npc-001', json={'glory_add': '-100', 'notes': 'Lost a duel'}, headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(self._glory('npc-001'), 2350)
        self.assertEqual(set(r.json['changed']), {'glory', 'notes'})
        # floors at zero
        self.client.patch('/api/mcp/npc/npc-001', json={'glory_add': -99999}, headers=self.h)
        self.assertEqual(self._glory('npc-001'), 0)
        # refused for category / N/A holders, with a useful message, and nothing written
        for npc_id in ('npc-002', 'npc-003'):
            r = self.client.patch('/api/mcp/npc/' + npc_id, json={'glory_add': 10}, headers=self.h)
            self.assertEqual(r.status_code, 400, r.json)
            self.assertIn('Cannot add Glory', r.json['error'])
        self.assertEqual(self._glory('npc-002'), 'Respected')
        # not both at once; not garbage
        self.assertEqual(self.client.patch('/api/mcp/npc/npc-001', json={'glory': 5, 'glory_add': 5}, headers=self.h).status_code, 400)
        self.assertEqual(self.client.patch('/api/mcp/npc/npc-001', json={'glory_add': 'ten'}, headers=self.h).status_code, 400)


if __name__ == '__main__':
    unittest.main()
