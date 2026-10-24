"""
Pendragon GM's Binder — Discord tools for the MCP server.

Lets a connected AI (Claude.ai, Claude Code) act through the Caliburn bot
without the Anthropic API: announcements, polls (Discord-native or the
"Caliburn Poll" embed with live progress bars), session musters (RSVP
embeds), reading channel history, and tidying its own messages.

Everything here talks to Discord's REST API with Caliburn's bot token, so
posts appear as Caliburn.  The bot process itself (caliburn-bot/caliburn.py)
is untouched except for the reaction handler that keeps embed-poll tallies
and muster RSVP lists live — see `_render_option_value` there, which mirrors
the layout below.

Secrets (pendragon/secrets.env):
    DISCORD_TOKEN            Caliburn's bot token (same as caliburn-bot/.env)
    DISCORD_GUILD_ID         the server id
    DISCORD_WRITE_CATEGORY   category whose text channels may be posted to
                             (default "The Round Table")
    DISCORD_ALLOWED_CHANNELS optional comma list of extra channel ids
    DISCORD_KNIGHT_ROLE_ID   role pinged by ping_knights
    DISCORD_DEFAULT_TZ       IANA zone for session times (default America/Los_Angeles)

Every write tool defaults to dry_run=True and returns a preview; nothing
reaches the server until the GM has seen the preview and the tool is called
again with dry_run=False.
"""

from __future__ import annotations

import datetime as _dt
import difflib
import logging
import re
import time
import urllib.parse
from zoneinfo import ZoneInfo

import httpx

log = logging.getLogger("pendragon-mcp.discord")

DISCORD_API = "https://discord.com/api/v10"
USER_AGENT = "DiscordBot (https://pendragon-binder.com, 1.0) pendragon-mcp"

GOLD = 0xB8860B           # Caliburn's house colour (184,134,11)
CRIMSON = 0x8B1A1A
LETTERS = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"]
RSVP = [("✅", "Attending"), ("❌", "Can't make it"), ("❔", "Maybe")]
BAR_LEN = 10
BAR_ON, BAR_OFF = "▰", "▱"

POLL_MARK = "Caliburn Poll"
MUSTER_MARK = "Caliburn Muster"
CLOSED_WORD = "CLOSED"

TEXT_TYPES = {0: "text", 5: "announcement", 15: "forum"}
POSTABLE_TYPES = {0, 5}

MAX_CONTENT = 2000
MAX_EMBED_DESC = 4096
MAX_POLL_QUESTION = 300
MAX_POLL_ANSWER = 55


class DiscordError(Exception):
    def __init__(self, status: int, message: str, body=None):
        super().__init__(f"Discord {status}: {message}")
        self.status = status
        self.message = message
        self.body = body


# ── Rendering helpers (duplicated in caliburn.py — keep in step) ─────────────

def render_bar(count: int, total: int, length: int = BAR_LEN) -> str:
    filled = round(length * count / total) if total else 0
    return BAR_ON * filled + BAR_OFF * (length - filled)


def render_option_value(count: int, total: int, names: list[str] | None = None) -> str:
    pct = round(100 * count / total) if total else 0
    plural = "" if count == 1 else "s"
    line = f"{render_bar(count, total)}  {pct}% · {count} vote{plural}"
    if names:
        line += "\n" + ", ".join(names)
    return line


def render_rsvp_name(label: str, count: int) -> str:
    return f"{label} ({count})"


def discord_ts(when: _dt.datetime, style: str = "F") -> str:
    return f"<t:{int(when.timestamp())}:{style}>"


# ── Config ───────────────────────────────────────────────────────────────────

class DiscordConfig:
    def __init__(self, secrets: dict):
        self.token = secrets.get("DISCORD_TOKEN", "")
        self.guild_id = secrets.get("DISCORD_GUILD_ID", "")
        self.write_category = secrets.get("DISCORD_WRITE_CATEGORY", "The Round Table")
        self.extra_allowed = {
            s.strip() for s in secrets.get("DISCORD_ALLOWED_CHANNELS", "").split(",") if s.strip()
        }
        self.knight_role_id = secrets.get("DISCORD_KNIGHT_ROLE_ID", "")
        self.default_tz = secrets.get("DISCORD_DEFAULT_TZ", "America/Los_Angeles")

    @property
    def configured(self) -> bool:
        return bool(self.token and self.guild_id)


# ── REST client ──────────────────────────────────────────────────────────────

class DiscordClient:
    """Thin REST wrapper: auth header, 429 retry, channel + member caches."""

    CHANNEL_TTL = 60.0

    def __init__(self, config: DiscordConfig, transport: httpx.BaseTransport | None = None,
                 sleep=time.sleep):
        self.cfg = config
        self._sleep = sleep
        self.http = httpx.Client(
            base_url=DISCORD_API,
            headers={"Authorization": f"Bot {config.token}", "User-Agent": USER_AGENT},
            timeout=30,
            transport=transport,
        )
        self._channels: list[dict] | None = None
        self._channels_at = 0.0
        self._members: dict[str, str] = {}
        self._me: dict | None = None

    # -- low level -----------------------------------------------------------

    def request(self, method: str, path: str, **kwargs):
        for attempt in range(4):
            resp = self.http.request(method, path, **kwargs)
            if resp.status_code == 429:
                try:
                    wait = float(resp.json().get("retry_after", 1.0))
                except Exception:
                    wait = 1.0
                log.warning("Discord rate limit on %s %s — waiting %.2fs", method, path, wait)
                self._sleep(min(wait, 10.0) + 0.05)
                continue
            if resp.status_code >= 400:
                try:
                    body = resp.json()
                    msg = body.get("message", resp.text)
                except Exception:
                    body, msg = None, resp.text
                raise DiscordError(resp.status_code, msg, body)
            if resp.status_code == 204 or not resp.content:
                return {}
            return resp.json()
        raise DiscordError(429, "rate limited repeatedly; try again in a moment")

    # -- identity ------------------------------------------------------------

    def me(self) -> dict:
        if self._me is None:
            self._me = self.request("GET", "/users/@me")
        return self._me

    # -- channels ------------------------------------------------------------

    def channels(self, force: bool = False) -> list[dict]:
        now = time.monotonic()
        if force or self._channels is None or now - self._channels_at > self.CHANNEL_TTL:
            raw = self.request("GET", f"/guilds/{self.cfg.guild_id}/channels")
            cats = {c["id"]: c["name"] for c in raw if c["type"] == 4}
            cat_pos = {c["id"]: c.get("position", 0) for c in raw if c["type"] == 4}
            out = []
            for c in raw:
                if c["type"] not in TEXT_TYPES:
                    continue
                cat = cats.get(c.get("parent_id"), "")
                out.append({
                    "id": c["id"],
                    "name": c["name"],
                    "category": cat,
                    "type": TEXT_TYPES[c["type"]],
                    "topic": (c.get("topic") or "")[:200],
                    "can_post": self._writable(c, cat),
                    "_pos": (0 if self._in_write_category(cat) else 1,
                             cat_pos.get(c.get("parent_id"), 0), c.get("position", 0)),
                })
            out.sort(key=lambda c: c["_pos"])
            for c in out:
                c.pop("_pos", None)
            self._channels = out
            self._channels_at = now
        return self._channels

    def _in_write_category(self, cat: str) -> bool:
        return bool(cat) and cat.strip().lower() == self.cfg.write_category.strip().lower()

    def _writable(self, raw: dict, cat: str) -> bool:
        if raw["type"] not in POSTABLE_TYPES:
            return False
        return self._in_write_category(cat) or raw["id"] in self.cfg.extra_allowed

    def resolve_channel(self, ref: str) -> dict:
        """Accept an id, <#id>, #name or name. Prefers the write category on
        duplicate names, refuses ambiguous ones, suggests near-misses."""
        if ref is None:
            raise ValueError("channel is required")
        ref = str(ref).strip()
        m = re.fullmatch(r"<#(\d+)>", ref)
        if m:
            ref = m.group(1)
        chans = self.channels()
        if ref.isdigit():
            for c in chans:
                if c["id"] == ref:
                    return c
            raise ValueError(f"No text channel with id {ref} in this server")
        name = ref.lstrip("#").strip().lower().replace(" ", "-")
        exact = [c for c in chans if c["name"].lower() == name]
        if not exact:
            close = difflib.get_close_matches(name, [c["name"].lower() for c in chans], n=4, cutoff=0.5)
            hint = f" Did you mean: {', '.join('#' + n for n in close)}?" if close else ""
            raise ValueError(f"No channel named #{name}.{hint} Call discord_list_channels to see them all.")
        preferred = [c for c in exact if self._in_write_category(c["category"])]
        if len(preferred) == 1:
            return preferred[0]
        if len(exact) == 1:
            return exact[0]
        opts = "; ".join(f"#{c['name']} in '{c['category'] or 'no category'}' (id {c['id']})" for c in exact)
        raise ValueError(f"#{name} is ambiguous — {opts}. Pass the channel id instead.")

    def require_writable(self, chan: dict) -> dict:
        if not chan.get("can_post"):
            raise ValueError(
                f"Posting to #{chan['name']} ({chan['category'] or 'no category'}) is not allowed. "
                f"Caliburn may only post in text channels under '{self.cfg.write_category}'"
                + (" or the configured extra channels" if self.cfg.extra_allowed else "") + "."
            )
        return chan

    # -- members -------------------------------------------------------------

    def display_name(self, user: dict) -> str:
        uid = user.get("id", "")
        if uid in self._members:
            return self._members[uid]
        name = user.get("global_name") or user.get("username") or uid
        if not user.get("bot"):
            try:
                member = self.request("GET", f"/guilds/{self.cfg.guild_id}/members/{uid}")
                name = member.get("nick") or name
            except DiscordError:
                pass
        self._members[uid] = name
        return name

    # -- messages ------------------------------------------------------------

    def get_message(self, channel_id: str, message_id: str) -> dict:
        return self.request("GET", f"/channels/{channel_id}/messages/{message_id}")

    def list_messages(self, channel_id: str, limit: int = 25, before: str | None = None) -> list[dict]:
        params = {"limit": max(1, min(int(limit), 100))}
        if before:
            params["before"] = str(before)
        return self.request("GET", f"/channels/{channel_id}/messages", params=params)

    def create_message(self, channel_id: str, payload: dict) -> dict:
        return self.request("POST", f"/channels/{channel_id}/messages", json=payload)

    def edit_message(self, channel_id: str, message_id: str, payload: dict) -> dict:
        return self.request("PATCH", f"/channels/{channel_id}/messages/{message_id}", json=payload)

    def delete_message(self, channel_id: str, message_id: str) -> None:
        self.request("DELETE", f"/channels/{channel_id}/messages/{message_id}")

    def add_reaction(self, channel_id: str, message_id: str, emoji: str) -> None:
        enc = urllib.parse.quote(emoji, safe="")
        self.request("PUT", f"/channels/{channel_id}/messages/{message_id}/reactions/{enc}/@me")

    def reaction_users(self, channel_id: str, message_id: str, emoji: str) -> list[dict]:
        enc = urllib.parse.quote(emoji, safe="")
        users, after = [], None
        while True:
            params = {"limit": 100}
            if after:
                params["after"] = after
            page = self.request("GET", f"/channels/{channel_id}/messages/{message_id}/reactions/{enc}", params=params)
            users.extend(page)
            if len(page) < 100:
                return users
            after = page[-1]["id"]

    def poll_answer_voters(self, channel_id: str, message_id: str, answer_id: int) -> list[dict]:
        users, after = [], None
        while True:
            params = {"limit": 100}
            if after:
                params["after"] = after
            page = self.request("GET", f"/channels/{channel_id}/polls/{message_id}/answers/{answer_id}", params=params)
            got = page.get("users", [])
            users.extend(got)
            if len(got) < 100:
                return users
            after = got[-1]["id"]

    def expire_poll(self, channel_id: str, message_id: str) -> dict:
        return self.request("POST", f"/channels/{channel_id}/polls/{message_id}/expire")

    def jump_url(self, channel_id: str, message_id: str) -> str:
        return f"https://discord.com/channels/{self.cfg.guild_id}/{channel_id}/{message_id}"


# ── Payload builders (pure; tested without network) ──────────────────────────

def _mention_block(cfg: DiscordConfig, ping_knights: bool) -> tuple[str, dict]:
    """Returns (content prefix, allowed_mentions). Body text can never ping
    anyone by accident — only the explicit knights ping goes through."""
    if ping_knights and cfg.knight_role_id:
        return f"<@&{cfg.knight_role_id}> ", {"parse": [], "roles": [cfg.knight_role_id]}
    return "", {"parse": []}


def build_announcement(cfg: DiscordConfig, body: str, title: str | None, style: str,
                       ping_knights: bool, image_url: str | None, footer: str | None) -> dict:
    body = (body or "").strip()
    if not body:
        raise ValueError("body is required")
    prefix, allowed = _mention_block(cfg, ping_knights)
    if style == "plain":
        if len(prefix) + len(body) > MAX_CONTENT:
            raise ValueError(f"Plain messages are limited to {MAX_CONTENT} characters; use style='embed' "
                             f"(up to {MAX_EMBED_DESC}) or split the text.")
        content = prefix + (f"**{title.strip()}**\n" if title else "") + body
        return {"content": content, "allowed_mentions": allowed}
    if style != "embed":
        raise ValueError("style must be 'embed' or 'plain'")
    if len(body) > MAX_EMBED_DESC:
        raise ValueError(f"Embed text is limited to {MAX_EMBED_DESC} characters; split it into two posts.")
    embed: dict = {"description": body, "color": GOLD}
    if title:
        embed["title"] = title.strip()[:256]
    if footer:
        embed["footer"] = {"text": footer.strip()[:2048]}
    if image_url:
        if not re.match(r"^https?://", image_url):
            raise ValueError("image_url must be an http(s) URL")
        embed["image"] = {"url": image_url}
    payload: dict = {"embeds": [embed], "allowed_mentions": allowed}
    if prefix:
        payload["content"] = prefix.strip()
    return payload


def _validate_options(options) -> list[str]:
    if isinstance(options, str):
        options = [o.strip() for o in re.split(r"[\n|;]", options) if o.strip()]
    opts = [str(o).strip() for o in (options or []) if str(o).strip()]
    if len(opts) < 2:
        raise ValueError("A poll needs at least 2 options")
    if len(opts) > 10:
        raise ValueError("Discord polls allow at most 10 options")
    if len(set(o.lower() for o in opts)) != len(opts):
        raise ValueError("Poll options must be distinct")
    return opts


def _expiry(duration_hours, now: _dt.datetime | None = None) -> tuple[int, _dt.datetime]:
    try:
        hours = int(duration_hours)
    except (TypeError, ValueError):
        raise ValueError("duration_hours must be a whole number of hours")
    if not 1 <= hours <= 768:
        raise ValueError("duration_hours must be between 1 and 768 (32 days)")
    now = now or _dt.datetime.now(_dt.timezone.utc)
    return hours, now + _dt.timedelta(hours=hours)


def build_native_poll(cfg: DiscordConfig, question: str, options, duration_hours, multi_select: bool,
                      intro: str | None, ping_knights: bool) -> dict:
    question = (question or "").strip()
    if not question:
        raise ValueError("question is required")
    if len(question) > MAX_POLL_QUESTION:
        raise ValueError(f"Native poll questions are limited to {MAX_POLL_QUESTION} characters")
    opts = _validate_options(options)
    too_long = [o for o in opts if len(o) > MAX_POLL_ANSWER]
    if too_long:
        raise ValueError(f"Native poll options are limited to {MAX_POLL_ANSWER} characters: {too_long!r}. "
                         "Shorten them or use style='embed'.")
    hours, _ = _expiry(duration_hours)
    prefix, allowed = _mention_block(cfg, ping_knights)
    payload: dict = {
        "poll": {
            "question": {"text": question},
            "answers": [{"poll_media": {"text": o, "emoji": {"name": LETTERS[i]}}} for i, o in enumerate(opts)],
            "duration": hours,
            "allow_multiselect": bool(multi_select),
            "layout_type": 1,
        },
        "allowed_mentions": allowed,
    }
    content = (prefix + (intro or "").strip()).strip()
    if content:
        if len(content) > MAX_CONTENT:
            raise ValueError(f"intro is limited to {MAX_CONTENT} characters")
        payload["content"] = content
    return payload


def build_embed_poll(cfg: DiscordConfig, question: str, options, duration_hours, multi_select: bool,
                     intro: str | None, ping_knights: bool, now: _dt.datetime | None = None) -> dict:
    question = (question or "").strip()
    if not question:
        raise ValueError("question is required")
    opts = _validate_options(options)
    if any(len(o) > 240 for o in opts):
        raise ValueError("Embed poll options are limited to 240 characters")
    hours, expiry = _expiry(duration_hours, now)
    prefix, allowed = _mention_block(cfg, ping_knights)
    rule = "Pick as many as you like." if multi_select else "One vote each, on your honour."
    desc_parts = []
    if intro and intro.strip():
        desc_parts.append(intro.strip())
    desc_parts.append(f"React with the letter to vote. {rule}\nCloses {discord_ts(expiry, 'R')} · {discord_ts(expiry, 'f')}")
    description = "\n\n".join(desc_parts)
    if len(description) > MAX_EMBED_DESC:
        raise ValueError("intro is too long for an embed poll")
    embed = {
        "title": f"📜 {question}"[:256],
        "description": description,
        "color": GOLD,
        "fields": [{"name": f"{LETTERS[i]}  {o}", "value": render_option_value(0, 0), "inline": False}
                   for i, o in enumerate(opts)],
        "footer": {"text": f"{POLL_MARK} · {'multi' if multi_select else 'single'} · ends {expiry.strftime('%Y-%m-%dT%H:%MZ')}"},
    }
    payload: dict = {"embeds": [embed], "allowed_mentions": allowed}
    if prefix:
        payload["content"] = prefix.strip()
    return payload


def parse_when(starts_at: str, tz_name: str | None, default_tz: str) -> _dt.datetime:
    """'2026-10-31 19:00', '2026-10-31T19:00', or ISO with offset. Naive times
    are read in tz_name (or the default zone)."""
    s = (starts_at or "").strip().replace("T", " ")
    if not s:
        raise ValueError("starts_at is required, e.g. '2026-10-31 19:00'")
    try:
        when = _dt.datetime.fromisoformat(s)
    except ValueError:
        raise ValueError("starts_at must look like '2026-10-31 19:00' (24h) — optionally with a timezone offset")
    if when.tzinfo is None:
        try:
            zone = ZoneInfo(tz_name or default_tz)
        except Exception:
            raise ValueError(f"Unknown timezone '{tz_name or default_tz}' — use an IANA name like America/Los_Angeles")
        when = when.replace(tzinfo=zone)
    return when


def build_muster(cfg: DiscordConfig, title: str, when: _dt.datetime, description: str | None,
                 duration_hours, ping_knights: bool) -> dict:
    title = (title or "").strip()
    if not title:
        raise ValueError("title is required")
    prefix, allowed = _mention_block(cfg, ping_knights)
    lines = []
    if description and description.strip():
        lines.append(description.strip())
    when_line = f"**When:** {discord_ts(when, 'F')}  ·  {discord_ts(when, 'R')}"
    if duration_hours:
        try:
            dh = float(duration_hours)
            if dh > 0:
                when_line += f"\n**Length:** about {dh:g} hour{'s' if dh != 1 else ''}"
        except (TypeError, ValueError):
            raise ValueError("duration_hours must be a number")
    lines.append(when_line)
    lines.append("React to answer the summons.")
    description_text = "\n\n".join(lines)
    if len(description_text) > MAX_EMBED_DESC:
        raise ValueError("description is too long")
    embed = {
        "title": f"⚔️ {title}"[:256],
        "description": description_text,
        "color": GOLD,
        "fields": [{"name": f"{emoji} {render_rsvp_name(label, 0)}", "value": "—", "inline": True}
                   for emoji, label in RSVP],
        "footer": {"text": f"{MUSTER_MARK} · starts {when.astimezone(_dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')}"},
    }
    payload: dict = {"embeds": [embed], "allowed_mentions": allowed}
    if prefix:
        payload["content"] = prefix.strip()
    return payload


def preview_text(payload: dict) -> str:
    """Plain-text rendering of a payload so the GM can eyeball it before it posts."""
    out = []
    if payload.get("content"):
        out.append(payload["content"])
    for e in payload.get("embeds", []):
        if e.get("title"):
            out.append(f"== {e['title']} ==")
        if e.get("description"):
            out.append(e["description"])
        for f in e.get("fields", []):
            out.append(f"{f['name']}\n    {f['value']}")
        if e.get("footer", {}).get("text"):
            out.append(f"-- {e['footer']['text']}")
    poll = payload.get("poll")
    if poll:
        out.append(f"[Discord poll] {poll['question']['text']}")
        for a in poll["answers"]:
            out.append(f"   {a['poll_media'].get('emoji', {}).get('name', '•')} {a['poll_media']['text']}")
        out.append(f"   open {poll['duration']}h · {'multiple answers' if poll['allow_multiselect'] else 'one answer'}")
    return "\n".join(out)


# ── Reading back ─────────────────────────────────────────────────────────────

def _poll_kind(msg: dict) -> str:
    if msg.get("poll"):
        return "native"
    for e in msg.get("embeds", []):
        footer = (e.get("footer") or {}).get("text", "")
        if footer.startswith(POLL_MARK):
            return "embed"
        if footer.startswith(MUSTER_MARK):
            return "muster"
    return ""


def _field_label(name: str) -> tuple[str, str]:
    """'🇦  Friday' -> ('🇦', 'Friday'); '✅ Attending (2)' -> ('✅', 'Attending')."""
    name = name.strip()
    for emoji in LETTERS + [e for e, _ in RSVP]:
        if name.startswith(emoji):
            label = name[len(emoji):].strip()
            label = re.sub(r"\s*\(\d+\)$", "", label)
            return emoji, label
    return "", name


def summarize_message(client: DiscordClient, msg: dict, include_voters: bool = False) -> dict:
    author = msg.get("author", {})
    out = {
        "id": msg["id"],
        "author": client.display_name(author) if include_voters else (author.get("global_name") or author.get("username")),
        "author_is_bot": bool(author.get("bot")),
        "when": msg.get("timestamp", "")[:19].replace("T", " ") + "Z",
        "content": msg.get("content", ""),
    }
    if msg.get("edited_timestamp"):
        out["edited"] = True
    embeds = []
    for e in msg.get("embeds", []):
        se = {k: e[k] for k in ("title", "description") if e.get(k)}
        if e.get("fields"):
            se["fields"] = [{"name": f["name"], "value": f["value"]} for f in e["fields"]]
        if (e.get("footer") or {}).get("text"):
            se["footer"] = e["footer"]["text"]
        if se:
            embeds.append(se)
    if embeds:
        out["embeds"] = embeds
    if msg.get("attachments"):
        out["attachments"] = [a.get("filename") for a in msg["attachments"]]
    if msg.get("reactions"):
        out["reactions"] = [{"emoji": r["emoji"].get("name"), "count": r["count"]} for r in msg["reactions"]]
    if msg.get("poll"):
        p = msg["poll"]
        counts = {ac["id"]: ac["count"] for ac in (p.get("results") or {}).get("answer_counts", [])}
        out["poll"] = {
            "question": p["question"]["text"],
            "answers": [{"id": a["answer_id"], "text": a["poll_media"]["text"], "votes": counts.get(a["answer_id"], 0)}
                        for a in p["answers"]],
            "expiry": p.get("expiry"),
            "finalized": bool((p.get("results") or {}).get("is_finalized")),
            "multi_select": bool(p.get("allow_multiselect")),
        }
    kind = _poll_kind(msg)
    if kind:
        out["caliburn_kind"] = kind
    return out


def poll_results(client: DiscordClient, chan: dict, message_id: str) -> dict:
    msg = client.get_message(chan["id"], message_id)
    kind = _poll_kind(msg)
    if kind == "native":
        p = msg["poll"]
        counts = {ac["id"]: ac for ac in (p.get("results") or {}).get("answer_counts", [])}
        options = []
        for a in p["answers"]:
            aid = a["answer_id"]
            voters = [client.display_name(u) for u in client.poll_answer_voters(chan["id"], msg["id"], aid)]
            options.append({"label": a["poll_media"]["text"], "votes": counts.get(aid, {}).get("count", len(voters)),
                            "voters": sorted(voters)})
        return {
            "kind": "native", "question": p["question"]["text"], "options": options,
            "total_votes": sum(o["votes"] for o in options),
            "closed": bool((p.get("results") or {}).get("is_finalized")),
            "expiry": p.get("expiry"), "multi_select": bool(p.get("allow_multiselect")),
            "jump_url": client.jump_url(chan["id"], msg["id"]),
        }
    if kind == "embed":
        e = msg["embeds"][0]
        footer = (e.get("footer") or {}).get("text", "")
        options = []
        for f in e.get("fields", []):
            emoji, label = _field_label(f["name"])
            voters = [client.display_name(u) for u in client.reaction_users(chan["id"], msg["id"], emoji)
                      if not u.get("bot")] if emoji else []
            options.append({"label": label, "votes": len(voters), "voters": sorted(voters)})
        return {
            "kind": "embed", "question": (e.get("title") or "").lstrip("📜🔒 ").strip(), "options": options,
            "total_votes": sum(o["votes"] for o in options),
            "closed": CLOSED_WORD in footer, "multi_select": "multi" in footer,
            "jump_url": client.jump_url(chan["id"], msg["id"]),
        }
    if kind == "muster":
        return muster_rsvps(client, chan, message_id, msg=msg)
    raise ValueError("That message is not a poll Caliburn can read (no Discord poll and no Caliburn Poll embed).")


def muster_rsvps(client: DiscordClient, chan: dict, message_id: str, msg: dict | None = None) -> dict:
    msg = msg or client.get_message(chan["id"], message_id)
    if _poll_kind(msg) != "muster":
        raise ValueError("That message is not a Caliburn Muster (session RSVP) post.")
    e = msg["embeds"][0]
    groups = {}
    for emoji, label in RSVP:
        users = [client.display_name(u) for u in client.reaction_users(chan["id"], msg["id"], emoji) if not u.get("bot")]
        groups[label] = sorted(users)
    return {
        "kind": "muster", "title": (e.get("title") or "").lstrip("⚔️ ").strip(),
        "rsvps": groups, "responses": sum(len(v) for v in groups.values()),
        "footer": (e.get("footer") or {}).get("text", ""),
        "jump_url": client.jump_url(chan["id"], msg["id"]),
    }


def close_embed_poll(client: DiscordClient, chan: dict, msg: dict) -> dict:
    """Freeze a Caliburn Poll embed: final bars, lock in the title, CLOSED in
    the footer (which the bot's reaction handler honours)."""
    e = dict(msg["embeds"][0])
    footer = (e.get("footer") or {}).get("text", "")
    if CLOSED_WORD in footer:
        return poll_results(client, chan, msg["id"])
    results = poll_results(client, chan, msg["id"])
    total = results["total_votes"]
    fields = []
    for f, opt in zip(e.get("fields", []), results["options"]):
        fields.append({"name": f["name"], "value": render_option_value(opt["votes"], total, opt["voters"]), "inline": False})
    best = max((o["votes"] for o in results["options"]), default=0)
    winners = [o["label"] for o in results["options"] if o["votes"] == best and best > 0]
    verdict = ("No votes were cast." if not winners else
               f"**Result:** {winners[0]}" if len(winners) == 1 else f"**Tied:** {' / '.join(winners)}")
    desc = re.sub(r"\n?React with the letter to vote\..*?(?=\n\n|\Z)", "", e.get("description", ""), flags=re.S).strip()
    desc = re.sub(r"\n?Closes <t:\d+:R> · <t:\d+:f>", "", desc).strip()
    now = _dt.datetime.now(_dt.timezone.utc)
    desc = (desc + "\n\n" if desc else "") + f"{verdict}\nClosed {discord_ts(now, 'f')}"
    e.update({
        "title": "🔒 " + (e.get("title") or "").lstrip("📜 ").strip(),
        "description": desc[:MAX_EMBED_DESC],
        "fields": fields,
        "footer": {"text": f"{POLL_MARK} · {CLOSED_WORD} · {footer.split(' · ', 1)[-1] if ' · ' in footer else ''}".rstrip(" ·")},
        "color": CRIMSON,
    })
    e.pop("content_scan_version", None)
    e.pop("type", None)
    client.edit_message(chan["id"], msg["id"], {"embeds": [e], "allowed_mentions": {"parse": []}})
    results["closed"] = True
    return results


# ── Tool registration ────────────────────────────────────────────────────────

_DRY_RUN_RULE = (
    " DRY RUN RULE: dry_run defaults to True and returns a preview plus the resolved channel "
    "without posting anything. Show Steve the preview; call again with dry_run=False only after "
    "he approves. Never post to a channel he did not name."
)


def register(mcp, secrets: dict, client: DiscordClient | None = None):
    """Attach the discord_* tools to a FastMCP instance. Returns the client
    (so tests can swap its transport). If Discord is not configured the tools
    still register but explain what is missing."""
    cfg = DiscordConfig(secrets)
    client = client or DiscordClient(cfg)

    def _guard():
        if not cfg.configured:
            raise ValueError("Discord is not configured: DISCORD_TOKEN and DISCORD_GUILD_ID are missing from secrets.env")

    def _run(fn):
        try:
            _guard()
            return fn()
        except DiscordError as exc:
            return {"error": exc.message, "status": exc.status}
        except ValueError as exc:
            return {"error": str(exc)}

    def _post(chan: dict, payload: dict, dry_run, kind: str, reactions: list[str] | None = None) -> dict:
        client.require_writable(chan)
        if _truthy(dry_run):
            return {"dry_run": True, "kind": kind,
                    "channel": {"id": chan["id"], "name": chan["name"], "category": chan["category"]},
                    "preview": preview_text(payload),
                    "note": "Nothing was posted. Call again with dry_run=False to send this exactly as shown."}
        msg = client.create_message(chan["id"], payload)
        added = []
        for i, emoji in enumerate(reactions or []):
            if i:
                client._sleep(0.3)   # Discord allows roughly one reaction add per 0.25s per channel
            try:
                client.add_reaction(chan["id"], msg["id"], emoji)
                added.append(emoji)
            except DiscordError as exc:
                log.warning("reaction %s failed on %s: %s", emoji, msg["id"], exc)
        out = {"posted": True, "kind": kind, "message_id": msg["id"],
               "channel": {"id": chan["id"], "name": chan["name"]},
               "jump_url": client.jump_url(chan["id"], msg["id"])}
        if reactions:
            out["reactions_added"] = added
            if len(added) != len(reactions):
                out["warning"] = "Some vote reactions could not be added; players can still react by hand."
        return out

    # -- read tools ----------------------------------------------------------

    @mcp.tool(
        description=(
            "List the Discord server's text channels with id, name, category and whether Caliburn is "
            "allowed to post there (only text channels under 'The Round Table' by default). Channels "
            "Caliburn may post in come first. Call this before posting if you are unsure which channel "
            "Steve means — names like #general-chat exist in more than one category."
        )
    )
    def discord_list_channels() -> dict:
        def go():
            chans = client.channels(force=True)
            return {"write_category": cfg.write_category,
                    "postable": [c for c in chans if c["can_post"]],
                    "read_only": [c for c in chans if not c["can_post"]]}
        return _run(go)

    @mcp.tool(
        description=(
            "Read recent messages from a Discord channel (newest first; up to 100 per call, use "
            "before_message_id to page further back). Returns author, time (UTC), text, embeds, "
            "reaction counts and native-poll tallies. Use it to catch up on scheduling chatter or "
            "check what was already announced before drafting something new. Reading is allowed in "
            "any channel Caliburn can see; posting is not."
        )
    )
    def discord_read_messages(channel: str, limit: int = 25, before_message_id: str | None = None) -> dict:
        def go():
            chan = client.resolve_channel(channel)
            msgs = client.list_messages(chan["id"], limit, before_message_id)
            return {"channel": {"id": chan["id"], "name": chan["name"], "category": chan["category"]},
                    "count": len(msgs),
                    "messages": [summarize_message(client, m) for m in msgs],
                    "oldest_message_id": msgs[-1]["id"] if msgs else None}
        return _run(go)

    # -- write tools ---------------------------------------------------------

    @mcp.tool(
        description=(
            "Post an announcement to a Round Table channel as Caliburn. style='embed' (default) gives a "
            "gold-bordered card with optional title, footer and image; style='plain' is a bare message. "
            "Markdown works in body (bold, lists, links). ping_knights=True mentions the Knight of the "
            "Realm role — only when Steve asks for a ping. Text in body can never ping anyone by itself."
            + _DRY_RUN_RULE
        )
    )
    def discord_post_announcement(channel: str, body: str, title: str | None = None, style: str = "embed",
                                  ping_knights: bool = False, image_url: str | None = None,
                                  footer: str | None = None, dry_run: bool = True) -> dict:
        def go():
            chan = client.resolve_channel(channel)
            payload = build_announcement(cfg, body, title, style, _truthy(ping_knights), image_url, footer)
            return _post(chan, payload, dry_run, "announcement")
        return _run(go)

    @mcp.tool(
        description=(
            "Create a poll as Caliburn. style='native' (default) posts a real Discord poll: tap-to-vote, "
            "live percentages, enforces one vote unless multi_select, auto-closes after duration_hours "
            "(1–768, default 24); question ≤300 chars, options ≤55 chars each, 2–10 options, optional "
            "intro text above it. style='embed' posts the 'Caliburn Poll' card instead: gold embed with "
            "lettered options 🇦 🇧 🇨, live progress bars and voter names kept up to date by the bot as "
            "players react; use it when Steve wants the fancier look, longer option text, or to see who "
            "voted at a glance (single-vote is on the honour system there). Pass options as a list of "
            "strings. Read results later with discord_poll_results and end early with discord_close_poll."
            + _DRY_RUN_RULE
        )
    )
    def discord_create_poll(channel: str, question: str, options: list[str] | str, duration_hours: int = 24,
                            multi_select: bool = False, style: str = "native", intro: str | None = None,
                            ping_knights: bool = False, dry_run: bool = True) -> dict:
        def go():
            chan = client.resolve_channel(channel)
            if style == "native":
                payload = build_native_poll(cfg, question, options, duration_hours, _truthy(multi_select), intro, _truthy(ping_knights))
                return _post(chan, payload, dry_run, "poll:native")
            if style == "embed":
                payload = build_embed_poll(cfg, question, options, duration_hours, _truthy(multi_select), intro, _truthy(ping_knights))
                letters = LETTERS[:len(payload["embeds"][0]["fields"])]
                return _post(chan, payload, dry_run, "poll:embed", reactions=letters)
            raise ValueError("style must be 'native' or 'embed'")
        return _run(go)

    @mcp.tool(
        description=(
            "Read the current tally of a poll Caliburn posted — works for native Discord polls, Caliburn "
            "Poll embeds and Caliburn Muster RSVP posts. Returns each option with vote count and voter "
            "display names, total votes, and whether it has closed. message_id comes from the create "
            "call or from discord_read_messages."
        )
    )
    def discord_poll_results(channel: str, message_id: str) -> dict:
        return _run(lambda: poll_results(client, client.resolve_channel(channel), str(message_id)))

    @mcp.tool(
        description=(
            "Close a poll early. Native polls are expired (Discord shows the final result); Caliburn Poll "
            "embeds are frozen with final bars, the winner (or tie) written in, a 🔒 title and a CLOSED "
            "footer so later reactions are ignored. Returns the final tally. Only for polls Caliburn "
            "itself posted. Ask Steve before closing anything."
        )
    )
    def discord_close_poll(channel: str, message_id: str) -> dict:
        def go():
            chan = client.resolve_channel(channel)
            msg = client.get_message(chan["id"], str(message_id))
            kind = _poll_kind(msg)
            if msg.get("author", {}).get("id") != client.me().get("id"):
                raise ValueError("Caliburn can only close polls it posted itself.")
            if kind == "native":
                client.expire_poll(chan["id"], msg["id"])
                return poll_results(client, chan, msg["id"])
            if kind == "embed":
                return close_embed_poll(client, chan, msg)
            raise ValueError("That message is not a poll.")
        return _run(go)

    @mcp.tool(
        description=(
            "Post a session muster: an RSVP card for a game session (⚔️ title, description, the start "
            "time shown in each player's own local time with a countdown, and ✅ Attending / ❌ Can't "
            "make it / ❔ Maybe columns the bot fills in with names as players react). starts_at like "
            "'2026-10-31 19:00' (24h) is read in `timezone` (IANA name; default from config, "
            "America/Los_Angeles) unless it carries its own offset. duration_hours is optional and "
            "informational. Read responses with discord_event_rsvps." + _DRY_RUN_RULE
        )
    )
    def discord_post_session_muster(channel: str, title: str, starts_at: str, description: str | None = None,
                                    timezone: str | None = None, duration_hours: float | None = None,
                                    ping_knights: bool = False, dry_run: bool = True) -> dict:
        def go():
            chan = client.resolve_channel(channel)
            when = parse_when(starts_at, timezone, cfg.default_tz)
            payload = build_muster(cfg, title, when, description, duration_hours, _truthy(ping_knights))
            out = _post(chan, payload, dry_run, "muster", reactions=[e for e, _ in RSVP])
            out["starts_at_utc"] = when.astimezone(_dt.timezone.utc).isoformat(timespec="minutes")
            out["starts_at_local"] = when.isoformat(timespec="minutes")
            return out
        return _run(go)

    @mcp.tool(
        description=(
            "Read the RSVPs on a Caliburn Muster post: who is attending, who can't, who is a maybe "
            "(display names), plus the total responses."
        )
    )
    def discord_event_rsvps(channel: str, message_id: str) -> dict:
        return _run(lambda: muster_rsvps(client, client.resolve_channel(channel), str(message_id)))

    @mcp.tool(
        description=(
            "Edit a message Caliburn posted: fix a typo or update an announcement. Pass body and/or "
            "title; for an embed announcement they replace the card's text and title, for a plain "
            "message body replaces the text. Refuses to edit polls and musters (close and repost "
            "instead) and anything not authored by Caliburn." + _DRY_RUN_RULE
        )
    )
    def discord_edit_message(channel: str, message_id: str, body: str | None = None, title: str | None = None,
                             dry_run: bool = True) -> dict:
        def go():
            chan = client.resolve_channel(channel)
            client.require_writable(chan)
            msg = client.get_message(chan["id"], str(message_id))
            if msg.get("author", {}).get("id") != client.me().get("id"):
                raise ValueError("Caliburn can only edit its own messages.")
            if _poll_kind(msg):
                raise ValueError("Polls and musters cannot be edited in place — close it and post a new one.")
            if body is None and title is None:
                raise ValueError("Pass body and/or title.")
            payload: dict = {"allowed_mentions": {"parse": []}}
            if msg.get("embeds"):
                e = {k: v for k, v in msg["embeds"][0].items() if k not in ("type", "content_scan_version")}
                if body is not None:
                    if len(body) > MAX_EMBED_DESC:
                        raise ValueError(f"Embed text is limited to {MAX_EMBED_DESC} characters")
                    e["description"] = body.strip()
                if title is not None:
                    e["title"] = title.strip()[:256]
                payload["embeds"] = [e]
            else:
                content = msg.get("content", "")
                if body is not None:
                    content = (f"**{title.strip()}**\n" if title else "") + body.strip()
                elif title is not None:
                    content = f"**{title.strip()}**\n" + re.sub(r"^\*\*.*?\*\*\n", "", content, count=1)
                if len(content) > MAX_CONTENT:
                    raise ValueError(f"Plain messages are limited to {MAX_CONTENT} characters")
                payload["content"] = content
            if _truthy(dry_run):
                return {"dry_run": True, "kind": "edit", "message_id": msg["id"],
                        "channel": {"id": chan["id"], "name": chan["name"]},
                        "preview": preview_text(payload),
                        "note": "Nothing was changed. Call again with dry_run=False to apply."}
            client.edit_message(chan["id"], msg["id"], payload)
            return {"edited": True, "message_id": msg["id"], "jump_url": client.jump_url(chan["id"], msg["id"])}
        return _run(go)

    @mcp.tool(
        description=(
            "Delete a message Caliburn posted (a mistaken announcement or test post). Refuses anything "
            "not authored by Caliburn. Irreversible — confirm with Steve first."
        )
    )
    def discord_delete_message(channel: str, message_id: str) -> dict:
        def go():
            chan = client.resolve_channel(channel)
            msg = client.get_message(chan["id"], str(message_id))
            if msg.get("author", {}).get("id") != client.me().get("id"):
                raise ValueError("Caliburn can only delete its own messages.")
            client.delete_message(chan["id"], msg["id"])
            return {"deleted": True, "message_id": msg["id"], "channel": {"id": chan["id"], "name": chan["name"]},
                    "was": summarize_message(client, msg)}
        return _run(go)

    return client


def _truthy(value) -> bool:
    """Claude.ai's tool client sometimes sends booleans as text."""
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "y", "on")
    return bool(value)
