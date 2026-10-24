"""Run: mcp-venv/bin/python -m unittest tests.test_discord_tools

Discord tools for the MCP server (discord_tools.py). Discord's REST API is
replaced with an httpx MockTransport, so nothing here touches the real
server; the one live smoke test lives in the session notes, not here.
"""
import datetime as dt
import json
import sys
import unittest
from pathlib import Path

try:
    import httpx
except ImportError:  # .venv has no httpx; the mcp-venv does
    raise unittest.SkipTest("httpx not installed — run with mcp-venv/bin/python")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import discord_tools as D  # noqa: E402

GUILD = "544687189574025216"
BOT_ID = "1466790308506374164"
KNIGHTS = "1225127050508238930"

SECRETS = {
    "DISCORD_TOKEN": "x",
    "DISCORD_GUILD_ID": GUILD,
    "DISCORD_WRITE_CATEGORY": "The Round Table",
    "DISCORD_KNIGHT_ROLE_ID": KNIGHTS,
    "DISCORD_DEFAULT_TZ": "America/Los_Angeles",
}

CHANNELS = [
    {"id": "10", "type": 4, "name": "The Round Table", "position": 0},
    {"id": "20", "type": 4, "name": "Archived Channels", "position": 1},
    {"id": "30", "type": 4, "name": "D&D Campaign Chat", "position": 2},
    {"id": "100", "type": 0, "name": "gm-solar", "parent_id": "10", "position": 5},
    {"id": "101", "type": 0, "name": "court-of-schedules", "parent_id": "10", "position": 8},
    {"id": "102", "type": 0, "name": "knightly-chat", "parent_id": "10", "position": 1},
    {"id": "103", "type": 15, "name": "library-of-camelot", "parent_id": "10", "position": 7},
    {"id": "104", "type": 2, "name": "The Court", "parent_id": "10", "position": 0},
    {"id": "200", "type": 0, "name": "scheduling", "parent_id": "20", "position": 0},
    {"id": "300", "type": 0, "name": "general-chat", "parent_id": "30", "position": 0},
    {"id": "301", "type": 0, "name": "general-chat", "position": 0},
]


class FakeDiscord:
    """Records requests and answers the handful of endpoints the tools use."""

    def __init__(self):
        self.calls = []
        self.messages = {}
        self.reactions = {}      # message_id -> {emoji: [user dicts]}
        self.poll_votes = {}     # message_id -> {answer_id: [user dicts]}
        self.next_id = 500
        self.rate_limit_once = False

    def transport(self):
        return httpx.MockTransport(self.handle)

    def handle(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path.replace("/api/v10", "")
        body = json.loads(request.content) if request.content else None
        self.calls.append((request.method, path, body))
        if self.rate_limit_once:
            self.rate_limit_once = False
            return httpx.Response(429, json={"retry_after": 0.01, "global": False})
        if path == "/users/@me":
            return httpx.Response(200, json={"id": BOT_ID, "username": "Caliburn Dice Roller", "bot": True})
        if path == f"/guilds/{GUILD}/channels":
            return httpx.Response(200, json=CHANNELS)
        if path.startswith(f"/guilds/{GUILD}/members/"):
            uid = path.rsplit("/", 1)[-1]
            return httpx.Response(200, json={"nick": {"1": "Steve", "2": "Rich"}.get(uid), "user": {"id": uid}})
        if path.endswith("/messages") and request.method == "POST":
            self.next_id += 1
            mid = str(self.next_id)
            msg = {"id": mid, "author": {"id": BOT_ID, "bot": True, "username": "Caliburn Dice Roller"},
                   "channel_id": path.split("/")[2], "timestamp": "2026-10-24T06:00:00.000000+00:00",
                   "content": body.get("content", ""), "embeds": body.get("embeds", [])}
            if body.get("poll"):
                p = body["poll"]
                msg["poll"] = {"question": p["question"],
                               "answers": [{"answer_id": i + 1, "poll_media": a["poll_media"]} for i, a in enumerate(p["answers"])],
                               "expiry": "2026-10-25T06:00:00+00:00", "allow_multiselect": p["allow_multiselect"],
                               "results": {"is_finalized": False, "answer_counts": []}}
            self.messages[mid] = msg
            return httpx.Response(200, json=msg)
        if path.endswith("/messages") and request.method == "GET":
            msgs = sorted(self.messages.values(), key=lambda m: int(m["id"]), reverse=True)
            return httpx.Response(200, json=msgs[: int(request.url.params.get("limit", 50))])
        parts = path.strip("/").split("/")
        if len(parts) >= 4 and parts[2] == "messages":
            mid = parts[3]
            if mid not in self.messages:
                return httpx.Response(404, json={"message": "Unknown Message", "code": 10008})
            msg = self.messages[mid]
            if len(parts) == 4:
                if request.method == "GET":
                    out = dict(msg)
                    if mid in self.reactions:
                        out["reactions"] = [{"emoji": {"name": e}, "count": len(us), "me": True}
                                            for e, us in self.reactions[mid].items()]
                    return httpx.Response(200, json=out)
                if request.method == "PATCH":
                    msg.update({k: v for k, v in body.items() if k in ("content", "embeds")})
                    return httpx.Response(200, json=msg)
                if request.method == "DELETE":
                    del self.messages[mid]
                    return httpx.Response(204)
            if parts[4] == "reactions":
                emoji = httpx.URL(request.url).path.split("/reactions/")[1].split("/")[0]
                from urllib.parse import unquote
                emoji = unquote(emoji)
                if request.method == "PUT":
                    self.reactions.setdefault(mid, {}).setdefault(emoji, []).append({"id": BOT_ID, "bot": True, "username": "Caliburn"})
                    return httpx.Response(204)
                if request.method == "GET":
                    return httpx.Response(200, json=self.reactions.get(mid, {}).get(emoji, []))
        if len(parts) >= 4 and parts[2] == "polls":
            mid = parts[3]
            if parts[-1] == "expire":
                self.messages[mid]["poll"]["results"]["is_finalized"] = True
                return httpx.Response(200, json=self.messages[mid])
            aid = int(parts[5])
            return httpx.Response(200, json={"users": self.poll_votes.get(mid, {}).get(aid, [])})
        return httpx.Response(404, json={"message": f"unhandled {request.method} {path}", "code": 0})


class _Tools:
    """Collect the registered tool callables by name from a stub FastMCP."""

    def __init__(self):
        self.fns = {}

    def tool(self, description=""):
        def deco(fn):
            self.fns[fn.__name__] = fn
            return fn
        return deco


class DiscordToolTests(unittest.TestCase):
    def setUp(self):
        self.fake = FakeDiscord()
        cfg = D.DiscordConfig(SECRETS)
        self.client = D.DiscordClient(cfg, transport=self.fake.transport(), sleep=lambda s: None)
        self.mcp = _Tools()
        D.register(self.mcp, SECRETS, client=self.client)
        self.t = self.mcp.fns

    # -- channel resolution --------------------------------------------------

    def test_list_channels_orders_round_table_first_and_marks_postable(self):
        out = self.t["discord_list_channels"]()
        postable = [c["name"] for c in out["postable"]]
        self.assertEqual(postable, ["knightly-chat", "gm-solar", "court-of-schedules"])
        read_only = {c["name"]: c for c in out["read_only"]}
        self.assertEqual(list(read_only), ["library-of-camelot"])   # forum: readable, not postable
        self.assertEqual(out["locked_to"], "The Round Table")
        listed = {c["name"] for c in out["postable"]} | set(read_only)
        self.assertNotIn("scheduling", listed)              # archived category: hidden entirely
        self.assertNotIn("general-chat", listed)
        self.assertNotIn("The Court", listed)               # voice channels are not listed

    def test_resolve_by_name_hash_id_and_mention(self):
        for ref in ("gm-solar", "#gm-solar", "GM Solar", "100", "<#100>"):
            self.assertEqual(self.client.resolve_channel(ref)["id"], "100", ref)

    def test_resolve_ambiguous_name_refuses_and_suggests(self):
        with self.assertRaises(ValueError) as cm:
            self.client.resolve_channel("general-chat")
        self.assertIn("ambiguous", str(cm.exception))
        with self.assertRaises(ValueError) as cm:
            self.client.resolve_channel("court-of-schedule")
        self.assertIn("court-of-schedules", str(cm.exception))

    def test_post_outside_round_table_is_refused(self):
        out = self.t["discord_post_announcement"]("scheduling", "hello", dry_run=False)
        self.assertIn("locked", out["error"])
        self.assertFalse(any(m == "POST" for m, _, _ in self.fake.calls))

    def test_read_outside_round_table_is_refused(self):
        for tool, args in (("discord_read_messages", ("scheduling",)),
                           ("discord_poll_results", ("300", "1")),
                           ("discord_event_rsvps", ("<#300>", "1")),
                           ("discord_delete_message", ("scheduling", "1")),
                           ("discord_edit_message", ("scheduling", "1", "x"))):
            out = self.t[tool](*args)
            self.assertIn("locked", out.get("error", ""), tool)
        self.assertFalse(any(p.endswith("/messages") or "/messages/" in p for _, p, _ in self.fake.calls))

    def test_extra_allowed_channel_opens_read_and_post(self):
        secrets = dict(SECRETS, DISCORD_ALLOWED_CHANNELS="200")
        tools = _Tools()
        client = D.DiscordClient(D.DiscordConfig(secrets), transport=self.fake.transport(), sleep=lambda s: None)
        D.register(tools, secrets, client=client)
        out = tools.fns["discord_post_announcement"]("scheduling", "hello", dry_run=False)
        self.assertTrue(out["posted"])
        self.assertIn("scheduling", [c["name"] for c in tools.fns["discord_list_channels"]()["postable"]])

    # -- announcements -------------------------------------------------------

    def test_announcement_dry_run_posts_nothing(self):
        out = self.t["discord_post_announcement"]("gm-solar", "The court convenes.", title="Summons")
        self.assertTrue(out["dry_run"])
        self.assertIn("== Summons ==", out["preview"])
        self.assertEqual(out["channel"]["name"], "gm-solar")
        self.assertFalse(any(m == "POST" for m, _, _ in self.fake.calls))

    def test_announcement_embed_payload_and_ping(self):
        out = self.t["discord_post_announcement"]("gm-solar", "**Session Saturday.**", title="Summons",
                                                   ping_knights=True, footer="— the GM", dry_run=False)
        self.assertTrue(out["posted"])
        method, path, body = [c for c in self.fake.calls if c[0] == "POST"][0]
        self.assertEqual(body["content"], f"<@&{KNIGHTS}>")
        self.assertEqual(body["allowed_mentions"], {"parse": [], "roles": [KNIGHTS]})
        e = body["embeds"][0]
        self.assertEqual(e["title"], "Summons")
        self.assertEqual(e["description"], "**Session Saturday.**")
        self.assertEqual(e["color"], D.GOLD)
        self.assertEqual(e["footer"]["text"], "— the GM")
        self.assertIn("discord.com/channels/", out["jump_url"])

    def test_announcement_plain_never_pings_by_accident(self):
        self.t["discord_post_announcement"]("gm-solar", "@everyone look", style="plain", dry_run=False)
        body = [c for c in self.fake.calls if c[0] == "POST"][0][2]
        self.assertEqual(body["content"], "@everyone look")
        self.assertEqual(body["allowed_mentions"], {"parse": []})

    def test_announcement_length_limits(self):
        out = self.t["discord_post_announcement"]("gm-solar", "x" * 2001, style="plain", dry_run=False)
        self.assertIn("2000", out["error"])
        out = self.t["discord_post_announcement"]("gm-solar", "x" * 4097, dry_run=False)
        self.assertIn("4096", out["error"])
        out = self.t["discord_post_announcement"]("gm-solar", "x" * 3000, dry_run=False)
        self.assertTrue(out["posted"])

    # -- native polls --------------------------------------------------------

    def test_native_poll_payload(self):
        out = self.t["discord_create_poll"]("court-of-schedules", "Which night?", ["Friday", "Saturday"],
                                            duration_hours=48, intro="Pick your night, knights.", dry_run=False)
        self.assertEqual(out["kind"], "poll:native")
        body = [c for c in self.fake.calls if c[0] == "POST"][0][2]
        self.assertEqual(body["content"], "Pick your night, knights.")
        p = body["poll"]
        self.assertEqual(p["question"]["text"], "Which night?")
        self.assertEqual([a["poll_media"]["text"] for a in p["answers"]], ["Friday", "Saturday"])
        self.assertEqual(p["answers"][0]["poll_media"]["emoji"]["name"], "🇦")
        self.assertEqual(p["duration"], 48)
        self.assertFalse(p["allow_multiselect"])

    def test_poll_validation(self):
        t = self.t["discord_create_poll"]
        self.assertIn("at least 2", t("gm-solar", "Q?", ["one"])["error"])
        self.assertIn("at most 10", t("gm-solar", "Q?", [str(i) for i in range(11)])["error"])
        self.assertIn("distinct", t("gm-solar", "Q?", ["a", "A"])["error"])
        self.assertIn("between 1 and 768", t("gm-solar", "Q?", ["a", "b"], duration_hours=0)["error"])
        self.assertIn("55", t("gm-solar", "Q?", ["a" * 56, "b"])["error"])
        self.assertIn("style", t("gm-solar", "Q?", ["a", "b"], style="fancy")["error"])

    def test_poll_options_accept_delimited_string(self):
        out = self.t["discord_create_poll"]("gm-solar", "Q?", "Friday | Saturday | Sunday")
        self.assertTrue(out["dry_run"])
        self.assertIn("🇨 Sunday", out["preview"])

    def test_native_poll_results_with_voters(self):
        out = self.t["discord_create_poll"]("gm-solar", "Q?", ["Fri", "Sat"], dry_run=False)
        mid = out["message_id"]
        self.fake.messages[mid]["poll"]["results"]["answer_counts"] = [{"id": 1, "count": 2, "me_voted": False}]
        self.fake.poll_votes[mid] = {1: [{"id": "1", "username": "steve"}, {"id": "2", "username": "rich"}]}
        res = self.t["discord_poll_results"]("gm-solar", mid)
        self.assertEqual(res["kind"], "native")
        self.assertEqual(res["options"][0], {"label": "Fri", "votes": 2, "voters": ["Rich", "Steve"]})
        self.assertEqual(res["options"][1]["votes"], 0)
        self.assertEqual(res["total_votes"], 2)
        self.assertFalse(res["closed"])
        closed = self.t["discord_close_poll"]("gm-solar", mid)
        self.assertTrue(closed["closed"])
        self.assertTrue(any(p.endswith("/expire") for _, p, _ in self.fake.calls))

    # -- embed polls ---------------------------------------------------------

    def test_embed_poll_payload_and_reactions(self):
        out = self.t["discord_create_poll"]("gm-solar", "Which night?", ["Friday", "Saturday", "Sunday"],
                                            style="embed", multi_select=True, intro="Choose wisely.", dry_run=False)
        self.assertEqual(out["kind"], "poll:embed")
        self.assertEqual(out["reactions_added"], ["🇦", "🇧", "🇨"])
        body = [c for c in self.fake.calls if c[0] == "POST"][0][2]
        e = body["embeds"][0]
        self.assertEqual(e["title"], "📜 Which night?")
        self.assertTrue(e["description"].startswith("Choose wisely."))
        self.assertIn("Pick as many as you like.", e["description"])
        self.assertRegex(e["description"], r"Closes <t:\d+:R> · <t:\d+:f>")
        self.assertEqual([f["name"] for f in e["fields"]], ["🇦  Friday", "🇧  Saturday", "🇨  Sunday"])
        self.assertEqual(e["fields"][0]["value"], "▱▱▱▱▱▱▱▱▱▱  0% · 0 votes")
        self.assertTrue(e["footer"]["text"].startswith("Caliburn Poll · multi · ends 20"))

    def test_embed_poll_results_ignore_bot_and_name_voters(self):
        out = self.t["discord_create_poll"]("gm-solar", "Which night?", ["Friday", "Saturday"], style="embed", dry_run=False)
        mid = out["message_id"]
        self.fake.reactions[mid]["🇦"] += [{"id": "1", "username": "steve"}, {"id": "2", "username": "rich"}]
        self.fake.reactions[mid]["🇧"] += [{"id": "3", "username": "zerk", "global_name": "Zerk"}]
        res = self.t["discord_poll_results"]("gm-solar", mid)
        self.assertEqual(res["kind"], "embed")
        self.assertEqual(res["question"], "Which night?")
        self.assertEqual(res["options"][0], {"label": "Friday", "votes": 2, "voters": ["Rich", "Steve"]})
        self.assertEqual(res["options"][1], {"label": "Saturday", "votes": 1, "voters": ["Zerk"]})
        self.assertFalse(res["closed"])
        self.assertFalse(res["multi_select"])

    def test_close_embed_poll_freezes_card(self):
        out = self.t["discord_create_poll"]("gm-solar", "Which night?", ["Friday", "Saturday"], style="embed",
                                            intro="Choose.", dry_run=False)
        mid = out["message_id"]
        self.fake.reactions[mid]["🇦"] += [{"id": "1", "username": "steve"}]
        res = self.t["discord_close_poll"]("gm-solar", mid)
        self.assertTrue(res["closed"])
        e = self.fake.messages[mid]["embeds"][0]
        self.assertEqual(e["title"], "🔒 Which night?")
        self.assertIn("**Result:** Friday", e["description"])
        self.assertTrue(e["description"].startswith("Choose."))
        self.assertNotIn("React with the letter", e["description"])
        self.assertNotIn("Closes <t:", e["description"])
        self.assertIn("CLOSED", e["footer"]["text"])
        self.assertEqual(e["fields"][0]["value"], "▰▰▰▰▰▰▰▰▰▰  100% · 1 vote\nSteve")
        self.assertEqual(e["color"], D.CRIMSON)
        again = self.t["discord_close_poll"]("gm-solar", mid)     # idempotent
        self.assertTrue(again["closed"])

    def test_close_refuses_foreign_message(self):
        self.fake.messages["9"] = {"id": "9", "author": {"id": "77"}, "content": "hi", "embeds": [],
                                   "poll": {"question": {"text": "q"}, "answers": [], "results": {}}}
        out = self.t["discord_close_poll"]("gm-solar", "9")
        self.assertIn("posted itself", out["error"])

    # -- musters -------------------------------------------------------------

    def test_muster_payload_uses_default_zone(self):
        out = self.t["discord_post_session_muster"]("court-of-schedules", "Court at Sarum", "2026-10-31 19:00",
                                                    description="Bring your dice.", duration_hours=3, dry_run=False)
        self.assertEqual(out["kind"], "muster")
        self.assertEqual(out["starts_at_local"], "2026-10-31T19:00-07:00")
        self.assertEqual(out["starts_at_utc"], "2026-11-01T02:00+00:00")
        self.assertEqual(out["reactions_added"], ["✅", "❌", "❔"])
        e = [c for c in self.fake.calls if c[0] == "POST"][0][2]["embeds"][0]
        self.assertEqual(e["title"], "⚔️ Court at Sarum")
        ts = int(dt.datetime(2026, 11, 1, 2, 0, tzinfo=dt.timezone.utc).timestamp())
        self.assertIn(f"<t:{ts}:F>", e["description"])
        self.assertIn("about 3 hours", e["description"])
        self.assertEqual([f["name"] for f in e["fields"]], ["✅ Attending (0)", "❌ Can't make it (0)", "❔ Maybe (0)"])
        self.assertTrue(e["footer"]["text"].startswith("Caliburn Muster · starts 2026-11-01T02:00Z"))

    def test_muster_explicit_zone_and_bad_input(self):
        out = self.t["discord_post_session_muster"]("gm-solar", "T", "2026-10-31 19:00", timezone="Europe/London")
        self.assertEqual(out["starts_at_local"], "2026-10-31T19:00+00:00")
        self.assertIn("starts_at must", self.t["discord_post_session_muster"]("gm-solar", "T", "next friday")["error"])
        self.assertIn("Unknown timezone", self.t["discord_post_session_muster"]("gm-solar", "T", "2026-10-31 19:00", timezone="Mars/Olympus")["error"])

    def test_muster_rsvps(self):
        out = self.t["discord_post_session_muster"]("gm-solar", "Court", "2026-10-31 19:00", dry_run=False)
        mid = out["message_id"]
        self.fake.reactions[mid]["✅"] += [{"id": "1", "username": "steve"}]
        self.fake.reactions[mid]["❔"] += [{"id": "2", "username": "rich"}]
        res = self.t["discord_event_rsvps"]("gm-solar", mid)
        self.assertEqual(res["rsvps"], {"Attending": ["Steve"], "Can't make it": [], "Maybe": ["Rich"]})
        self.assertEqual(res["responses"], 2)
        # poll_results understands musters too
        self.assertEqual(self.t["discord_poll_results"]("gm-solar", mid)["kind"], "muster")

    # -- reading / editing / deleting ----------------------------------------

    def test_read_messages_summary(self):
        self.t["discord_post_announcement"]("gm-solar", "Hear ye", title="Summons", dry_run=False)
        self.t["discord_create_poll"]("gm-solar", "Q?", ["a", "b"], dry_run=False)
        out = self.t["discord_read_messages"]("gm-solar", limit=5)
        self.assertEqual(out["count"], 2)
        self.assertEqual(out["messages"][0]["poll"]["question"], "Q?")
        self.assertEqual(out["messages"][0]["caliburn_kind"], "native")
        self.assertEqual(out["messages"][1]["embeds"][0]["title"], "Summons")
        self.assertTrue(out["messages"][1]["author_is_bot"])

    def test_edit_own_embed_only(self):
        out = self.t["discord_post_announcement"]("gm-solar", "Hear ye", title="Summons", dry_run=False)
        mid = out["message_id"]
        prev = self.t["discord_edit_message"]("gm-solar", mid, body="Hear ye, hear ye")
        self.assertTrue(prev["dry_run"])
        self.assertEqual(self.fake.messages[mid]["embeds"][0]["description"], "Hear ye")
        done = self.t["discord_edit_message"]("gm-solar", mid, body="Hear ye, hear ye", title="Royal Summons", dry_run=False)
        self.assertTrue(done["edited"])
        e = self.fake.messages[mid]["embeds"][0]
        self.assertEqual((e["title"], e["description"]), ("Royal Summons", "Hear ye, hear ye"))
        poll = self.t["discord_create_poll"]("gm-solar", "Q?", ["a", "b"], dry_run=False)
        self.assertIn("cannot be edited", self.t["discord_edit_message"]("gm-solar", poll["message_id"], body="x", dry_run=False)["error"])
        self.fake.messages["9"] = {"id": "9", "author": {"id": "77"}, "content": "hi", "embeds": []}
        self.assertIn("own messages", self.t["discord_edit_message"]("gm-solar", "9", body="x", dry_run=False)["error"])

    def test_delete_own_only(self):
        out = self.t["discord_post_announcement"]("gm-solar", "oops", style="plain", dry_run=False)
        res = self.t["discord_delete_message"]("gm-solar", out["message_id"])
        self.assertTrue(res["deleted"])
        self.assertEqual(res["was"]["content"], "oops")
        self.fake.messages["9"] = {"id": "9", "author": {"id": "77"}, "content": "hi", "embeds": []}
        self.assertIn("own messages", self.t["discord_delete_message"]("gm-solar", "9")["error"])
        self.assertIn("Unknown Message", self.t["discord_delete_message"]("gm-solar", "404404")["error"])

    # -- plumbing ------------------------------------------------------------

    def test_rate_limit_is_retried(self):
        self.fake.rate_limit_once = True
        out = self.t["discord_list_channels"]()
        self.assertIn("postable", out)
        self.assertEqual([c[0] for c in self.fake.calls].count("GET"), 2)

    def test_resolve_lore_handouts_round_table_name_wins_over_dnd_lookalike(self):
        self.assertEqual(self.client.resolve_channel("knightly chat")["id"], "102")

    def test_truthy_strings_from_claude_ai(self):
        out = self.t["discord_post_announcement"]("gm-solar", "x", ping_knights="true", dry_run="false")
        self.assertTrue(out["posted"])
        body = [c for c in self.fake.calls if c[0] == "POST"][0][2]
        self.assertEqual(body["allowed_mentions"]["roles"], [KNIGHTS])

    def test_unconfigured_tools_explain(self):
        tools = _Tools()
        D.register(tools, {}, client=D.DiscordClient(D.DiscordConfig({}), transport=self.fake.transport()))
        self.assertIn("not configured", tools.fns["discord_list_channels"]()["error"])


class RenderTests(unittest.TestCase):
    def test_bars(self):
        self.assertEqual(D.render_bar(0, 0), "▱" * 10)
        self.assertEqual(D.render_bar(1, 2), "▰" * 5 + "▱" * 5)
        self.assertEqual(D.render_bar(3, 3), "▰" * 10)
        self.assertEqual(D.render_option_value(1, 3, ["Steve"]), "▰▰▰▱▱▱▱▱▱▱  33% · 1 vote\nSteve")

    def test_field_label(self):
        self.assertEqual(D._field_label("🇦  Friday 7pm"), ("🇦", "Friday 7pm"))
        self.assertEqual(D._field_label("✅ Attending (2)"), ("✅", "Attending"))
        self.assertEqual(D._field_label("Other"), ("", "Other"))


if __name__ == "__main__":
    unittest.main()
