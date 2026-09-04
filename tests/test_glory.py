"""Run: .venv/bin/python -m unittest discover -s tests

Use an isolated copy of the server so tests never read live secrets or saves.
"""
import importlib.util
import json
import logging
from pathlib import Path
import shutil
import tempfile
import unittest


class GloryApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        server_path = root / 'server.py'
        shutil.copyfile(Path(__file__).resolve().parents[1] / 'server.py', server_path)
        spec = importlib.util.spec_from_file_location('glory_test_server', server_path)
        self.server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.server)
        self.server.log.setLevel(logging.ERROR)
        self.server.MCP_KEY = 'test-only'
        self.save = root / 'binder.json'
        self.save.write_text(json.dumps({'living': [], 'dead': []}))
        (root / 'config.json').write_text(json.dumps({'saveFile': str(self.save)}))
        self.client = self.server.app.test_client()
        self.headers = {'Authorization': 'Bearer test-only'}

    def test_create_update_roundtrip_and_partial_update(self):
        for glory in (0, 4500, 'N/A', *self.server._NPC_RENOWN):
            response = self.client.post('/api/mcp/npc', json={'name': 'Test', 'glory': glory}, headers=self.headers)
            self.assertEqual(response.status_code, 201, response.json)
            npc_id = response.json['id']
            self.assertEqual(response.json['npc']['glory'], glory)
            response = self.client.patch('/api/mcp/npc/' + npc_id, json={'notes': 'An unrelated edit'}, headers=self.headers)
            self.assertEqual(response.status_code, 200, response.json)
            stored = next(n for n in json.loads(self.save.read_text())['living'] if n['id'] == npc_id)
            self.assertEqual(stored['glory'], glory)
            for replacement in ('Respected', 'N/A', 0, 9000):
                response = self.client.patch('/api/mcp/npc/' + npc_id, json={'glory': replacement}, headers=self.headers)
                self.assertEqual(response.status_code, 200, response.json)
                self.assertEqual(response.json['npc']['glory'], replacement)

    def test_invalid_values_rejected_without_writes(self):
        response = self.client.post('/api/mcp/npc', json={'name': 'Test', 'glory': 0}, headers=self.headers)
        npc_id = response.json['id']
        before = self.save.read_text()
        for glory in (-1, 1.5, True, None, 'Unknown', '<script>', 9007199254740992):
            for method, url in ((self.client.post, '/api/mcp/npc'), (self.client.patch, '/api/mcp/npc/' + npc_id)):
                response = method(url, json={'name': 'Test', 'glory': glory}, headers=self.headers)
                self.assertEqual(response.status_code, 400, response.json)
                self.assertEqual(self.save.read_text(), before)
        self.assertEqual(self.client.patch('/api/mcp/npc/' + npc_id, json={'glory': 'Legendary'}).status_code, 401)


if __name__ == '__main__':
    unittest.main()
