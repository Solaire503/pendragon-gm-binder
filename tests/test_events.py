"""Run: .venv/bin/python -m unittest discover -s tests

MCP life-event endpoints keep the auto chronicle mirror in step with the
event (same behaviour as STORE.updateSoloEvent / deleteSoloEvent).
"""
import importlib.util
import json
import logging
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class EventMirrorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        server_path = root / 'server.py'
        shutil.copyfile(ROOT / 'server.py', server_path)
        spec = importlib.util.spec_from_file_location('event_test_server', server_path)
        self.server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.server)
        self.server.log.setLevel(logging.ERROR)
        self.server.MCP_KEY = 'test-only'
        self.save = root / 'binder.json'
        self.save.write_text(json.dumps({
            'year': 506, 'living': [{'id': 'npc-001', 'name': 'Sir Test', 'status': 'Alive'}], 'dead': [],
            'chronicle': {'505': [{'id': 'ev-hand', 'text': 'GM-penned line', 'cat': 'personal', 'ts': 1}]},
        }))
        (root / 'config.json').write_text(json.dumps({'saveFile': str(self.save)}))
        self.client = self.server.app.test_client()
        self.h = {'Authorization': 'Bearer test-only'}

    def _chron(self):
        return json.loads(self.save.read_text())['chronicle']

    def test_edit_and_delete_keep_mirror_in_sync(self):
        r = self.client.post('/api/mcp/npc/npc-001/events', headers=self.h,
                             json={'title': 'Good Fortune', 'year': 505, 'season': 'summer', 'flavorText': 'Prose.'})
        self.assertEqual(r.status_code, 201, r.json)
        ev_id = r.json['event']['id']
        mirror = [e for e in self._chron()['505'] if e.get('sourceEventId') == ev_id]
        self.assertEqual(len(mirror), 1)
        self.assertEqual(mirror[0]['text'], 'Sir Test — Good Fortune')

        # Title + year change → mirror text rewritten and moved to the new year
        r = self.client.patch(f'/api/mcp/npc/npc-001/events/{ev_id}', headers=self.h,
                              json={'title': 'Bad Fortune', 'year': 506})
        self.assertEqual(r.status_code, 200, r.json)
        chron = self._chron()
        self.assertFalse(any(e.get('sourceEventId') == ev_id for e in chron['505']))
        moved = [e for e in chron['506'] if e.get('sourceEventId') == ev_id]
        self.assertEqual(moved[0]['text'], 'Sir Test — Bad Fortune')
        self.assertTrue(moved[0]['auto'])
        # Hand-written entry untouched
        self.assertEqual(chron['505'][0]['text'], 'GM-penned line')

        # flavorText-only edit leaves the mirror alone but still succeeds
        r = self.client.patch(f'/api/mcp/npc/npc-001/events/{ev_id}', headers=self.h, json={'flavorText': 'New prose.'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len([e for e in self._chron()['506'] if e.get('sourceEventId') == ev_id]), 1)

        # Delete removes the mirror, keeps GM lines
        r = self.client.delete(f'/api/mcp/npc/npc-001/events/{ev_id}', headers=self.h)
        self.assertEqual(r.status_code, 200, r.json)
        chron = self._chron()
        self.assertFalse(any(e.get('sourceEventId') == ev_id for lst in chron.values() for e in lst))
        self.assertEqual(chron['505'][0]['id'], 'ev-hand')


if __name__ == '__main__':
    unittest.main()
