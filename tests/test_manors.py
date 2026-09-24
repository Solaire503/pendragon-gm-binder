"""Run: .venv/bin/python -m unittest discover -s tests

MCP manor API: read shapes, the Record Year mirror (checked against a real
ledger year), edits with treasury ripple, damage and improvement writes.
Uses an isolated copy of the server plus a copy of the live save, so nothing
here touches real data.
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
    """A trimmed save with two manors so shared-weather and lookups are testable."""
    live = ROOT / 'binder-save.json'
    if live.exists():
        b = json.loads(live.read_text(encoding='utf-8'))
        manors = b.get('manors') or {}
        if 'Blackwood' in manors and 'Cador' in manors:
            return b
    # Minimal synthetic fallback (repo checkouts without a save file).
    return {
        'year': 506, 'living': [
            {'id': 'npc-001', 'name': 'Vesa Blackwood', 'pronoun': 'she/her', 'status': 'Alive'},
            {'id': 'npc-002', 'name': 'Lucan Corvus', 'status': 'Alive'},
        ], 'dead': [], 'households': [], 'relationships': [], 'chronicle': {}, 'npcManors': [
            {'id': 'nm-1', 'name': 'Bedwyn', 'status': 'held', 'holderId': 'npc-002'},
        ],
        'manors': {
            'Blackwood': {
                'name': 'Blackwood', 'knight': 'Dame Vesa Blackwood', 'player': 'Zerk',
                'hatred': 6, 'care': 10, 'baseHarvest': 11, 'lifestyle': 'Normal', 'notes': '',
                'lord_id': 'npc-001', 'steward_id': 'npc-002', 'steward_skill': 13, 'dvBase': 0,
                'improvements': [
                    {'id': 1, 'name': 'Apiary', 'cat': 'improvement', 'status': 'active', 'yearBuilt': 488,
                     'buildCost': 2, 'maintenance': 1, 'dvMod': 0, 'income': 0},
                    {'id': 2, 'name': 'Palisade', 'cat': 'fortification', 'status': 'active', 'yearBuilt': 490,
                     'buildCost': 5, 'maintenance': 3, 'dvMod': 5, 'income': 4},
                ],
                'propertyDamage': [
                    {'id': 11, 'type': 'Field', 'description': 'Fields burned', 'numFields': 2, 'status': 'damaged',
                     'repairCost': 0, 'yearApplied': 505},
                ],
                'vassals': [{'id': 21, 'manorName': 'Bedwyn', 'tenure': 'Gifted', 'knightId': 'npc-002', 'passiveIncome': 1}],
                'history': [
                    {'year': 504, 'treasury': 17, 'prevTreasury': 15, 'family': 5, 'lifestyle': 'Normal', 'fateWeather': 12},
                    {'year': 505, 'luck': 'Calamity', 'luckSeason': '—', 'conflict': 'Raided', 'conflictSeason': 'Winter',
                     'conflictRoll': 0, 'siegeSuccess': False, 'presSword': False, 'presBattle': False, 'presValorous': False,
                     'harvestOutcome': 'Bad', 'harvestIncome': 4, 'stewardIndustry': 0, 'improvIncome': 4, 'discretionary': 0,
                     'extraManorial': 0, 'vassalIncome': 1, 'miscIncomeItems': [], 'lifestyle': 'Normal', 'lifestyleCost': 4,
                     'improvMaint': 4, 'family': 5, 'improvBuild': 0, 'miscExpItems': [], 'prevTreasury': 17, 'treasury': 13,
                     'fateWeather': 18, 'fateConflict': 0, 'fateCommoners': -5, 'fatePresence': 0, 'fateMisc': 0,
                     'stewardResult': 'Failure', 'fateResult': 'Success', 'tiebreaker': '—', 'notes': '', 'notes2': ''},
                ],
            },
            'Cador': {
                'name': 'Cador', 'knight': 'Sir Aberthol Cador', 'player': 'Dan', 'hatred': 2, 'care': 8,
                'baseHarvest': 10, 'lifestyle': 'Normal', 'improvements': [], 'propertyDamage': [], 'vassals': [],
                'history': [{'year': 505, 'treasury': 14.5, 'prevTreasury': 12, 'family': 4, 'lifestyle': 'Normal', 'fateWeather': 18}],
            },
        },
    }


class ManorApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        server_path = root / 'server.py'
        shutil.copyfile(ROOT / 'server.py', server_path)
        shutil.copyfile(ROOT / 'manor-ref.json', root / 'manor-ref.json')
        spec = importlib.util.spec_from_file_location('manor_test_server', server_path)
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

    # ── reads ──────────────────────────────────────────────────────────────

    def test_list_and_lookup_aliases(self):
        r = self.client.get('/api/mcp/manors', headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        keys = {m['key'] for m in r.json['manors']}
        self.assertIn('Blackwood', keys)
        bw = next(m for m in r.json['manors'] if m['key'] == 'Blackwood')
        self.assertEqual(bw['knight'], 'Dame Vesa Blackwood')
        self.assertEqual(bw['treasury'], self.binder['manors']['Blackwood']['history'][-1]['treasury'])
        for alias in ('blackwood', 'Zerk', 'Dame Vesa Blackwood', 'vesa blackwood'):
            r = self.client.get(f'/api/mcp/manor/{alias}', headers=self.h)
            self.assertEqual(r.status_code, 200, (alias, r.json))
            self.assertEqual(r.json['key'], 'Blackwood')
        self.assertEqual(self.client.get('/api/mcp/manor/Camelot', headers=self.h).status_code, 404)
        self.assertEqual(self.client.get('/api/mcp/manors').status_code, 401)

    def test_get_manor_shape(self):
        r = self.client.get('/api/mcp/manor/Blackwood?history=2', headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        m = r.json
        for fld in ('personnel_missing_is_fine', ):
            pass
        for fld in ('improvements', 'propertyDamage', 'vassals', 'stables', 'history', 'historyYears',
                    'recordYearDefaults', 'lord', 'steward', 'heir', 'dv', 'treasury'):
            self.assertIn(fld, m)
        self.assertEqual(len(m['history']), 2)
        self.assertEqual(m['history'][-1]['year'], m['historyYears'][-1])
        src = self.binder['manors']['Blackwood']
        active = [i for i in src['improvements'] if i['status'] == 'active']
        d = m['recordYearDefaults']
        self.assertEqual(d['improvMaint'], sum(i.get('maintenance', 0) for i in active))
        self.assertEqual(d['improvIncome'], sum(i.get('income', 0) for i in active))
        self.assertEqual(d['vassalIncome'], sum(v.get('passiveIncome', 1) for v in src['vassals']))
        self.assertEqual(d['prevTreasury'], src['history'][-1]['treasury'])
        self.assertEqual(d['family'], src['history'][-1].get('family', 0))
        self.assertEqual(m['steward']['id'], src['steward_id'])
        self.assertEqual(m['vassals'][0]['registry']['id'] is not None, True)
        r = self.client.get('/api/mcp/manor/Blackwood/year/505', headers=self.h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json['entry']['year'], 505)
        self.assertEqual(self.client.get('/api/mcp/manor/Blackwood/year/300', headers=self.h).status_code, 404)

    def test_reference(self):
        r = self.client.get('/api/mcp/manor-reference', headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        ref = r.json
        self.assertEqual(len(ref['bookOfTheManor']['luckRows']), 6)
        self.assertEqual(len(ref['bookOfTheManor']['destruction']), 22)
        self.assertEqual(ref['harvest']['table']['Success']['Success'], None)
        self.assertEqual(ref['lifestyleCost']['Normal'], 4)
        self.assertIn('improvement.status', ref['fieldValues'])

    # ── record year ────────────────────────────────────────────────────────

    @staticmethod
    def _items(items, legacy):
        # Older ledger years hold a single misc total; the Binder seeds one row from it.
        if isinstance(items, list) and items:
            return items
        return [{'amount': legacy, 'note': ''}] if legacy else []

    @classmethod
    def _self_consistent(cls, h):
        n = lambda f: h.get(f) or 0
        tin = (n('harvestIncome') + n('stewardIndustry') + n('improvIncome') + n('discretionary') + n('extraManorial')
               + sum(i['amount'] for i in cls._items(h.get('miscIncomeItems'), h.get('miscIncome'))) + n('vassalIncome'))
        tout = (n('lifestyleCost') + n('improvMaint') + n('family') + n('improvBuild')
                + sum(i['amount'] for i in cls._items(h.get('miscExpItems'), h.get('miscExp'))))
        return abs(round(n('prevTreasury') + tin - tout, 1) - n('treasury')) < 0.05

    def _replay_inputs(self, h):
        return {
            'year': h['year'], 'stewardResult': h['stewardResult'], 'fateResult': h['fateResult'],
            'tiebreaker': None if h.get('tiebreaker') in (None, '—') else h['tiebreaker'],
            'luck': h['luck'], 'luckSeason': h['luckSeason'], 'conflict': h['conflict'],
            'conflictSeason': h['conflictSeason'], 'fateWeather': h['fateWeather'],
            'fateConflict': h['fateConflict'], 'fateCommoners': h['fateCommoners'],
            'fatePresence': h['fatePresence'], 'fateMisc': h['fateMisc'],
            'stewardIndustry': h['stewardIndustry'], 'improvIncome': h['improvIncome'],
            'discretionary': h['discretionary'], 'extraManorial': h['extraManorial'],
            'miscIncomeItems': self._items(h.get('miscIncomeItems'), h.get('miscIncome')), 'lifestyle': h['lifestyle'],
            'improvMaint': h['improvMaint'], 'family': h['family'], 'improvBuild': h['improvBuild'],
            'miscExpItems': self._items(h.get('miscExpItems'), h.get('miscExp')), 'prevTreasury': h['prevTreasury'],
            'harvestIncome': h['harvestIncome'], 'notes': h.get('notes', ''), 'notes2': h.get('notes2', ''),
        }

    def test_replaying_a_real_year_reproduces_the_ledger(self):
        """Feed every recorded year's inputs back through the server and expect the
        same harvest outcome and closing treasury the Binder's form produced."""
        checked = 0
        for key, m in self.binder['manors'].items():
            for h in m['history']:
                if 'stewardResult' not in h or h['stewardResult'] == '—' or h.get('harvestOutcome') is None:
                    continue
                if not self._self_consistent(h):
                    continue  # hand-typed treasury from the pre-form spreadsheet era
                body = {**self._replay_inputs(h), 'dry_run': True, 'overwrite': True}
                body = {k: v for k, v in body.items() if v is not None}
                r = self.client.post(f'/api/mcp/manor/{key}/year', json=body, headers=self.h)
                self.assertEqual(r.status_code, 200, (key, h['year'], r.json))
                e = r.json['entry']
                # Explicit harvestOutcome wins when the stored one disagrees with the table
                # (older entries predate the tiebreaker), so compare income + treasury.
                self.assertEqual(e['harvestIncome'], h['harvestIncome'], (key, h['year']))
                # Vassal income is always computed from today's vassal list, which
                # years recorded before the vassal existed never included.
                vassal_shift = e['vassalIncome'] - (h.get('vassalIncome') or 0)
                self.assertAlmostEqual(e['treasury'], h['treasury'] + vassal_shift, places=1, msg=(key, h['year']))
                checked += 1
        self.assertGreaterEqual(checked, 1 if len(self.binder['manors']) < 4 else 8)
        self.assertEqual(self._disk(), self.binder, 'dry runs must not write')

    def test_record_year_derives_and_defaults(self):
        src = self.binder['manors']['Blackwood']
        r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h, json={
            'dry_run': True, 'stewardResult': 'Success', 'fateResult': 'Failure',
            'conflict': 'Pillaged', 'conflictRoll': 9, 'presSword': True, 'presBattle': True,
            'fateCommoners': -5,
        })
        self.assertEqual(r.status_code, 200, r.json)
        e, b = r.json['entry'], r.json['breakdown']
        self.assertEqual(e['year'], self.binder['year'])
        self.assertEqual(e['harvestOutcome'], 'Good')
        damaged_fields = sum(d.get('numFields') or 0 for d in src['propertyDamage']
                             if d['status'] == 'damaged' and d['type'] == 'Field')
        self.assertEqual(e['harvestIncome'], max(0, self.server._js_round(src['baseHarvest'] * 1.5) - damaged_fields))
        self.assertEqual(b['harvest']['damagedFieldPenalty'], damaged_fields)
        self.assertEqual(b['conflict']['reduction'], 2)
        self.assertEqual(e['fateConflict'], 7)
        self.assertEqual(b['conflict']['propertyDamageRollModifier'], 3)
        self.assertEqual(e['lifestyle'], src['history'][-1]['lifestyle'])
        self.assertEqual(e['family'], src['history'][-1]['family'])
        self.assertEqual(e['prevTreasury'], src['history'][-1]['treasury'])
        self.assertEqual(e['lifestyleCost'], 4)
        self.assertAlmostEqual(e['treasury'], round(e['prevTreasury'] + b['totalIn'] - b['totalOut'], 1))
        self.assertTrue(any('carried forward' in d for d in b['defaultsApplied']))
        self.assertEqual(self._disk(), self.binder)

        # Tie needs a tiebreaker; Bandits are never reduced; siege adds DV
        r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h,
                             json={'dry_run': True, 'stewardResult': 'Success', 'fateResult': 'Success'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('tiebreaker', r.json['error'])
        r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h, json={
            'dry_run': True, 'stewardResult': 'Success', 'fateResult': 'Success', 'tiebreaker': 'lose',
            'conflict': 'Bandits', 'conflictRoll': 4, 'presSword': True, 'siegeSuccess': True})
        self.assertEqual(r.json['entry']['harvestOutcome'], 'Meager')
        self.assertEqual(r.json['entry']['fateConflict'], 4)
        self.assertIsNone(r.json['breakdown']['conflict']['propertyDamageRollModifier'])
        r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h, json={
            'dry_run': True, 'harvestOutcome': 'Regular', 'conflict': 'Plundered', 'conflictRoll': 14, 'siegeSuccess': True})
        dv = r.json['breakdown']['conflict']['manorDV']
        self.assertEqual(r.json['entry']['fateConflict'], max(0, 14 - dv))

    def test_record_year_commit_conflict_overwrite_and_weather(self):
        year = self.binder['year']
        # Cador first — seeds this year's weather for Blackwood
        r = self.client.post('/api/mcp/manor/Cador/year', headers=self.h, json={
            'dry_run': False, 'stewardResult': 'Critical', 'fateResult': 'Failure', 'fateWeather': 15,
            'hatred': 3, 'care': 9})
        self.assertEqual(r.status_code, 201, r.json)
        disk = self._disk()
        self.assertEqual(disk['manors']['Cador']['history'][-1]['year'], year)
        self.assertEqual(disk['manors']['Cador']['hatred'], 3)
        self.assertEqual(disk['manors']['Cador']['care'], 9)
        r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h, json={
            'dry_run': False, 'stewardResult': 'Failure', 'fateResult': 'Failure',
            'miscIncomeItems': [{'amount': 2, 'note': 'Ransom'}], 'miscExpItems': [{'amount': 1.5, 'note': 'Gift'}]})
        self.assertEqual(r.status_code, 201, r.json)
        e = r.json['entry']
        self.assertEqual(e['fateWeather'], 15)
        self.assertTrue(any('carried from Cador' in d for d in r.json['breakdown']['defaultsApplied']))
        self.assertEqual(e['miscIncomeItems'][0]['note'], 'Ransom')
        self.assertEqual(r.json['breakdown']['totalOut'], e['lifestyleCost'] + e['improvMaint'] + e['family'] + 1.5)
        # Duplicate → 409, overwrite → replaced
        r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h,
                             json={'dry_run': False, 'harvestOutcome': 'Regular'})
        self.assertEqual(r.status_code, 409)
        r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h,
                             json={'dry_run': False, 'overwrite': True, 'harvestOutcome': 'Regular'})
        self.assertEqual(r.status_code, 201, r.json)
        self.assertTrue(r.json['replaced'])
        hist = self._disk()['manors']['Blackwood']['history']
        self.assertEqual(sum(1 for h in hist if h['year'] == year), 1)
        self.assertEqual(hist[-1]['harvestOutcome'], 'Regular')
        self.assertEqual(hist, sorted(hist, key=lambda h: h['year']))

    def test_bad_inputs_rejected_without_writes(self):
        before = self.save.read_text()
        bad = [
            {'stewardResult': 'Great'}, {'harvestOutcome': 'Regular', 'luck': 'Jackpot'},
            {'harvestOutcome': 'Regular', 'family': 'four'}, {'harvestOutcome': 'Regular', 'family': -1},
            {'harvestOutcome': 'Regular', 'siegeSuccess': 'yes'}, {'harvestOutcome': 'Regular', 'year': True},
            {'harvestOutcome': 'Regular', 'miscExpItems': [{'amount': -3}]},
            {'harvestOutcome': 'Regular', 'miscExpItems': 'lots'}, {},
        ]
        for body in bad:
            r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h, json={**body, 'dry_run': False})
            self.assertEqual(r.status_code, 400, (body, r.json))
        self.assertEqual(self.client.post('/api/mcp/manor/Blackwood/year', json={'harvestOutcome': 'Regular'}).status_code, 401)
        self.assertEqual(self.client.post('/api/mcp/manor/Nowhere/year', headers=self.h,
                                          json={'harvestOutcome': 'Regular'}).status_code, 404)
        self.assertEqual(self.save.read_text(), before)

    # ── update / delete year ───────────────────────────────────────────────

    def test_update_year_recomputes_and_ripples(self):
        src = self.binder['manors']['Blackwood']['history']
        target = src[-1]
        year = target['year']
        # Add a later year so the ripple has somewhere to go
        r = self.client.post('/api/mcp/manor/Blackwood/year', headers=self.h,
                             json={'dry_run': False, 'year': year + 1, 'harvestOutcome': 'Regular'})
        self.assertEqual(r.status_code, 201, r.json)
        later_before = r.json['entry']['treasury']
        r = self.client.patch(f'/api/mcp/manor/Blackwood/year/{year}', headers=self.h,
                              json={'discretionary': (target.get('discretionary') or 0) + 3, 'lifestyle': 'Rich'})
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(r.json['entry']['lifestyleCost'], 8)
        expected_delta = round(3 - (8 - target['lifestyleCost']), 1)
        self.assertAlmostEqual(r.json['treasuryDelta'], expected_delta, places=1)
        self.assertEqual(r.json['rippledYears'], [])
        self.assertEqual(r.json['laterYears'], [year + 1])
        self.assertIsNotNone(r.json['hint'])
        # nothing rippled yet
        self.assertEqual(self._disk()['manors']['Blackwood']['history'][-1]['treasury'], later_before)
        r = self.client.patch(f'/api/mcp/manor/Blackwood/year/{year}', headers=self.h,
                              json={'notes': 'edited via MCP', 'ripple_treasury': True})
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(r.json['treasuryDelta'], 0)  # totals unchanged this call
        # ripple applies to a real delta
        r = self.client.patch(f'/api/mcp/manor/Blackwood/year/{year}', headers=self.h,
                              json={'extraManorial': 10, 'ripple_treasury': True})
        self.assertEqual(r.json['rippledYears'], [year + 1])
        hist = self._disk()['manors']['Blackwood']['history']
        # Only this call's delta ripples; the earlier −1 was declined.
        self.assertAlmostEqual(hist[-1]['treasury'], later_before + 10 - (target.get('extraManorial') or 0), places=1)
        self.assertEqual(hist[-2]['notes'], 'edited via MCP')
        # explicit treasury wins, bad enum rejected, unknown year 404
        r = self.client.patch(f'/api/mcp/manor/Blackwood/year/{year}', headers=self.h, json={'treasury': 99})
        self.assertEqual(r.json['entry']['treasury'], 99)
        self.assertEqual(self.client.patch(f'/api/mcp/manor/Blackwood/year/{year}', headers=self.h,
                                           json={'conflict': 'Dragons'}).status_code, 400)
        self.assertEqual(self.client.patch('/api/mcp/manor/Blackwood/year/300', headers=self.h,
                                           json={'notes': 'x'}).status_code, 404)
        # delete
        r = self.client.delete(f'/api/mcp/manor/Blackwood/year/{year}', headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        self.assertIn('later year', r.json['warning'])
        self.assertNotIn(year, [h['year'] for h in self._disk()['manors']['Blackwood']['history']])
        self.assertEqual(self.client.delete(f'/api/mcp/manor/Blackwood/year/{year}', headers=self.h).status_code, 404)

    # ── manor stats, damage, improvements ──────────────────────────────────

    def test_update_manor_stats(self):
        r = self.client.patch('/api/mcp/manor/Cador', headers=self.h, json={'hatred': 4, 'lifestyle': 'Poor', 'notes': 'n'})
        self.assertEqual(r.status_code, 200, r.json)
        m = self._disk()['manors']['Cador']
        self.assertEqual((m['hatred'], m['lifestyle'], m['notes']), (4, 'Poor', 'n'))
        self.assertEqual(self.client.patch('/api/mcp/manor/Cador', headers=self.h, json={'hatred': -1}).status_code, 400)
        self.assertEqual(self.client.patch('/api/mcp/manor/Cador', headers=self.h, json={'knight': 'Sir X'}).status_code, 400)

    def test_damage_lifecycle_affects_harvest(self):
        before = self.client.get('/api/mcp/manor/Cador', headers=self.h).json['recordYearDefaults']['damagedFieldPenalty']
        r = self.client.post('/api/mcp/manor/Cador/damage', headers=self.h, json={'type': 'Field', 'numFields': 3})
        self.assertEqual(r.status_code, 201, r.json)
        d = r.json['damage']
        self.assertEqual(d['description'], '3 fields damaged')
        self.assertEqual(d['yearApplied'], self.binder['year'])
        self.assertEqual(r.json['damagedFields'], before + 3)
        r = self.client.post('/api/mcp/manor/Cador/year', headers=self.h,
                             json={'dry_run': True, 'harvestOutcome': 'Regular'})
        self.assertEqual(r.json['entry']['harvestIncome'], max(0, self.binder['manors']['Cador']['baseHarvest'] - before - 3))
        r = self.client.patch(f"/api/mcp/manor/Cador/damage/{d['id']}", headers=self.h, json={'status': 'repaired'})
        self.assertEqual(r.status_code, 200, r.json)
        self.assertEqual(r.json['damage']['yearRepaired'], self.binder['year'])
        self.assertEqual(r.json['damagedFields'], before)
        self.assertEqual(self.client.post('/api/mcp/manor/Cador/damage', headers=self.h, json={'type': 'General'}).status_code, 400)
        self.assertEqual(self.client.patch('/api/mcp/manor/Cador/damage/0', headers=self.h, json={'status': 'repaired'}).status_code, 404)

    def test_improvement_lifecycle_affects_defaults(self):
        base = self.client.get('/api/mcp/manor/Cador', headers=self.h).json
        r = self.client.post('/api/mcp/manor/Cador/improvement', headers=self.h, json={
            'name': 'Mill', 'cat': 'improvement', 'buildCost': 6, 'maintenance': 1, 'income': 2, 'dvMod': 0})
        self.assertEqual(r.status_code, 201, r.json)
        i = r.json['improvement']
        self.assertEqual(i['status'], 'active')
        self.assertEqual(i['yearBuilt'], self.binder['year'])
        self.assertIn('6 L', r.json['hint'])
        after = self.client.get('/api/mcp/manor/Cador', headers=self.h).json
        self.assertEqual(after['recordYearDefaults']['improvIncome'], base['recordYearDefaults']['improvIncome'] + 2)
        self.assertEqual(after['recordYearDefaults']['improvMaint'], base['recordYearDefaults']['improvMaint'] + 1)
        r = self.client.patch(f"/api/mcp/manor/Cador/improvement/{i['id']}", headers=self.h, json={'status': 'damaged'})
        self.assertEqual(r.status_code, 200, r.json)
        after = self.client.get('/api/mcp/manor/Cador', headers=self.h).json
        self.assertEqual(after['recordYearDefaults']['improvIncome'], base['recordYearDefaults']['improvIncome'])
        r = self.client.post('/api/mcp/manor/Cador/improvement', headers=self.h, json={'name': 'Wall', 'cat': 'fortification', 'dvMod': 5})
        self.assertEqual(self.client.get('/api/mcp/manor/Cador', headers=self.h).json['dv'], base['dv'] + 5)
        self.assertEqual(self.client.post('/api/mcp/manor/Cador/improvement', headers=self.h, json={'cat': 'improvement'}).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/mcp/manor/Cador/improvement/{i['id']}", headers=self.h,
                                           json={'status': 'burned'}).status_code, 400)


if __name__ == '__main__':
    unittest.main()
