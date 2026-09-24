"""
Pendragon GM's Binder — MCP Server

Exposes the Binder's Flask API as Claude-callable tools via the MCP protocol.
Runs as a stdio server for Claude Code integration.

Usage:
    /home/solaire503/pendragon/mcp-venv/bin/python /home/solaire503/pendragon/mcp_server.py
"""

import hmac
import logging
import os
from pathlib import Path

import httpx
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

# ── Config ───────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
SECRETS_FILE = BASE_DIR / "secrets.env"


def _load_secrets() -> dict:
    secrets = {}
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            secrets[key.strip()] = val.strip()
    return secrets


SECRETS = _load_secrets()
MCP_KEY = SECRETS.get("MCP_KEY", "")
MCP_PUBLIC_TOKEN = SECRETS.get("MCP_PUBLIC_TOKEN", "")
BINDER_URL = os.environ.get("BINDER_URL", "http://localhost:8765")

HEADERS = {"Authorization": f"Bearer {MCP_KEY}"}

# ── MCP Server ───────────────────────────────────────────────────────────────

mcp = FastMCP(
    "pendragon-binder",
    instructions=(
        "Pendragon GM's Binder — a campaign management tool for a Pendragon 6th "
        "Edition tabletop RPG run by Steve (the sole GM) for 4 players.\n\n"
        "START every prep conversation by calling get_binder_summary, then "
        "list_arcs(status='active'), then get_current_prep. This gives you the "
        "full campaign state in 3 calls.\n\n"
        "Time uses in-game year-season format: '485-spring', '502-winter', etc.\n\n"
        "NEVER speak for or predict player knights (PKs): Aberthol, Ceradoc, "
        "Marrin, Viv. Prep situations and branches, not outcomes.\n\n"
        "Do not assert Pendragon 6e rules from memory as fact — flag uncertainty "
        "and have Steve verify against the book.\n\n"
        "All entity types support read/write: story arcs, session prep, "
        "NPCs, chronicles, and the player knights' manors (ledger years, "
        "improvements, property damage). Updates are partial — only send the "
        "fields you want to change.\n\n"
        "MANORS: Steve rolls EVERY die by hand — never roll for him. To record "
        "a manor year call get_manor_reference + get_manor, ask for his roll "
        "results, preview with record_manor_year(dry_run=true), and commit only "
        "after he confirms the numbers."
    ),
)

client = httpx.Client(base_url=BINDER_URL, headers=HEADERS, timeout=30)


def _api(method: str, path: str, **kwargs) -> dict | list | str:
    resp = client.request(method, path, **kwargs)
    if resp.status_code >= 400:
        try:
            err = resp.json()
        except Exception:
            err = {"error": resp.text}
        return {"error": err, "status": resp.status_code}
    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════════
# COLD-START READ TOOLS — call these first in any prep conversation
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(
    description=(
        "Get a high-level summary of the Binder: current game year, NPC counts "
        "(living/dead), household count, manor count, and active arc count. "
        "Call this FIRST at the start of any prep conversation to orient yourself."
    )
)
def get_binder_summary() -> dict:
    return _api("GET", "/api/mcp/binder-summary")


@mcp.tool(
    description=(
        "List all story arcs, optionally filtered by status: 'active' (in play), "
        "'cold' (dormant but unresolved), or 'complete' (resolved). "
        "Returns FULL arc objects including objectives, timeline, and linked NPCs — "
        "no follow-up calls needed per arc. "
        "Call list_arcs(status='active') early in prep to load all current narrative threads."
    )
)
def list_arcs(status: str = "") -> dict:
    params = {}
    if status:
        params["status"] = status
    return _api("GET", "/api/arcs", params=params)


@mcp.tool(
    description=(
        "Get the current session prep object — the most recent with status "
        "'draft' or 'ready'. Returns the full prep: previously recap, arcs in play "
        "with relevance tags, staged NPCs with context, open questions, and GM notes. "
        "Call this early in prep alongside get_binder_summary and list_arcs. "
        "Returns a 404 if no current prep exists (you may need to create one)."
    )
)
def get_current_prep() -> dict:
    return _api("GET", "/api/prep/current")


@mcp.tool(
    description=(
        "Get recent chronicle entries grouped by game year (most recent first). "
        "Each year contains an array of chronicle events. "
        "Use 'limit' to control how many years to return (default 5, max 50). "
        "Useful for reviewing what happened in recent sessions."
    )
)
def get_chronicle(limit: int = 5) -> dict:
    return _api("GET", "/api/mcp/chronicle", params={"limit": str(limit)})


# ═══════════════════════════════════════════════════════════════════════════════
# ACTIVE PREP TOOLS — use during the conversation for lookups and deep dives
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(
    description=(
        "Get a single story arc by its ID. Returns all fields: title, status, "
        "summary, notes, linked_npcs (with roles), objectives (with statuses), "
        "and timeline (with year/session/description). "
        "Use when you need to drill into a specific arc during prep."
    )
)
def get_arc(arc_id: str) -> dict:
    return _api("GET", f"/api/arcs/{arc_id}")


@mcp.tool(
    description=(
        "Search or list NPCs. Returns id, name, role, household, status, "
        "year_born, year_died, pronoun, manor, faction, glory, notes, and "
        "gm_notes (the GM's private notes, never visible to players) for each. "
        "Pass a search string to filter by name (case-insensitive partial match), "
        "or omit to list all. Use when an arc references an NPC you need detail on."
    )
)
def search_npcs(search: str = "") -> dict:
    params = {}
    if search:
        params["search"] = search
    return _api("GET", "/api/mcp/npcs", params=params)


@mcp.tool(
    description=(
        "Get full detail for a single NPC by name or ID (case-insensitive). "
        "Returns all fields plus up to 4 closest relationships "
        "(with type and related NPC name). "
        "Use when you need to understand an NPC's connections and backstory."
    )
)
def get_npc(name_or_id: str) -> dict:
    return _api("GET", f"/api/mcp/npc/{name_or_id}")


@mcp.tool(
    description=(
        "Get all story arcs that a specific NPC is linked to. "
        "Use when checking what narrative threads involve a particular character "
        "before introducing them in a new arc or session."
    )
)
def get_npc_arcs(npc_id: str) -> dict:
    return _api("GET", f"/api/npcs/{npc_id}/arcs")


@mcp.tool(
    description=(
        "Get all story arcs that advanced during a specific game year/season. "
        "Use Pendragon year-season format (e.g. '502-spring'). "
        "Useful for reviewing what arcs moved in a particular session."
    )
)
def get_chronicle_arcs(year: str) -> dict:
    return _api("GET", f"/api/chronicles/{year}/arcs")


@mcp.tool(
    description="List all session prep objects. Optionally filter by status: 'draft', 'ready', or 'played'."
)
def list_preps(status: str = "") -> dict:
    params = {}
    if status:
        params["status"] = status
    return _api("GET", "/api/prep", params=params)


@mcp.tool(
    description="Get a single session prep object by its ID."
)
def get_prep(prep_id: str) -> dict:
    return _api("GET", f"/api/prep/{prep_id}")


# ═══════════════════════════════════════════════════════════════════════════════
# WRITE-BACK TOOLS — use to save prep output back to the Binder
# ═══════════════════════════════════════════════════════════════════════════════

# ── NPC Write Tools ──────────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Create a new NPC in the Binder. Only 'name' is required — all other "
        "fields are optional and can be filled in later via update_npc. "
        "Common fields: role (e.g. 'Knight', 'Baron', 'Peasant'), status "
        "('Alive'/'Dead'), year_born, pronoun ('He/him', 'She/her'), "
        "manor, household, faction, glory, notes. "
        "Glory accepts a nonnegative integer, N/A, or a renown category: "
        "Non-knight, Unproven, Veteran, Respected, Notable, Renowned, "
        "Illustrious, Extraordinary, Legendary. "
        "Use gm_notes for the GM's private notes — that field is never shown "
        "to players; the plain notes field is visible to everyone. "
        "The NPC ID is auto-generated."
    )
)
def create_npc(
    name: str,
    role: str = "",
    status: str = "Alive",
    year_born: int | None = None,
    pronoun: str = "",
    manor: str = "",
    household: str = "",
    faction: str = "",
    glory: int | str = "N/A",
    notes: str = "",
    gm_notes: str = "",
    eligibility: str = "",
) -> dict:
    body = {
        "name": name, "role": role, "status": status, "pronoun": pronoun,
        "manor": manor, "household": household, "faction": faction,
        "glory": glory, "notes": notes, "gm_notes": gm_notes,
        "eligibility": eligibility,
    }
    if year_born is not None:
        body["year_born"] = year_born
    return _api("POST", "/api/mcp/npc", json=body)


@mcp.tool(
    description=(
        "Update an NPC's fields. PARTIAL UPDATE — only the fields you pass are "
        "changed; everything else stays as-is. Use for targeted edits like "
        "'add a note', 'change status to Dead', 'set glory to 1500'. "
        "Glory also accepts N/A or a renown category: Non-knight, Unproven, "
        "Veteran, Respected, Notable, Renowned, Illustrious, Extraordinary, Legendary. "
        "If status changes to 'Dead', the NPC automatically moves to the dead list "
        "(and vice versa back to living). "
        "Updatable fields: name, role, household, status, year_born, year_died, "
        "pronoun, manor, faction, glory, notes, gm_notes, eligibility, dowry, "
        "passions, skills, stats, con, blessed, blessed_note, barren, fate_touched, "
        "out_of_story, out_of_story_note, round_table, statblock_template, "
        "and training fields (page_placed, page_court, training_path, etc). "
        "PRIVACY: notes is visible to all players; gm_notes is the GM's private "
        "notes field and is never shown to players — put secrets there."
    )
)
def update_npc(
    npc_id: str,
    name: str | None = None,
    role: str | None = None,
    status: str | None = None,
    year_born: int | None = None,
    year_died: int | None = None,
    pronoun: str | None = None,
    manor: str | None = None,
    household: str | None = None,
    faction: str | None = None,
    glory: int | str | None = None,
    notes: str | None = None,
    gm_notes: str | None = None,
    eligibility: str | None = None,
    dowry: str | None = None,
    passions: str | None = None,
    skills: str | None = None,
    stats: str | None = None,
    con: int | None = None,
    blessed: bool | None = None,
    blessed_note: str | None = None,
    barren: bool | None = None,
    fate_touched: bool | None = None,
    out_of_story: bool | None = None,
    out_of_story_note: str | None = None,
    round_table: bool | None = None,
    statblock_template: str | None = None,
    page_type: str | None = None,
    page_placed: str | None = None,
    page_court: str | None = None,
    training_path: str | None = None,
    training_where: str | None = None,
    training_npc_id: str | None = None,
    came_of_age: bool | None = None,
) -> dict:
    body = {}
    for key, val in {
        "name": name, "role": role, "status": status, "year_born": year_born,
        "year_died": year_died, "pronoun": pronoun, "manor": manor,
        "household": household, "faction": faction, "glory": glory,
        "notes": notes, "gm_notes": gm_notes, "eligibility": eligibility, "dowry": dowry,
        "passions": passions, "skills": skills, "stats": stats, "con": con,
        "blessed": blessed, "blessed_note": blessed_note, "barren": barren,
        "fate_touched": fate_touched, "out_of_story": out_of_story,
        "out_of_story_note": out_of_story_note, "round_table": round_table,
        "statblock_template": statblock_template, "page_type": page_type,
        "page_placed": page_placed, "page_court": page_court,
        "training_path": training_path, "training_where": training_where,
        "training_npc_id": training_npc_id, "came_of_age": came_of_age,
    }.items():
        if val is not None:
            body[key] = val
    if not body:
        return {"error": "No fields to update"}
    return _api("PATCH", f"/api/mcp/npc/{npc_id}", json=body)


# ── Chronicle Write Tools ────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Add a chronicle entry to a specific game year. 'year' is the numeric "
        "game year (e.g. 502). 'text' is the event description. "
        "'cat' is the category (default 'political' — also: 'campaign', 'battle', "
        "'personal', 'supernatural', 'other')."
    )
)
def add_chronicle_entry(
    year: int,
    text: str,
    cat: str = "political",
) -> dict:
    return _api("POST", f"/api/mcp/chronicle/{year}", json={"text": text, "cat": cat})


@mcp.tool(
    description=(
        "Update an existing chronicle entry's text or category. "
        "Pass only the fields you want to change."
    )
)
def update_chronicle_entry(
    year: int,
    entry_id: str,
    text: str | None = None,
    cat: str | None = None,
) -> dict:
    body = {}
    if text is not None:
        body["text"] = text
    if cat is not None:
        body["cat"] = cat
    if not body:
        return {"error": "No fields to update"}
    return _api("PATCH", f"/api/mcp/chronicle/{year}/{entry_id}", json=body)


@mcp.tool(
    description="Delete a chronicle entry from a specific game year."
)
def delete_chronicle_entry(year: int, entry_id: str) -> dict:
    return _api("DELETE", f"/api/mcp/chronicle/{year}/{entry_id}")


# ── Relationship Write Tools ────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Get ALL relationships for a specific NPC — returns full edge data "
        "including relationship IDs (needed for deletion). Use this before "
        "modifying relationships to see what already exists.\n\n"
        "Returns sourceId/targetId pairs with resolved names."
    )
)
def get_npc_relationships(npc_id: str) -> dict:
    return _api("GET", f"/api/mcp/npc/{npc_id}/relationships")


@mcp.tool(
    description=(
        "Create a relationship between two NPCs. Relationships are directed "
        "edges: sourceId is the 'subject' and targetId is the 'object'.\n\n"
        "Example: sourceId='npc-010', targetId='npc-042', type='Parent' means "
        "'npc-010 is a Parent of npc-042'.\n\n"
        "Valid types: Spouse, Betrothed, Lover, Former Spouse, Child, "
        "Adopted Child, Bastard, Parent, Adoptive Parent, Sibling, "
        "Half-Sibling, Aunt/Uncle, Niece/Nephew, Cousin, Grandparent, "
        "Grandchild, Sworn Brother/Sister, Squire, Former Squire, Page, "
        "Vassal, Ward, Guardian, Other.\n\n"
        "Duplicate check: rejects if the same sourceId+targetId+type already exists."
    )
)
def add_relationship(
    source_id: str,
    target_id: str,
    type: str,
    notes: str = "",
) -> dict:
    body = {"sourceId": source_id, "targetId": target_id, "type": type}
    if notes:
        body["notes"] = notes
    return _api("POST", "/api/mcp/relationship", json=body)


@mcp.tool(
    description=(
        "Delete a relationship by its ID. Call get_npc_relationships first "
        "to find the relationship ID you want to remove."
    )
)
def delete_relationship(rel_id: str) -> dict:
    return _api("DELETE", f"/api/mcp/relationship/{rel_id}")


# ── Life Event Tools ────────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Get all life events for an NPC. Life events track personal milestones: "
        "retirement, marriages, injuries, quests, visions, etc.\n\n"
        "Each event has: id, year, season, title, mechDesc (mechanical "
        "description), flavorText (narrative), userNotes."
    )
)
def get_npc_events(npc_id: str) -> dict:
    return _api("GET", f"/api/mcp/npc/{npc_id}/events")


@mcp.tool(
    description=(
        "Add a life event to an NPC. 'title' is required — a short label "
        "like 'Knighted at Sarum', 'Major Wound at Terrabil', "
        "'Married Lady Elaine'.\n\n"
        "Optional fields:\n"
        "- year: game year (integer)\n"
        "- season: 'spring', 'summer', 'autumn', or 'winter'\n"
        "- mechDesc: mechanical description (what happened rules-wise)\n"
        "- flavorText: narrative prose (AI-generated or hand-written)\n"
        "- userNotes: GM/player notes about the event"
    )
)
def add_life_event(
    npc_id: str,
    title: str,
    year: int = 0,
    season: str = "",
    mechDesc: str = "",
    flavorText: str = "",
    userNotes: str = "",
) -> dict:
    body = {"title": title}
    if year:
        body["year"] = year
    if season:
        body["season"] = season
    if mechDesc:
        body["mechDesc"] = mechDesc
    if flavorText:
        body["flavorText"] = flavorText
    if userNotes:
        body["userNotes"] = userNotes
    return _api("POST", f"/api/mcp/npc/{npc_id}/events", json=body)


@mcp.tool(
    description=(
        "Update a life event's fields. Pass only the fields you want to change. "
        "Call get_npc_events first to find the event ID."
    )
)
def update_life_event(
    npc_id: str,
    event_id: str,
    title: str | None = None,
    year: int | None = None,
    season: str | None = None,
    mechDesc: str | None = None,
    flavorText: str | None = None,
    userNotes: str | None = None,
) -> dict:
    body = {}
    if title is not None:
        body["title"] = title
    if year is not None:
        body["year"] = year
    if season is not None:
        body["season"] = season
    if mechDesc is not None:
        body["mechDesc"] = mechDesc
    if flavorText is not None:
        body["flavorText"] = flavorText
    if userNotes is not None:
        body["userNotes"] = userNotes
    if not body:
        return {"error": "No fields to update"}
    return _api("PATCH", f"/api/mcp/npc/{npc_id}/events/{event_id}", json=body)


@mcp.tool(
    description=(
        "Delete a life event from an NPC. Call get_npc_events first "
        "to find the event ID."
    )
)
def delete_life_event(npc_id: str, event_id: str) -> dict:
    return _api("DELETE", f"/api/mcp/npc/{npc_id}/events/{event_id}")


# ── Arc Write Tools ──────────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Create a new story arc. Only 'title' is required — everything else is "
        "optional and can be filled in over the course of a prep conversation. "
        "Status defaults to 'active'. Use Pendragon year-season for 'created' "
        "(e.g. '502-spring'). The arc ID is auto-generated if not provided."
    )
)
def create_arc(
    title: str,
    status: str = "active",
    summary: str = "",
    notes: str = "",
    created: str = "",
    id: str = "",
) -> dict:
    body = {"title": title, "status": status, "summary": summary, "notes": notes}
    if created:
        body["created"] = created
    if id:
        body["id"] = id
    return _api("POST", "/api/arcs", json=body)


@mcp.tool(
    description=(
        "Change a story arc's status: 'active' (in play), 'cold' (dormant), "
        "or 'complete' (resolved). The most common arc write — use when an arc "
        "wraps up, goes dormant, or reactivates."
    )
)
def update_arc_status(arc_id: str, status: str) -> dict:
    return _api("PUT", f"/api/arcs/{arc_id}", json={"status": status})


@mcp.tool(
    description=(
        "Update an arc's text fields. Use to revise the summary (short description "
        "of current state), notes (GM-only planning notes), or title. "
        "Pass only the fields you want to change."
    )
)
def update_arc(
    arc_id: str,
    title: str | None = None,
    summary: str | None = None,
    notes: str | None = None,
) -> dict:
    body = {}
    if title is not None:
        body["title"] = title
    if summary is not None:
        body["summary"] = summary
    if notes is not None:
        body["notes"] = notes
    if not body:
        return {"error": "No fields to update"}
    return _api("PUT", f"/api/arcs/{arc_id}", json=body)


@mcp.tool(
    description="Delete a story arc permanently. This cannot be undone."
)
def delete_arc(arc_id: str) -> dict:
    return _api("DELETE", f"/api/arcs/{arc_id}")


# ── Objective Write Tools ────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Add an objective to a story arc. Objectives track specific goals or "
        "milestones within an arc. Status: 'active' (PKs can act on it), "
        "'pending' (depends on another event first), or 'complete' (resolved)."
    )
)
def add_objective(
    arc_id: str,
    text: str,
    status: str = "active",
    notes: str = "",
) -> dict:
    body = {"text": text, "status": status, "notes": notes}
    return _api("POST", f"/api/arcs/{arc_id}/objectives", json=body)


@mcp.tool(
    description=(
        "Mark an objective as complete. Optionally record when it was resolved "
        "in Pendragon year-season format (e.g. '502-autumn')."
    )
)
def complete_objective(
    arc_id: str,
    obj_id: str,
    completed: str = "",
) -> dict:
    body = {"status": "complete"}
    if completed:
        body["completed"] = completed
    return _api("PUT", f"/api/arcs/{arc_id}/objectives/{obj_id}", json=body)


@mcp.tool(
    description=(
        "Update an objective's text, status, notes, or completed date. "
        "Pass only the fields you want to change. "
        "For simply marking an objective complete, use complete_objective instead."
    )
)
def update_objective(
    arc_id: str,
    obj_id: str,
    text: str | None = None,
    status: str | None = None,
    notes: str | None = None,
    completed: str | None = None,
) -> dict:
    body = {}
    if text is not None:
        body["text"] = text
    if status is not None:
        body["status"] = status
    if notes is not None:
        body["notes"] = notes
    if completed is not None:
        body["completed"] = completed
    if not body:
        return {"error": "No fields to update"}
    return _api("PUT", f"/api/arcs/{arc_id}/objectives/{obj_id}", json=body)


@mcp.tool(
    description="Remove an objective from a story arc."
)
def delete_objective(arc_id: str, obj_id: str) -> dict:
    return _api("DELETE", f"/api/arcs/{arc_id}/objectives/{obj_id}")


# ── Timeline Write Tools ────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Record an arc advancement by adding a timeline entry. "
        "'year' is required in Pendragon format (e.g. '502-summer'). "
        "'description' is required — what happened to advance this arc. "
        "'session_id' is optional. "
        "This automatically updates the arc's last_advanced field."
    )
)
def add_timeline_entry(
    arc_id: str,
    year: str,
    description: str,
    session_id: str = "",
) -> dict:
    body = {"year": year, "description": description}
    if session_id:
        body["session_id"] = session_id
    return _api("POST", f"/api/arcs/{arc_id}/timeline", json=body)


# ── NPC Link Write Tools ────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Link an NPC to a story arc. The role is freeform text describing their "
        "function in this arc (e.g. 'antagonist', 'authority', 'hostage', "
        "'advisor', 'witness', 'ally')."
    )
)
def link_npc(arc_id: str, npc_id: str, role: str = "") -> dict:
    return _api("POST", f"/api/arcs/{arc_id}/npcs", json={"npc_id": npc_id, "role": role})


@mcp.tool(
    description="Remove an NPC's link from a story arc."
)
def unlink_npc(arc_id: str, npc_id: str) -> dict:
    return _api("DELETE", f"/api/arcs/{arc_id}/npcs/{npc_id}")


# ── Session Prep Write Tools ────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Create a new session prep object. 'session_number' is required. "
        "Status defaults to 'draft'. Use Pendragon year-season for game_year.\n\n"
        "Field guide:\n"
        "- previously: Second-person recap for players ('You stood before...')\n"
        "- arcs_in_play: Array of {arc_id, relevance, context} objects. "
        "Relevance: 'on-the-table' (tonight's focus), 'may-surface' (could come up), "
        "'background' (exerts pressure but probably won't be addressed)\n"
        "- npcs_staged: Array of {npc_id, context} — NPCs likely to appear tonight\n"
        "- open_questions: Array of strings — GM questions about what might arise "
        "(NOT predictions of PK behavior)\n"
        "- gm_notes: Array of strings — prepared scenes, triggers, contingencies"
    )
)
def create_prep(
    session_number: int,
    game_year: str = "",
    location: str = "",
    status: str = "draft",
    previous_session_id: str = "",
    previously: str = "",
    arcs_in_play: list | None = None,
    npcs_staged: list | None = None,
    open_questions: list | None = None,
    gm_notes: list | None = None,
) -> dict:
    body = {
        "session_number": session_number,
        "game_year": game_year,
        "location": location,
        "status": status,
    }
    if previous_session_id:
        body["previous_session_id"] = previous_session_id
    if previously:
        body["previously"] = previously
    if arcs_in_play is not None:
        body["arcs_in_play"] = arcs_in_play
    if npcs_staged is not None:
        body["npcs_staged"] = npcs_staged
    if open_questions is not None:
        body["open_questions"] = open_questions
    if gm_notes is not None:
        body["gm_notes"] = gm_notes
    return _api("POST", "/api/prep", json=body)


@mcp.tool(
    description=(
        "Update an existing session prep object. Pass only the fields you want "
        "to change. All fields from create_prep are updatable. "
        "Common use: updating gm_notes and open_questions as prep evolves."
    )
)
def update_prep(
    prep_id: str,
    session_number: int | None = None,
    game_year: str | None = None,
    location: str | None = None,
    status: str | None = None,
    previous_session_id: str | None = None,
    previously: str | None = None,
    arcs_in_play: list | None = None,
    npcs_staged: list | None = None,
    open_questions: list | None = None,
    gm_notes: list | None = None,
) -> dict:
    body = {}
    if session_number is not None:
        body["session_number"] = session_number
    if game_year is not None:
        body["game_year"] = game_year
    if location is not None:
        body["location"] = location
    if status is not None:
        body["status"] = status
    if previous_session_id is not None:
        body["previous_session_id"] = previous_session_id
    if previously is not None:
        body["previously"] = previously
    if arcs_in_play is not None:
        body["arcs_in_play"] = arcs_in_play
    if npcs_staged is not None:
        body["npcs_staged"] = npcs_staged
    if open_questions is not None:
        body["open_questions"] = open_questions
    if gm_notes is not None:
        body["gm_notes"] = gm_notes
    if not body:
        return {"error": "No fields to update"}
    return _api("PUT", f"/api/prep/{prep_id}", json=body)


@mcp.tool(
    description="Delete a session prep object permanently."
)
def delete_prep(prep_id: str) -> dict:
    return _api("DELETE", f"/api/prep/{prep_id}")


# ═══════════════════════════════════════════════════════════════════════════════
# PLAYER MANORS — the four PK manors and their yearly ledgers
# ═══════════════════════════════════════════════════════════════════════════════

def _strip_none(**kwargs) -> dict:
    return {k: v for k, v in kwargs.items() if v is not None}


@mcp.tool(
    description=(
        "List the player knights' manors (Blackwood, Cador, Dawnwell, Westwood) with "
        "a one-screen summary each: knight, player, faction, treasury, last recorded "
        "ledger year, whether the current game year is recorded yet, hatred/care, "
        "base harvest, lifestyle, DV, lord/steward/heir, active improvements, open "
        "property damage and vassal count. Call this first for any manor conversation."
    )
)
def list_manors() -> dict:
    return _api("GET", "/api/mcp/manors")


@mcp.tool(
    description=(
        "Get everything about one player manor. 'manor' accepts the manor key/name "
        "('Blackwood'), the knight's name ('Dame Vesa Blackwood' / 'Vesa Blackwood') or "
        "the player's username ('Zerk'). Returns stats, personnel (lord, steward with "
        "Stewardship/Industry skill, heir), all improvements with status/income/"
        "maintenance/DV, all property damage (open damage costs 1 L harvest per damaged "
        "field), vassal manors (with registry holder status), the stables (living horses), "
        "the full list of recorded years, the last 'history_years' ledger entries in full, "
        "and 'recordYearDefaults' — exactly what the Record Year form would pre-fill for "
        "the current year (previous treasury, improvement income/maintenance, vassal income, "
        "carried-forward lifestyle and family, shared weather). Use history_years=0 for "
        "a lighter payload, up to 100 for the whole ledger."
    )
)
def get_manor(manor: str, history_years: int = 5) -> dict:
    return _api("GET", f"/api/mcp/manor/{manor}", params={"history": str(history_years)})


@mcp.tool(
    description=(
        "Get one recorded ledger year for a player manor in full: luck and conflict "
        "results, steward/misfortune test results, harvest outcome and income, every "
        "income and expense line, misfortune factors, previous and closing treasury, notes."
    )
)
def get_manor_year(manor: str, year: int) -> dict:
    return _api("GET", f"/api/mcp/manor/{manor}/year/{year}")


@mcp.tool(
    description=(
        "Get the Book of the Manor reference tables the Binder uses when recording a "
        "year: Manorial Luck by campaign period, Benefit and Calamity (d20), Conflict "
        "Results by period with fate dice and Property Destruction modifiers, the "
        "Property Destruction table, Care (Concern vs Hate) rules, the Harvest Results "
        "table and multipliers, lifestyle costs, the ledger formulas, Steve's house rules, "
        "and the allowed values for every record_manor_year field. Call this BEFORE "
        "helping record a year, and rely on it instead of remembered 6e rules."
    )
)
def get_manor_reference() -> dict:
    return _api("GET", "/api/mcp/manor-reference")


@mcp.tool(
    description=(
        "Record a ledger year for a player manor — the server-side twin of the Binder's "
        "Record Year form. WORKFLOW: Steve rolls every die by hand and tells you the "
        "results; never roll for him. Call get_manor_reference and get_manor first, then "
        "call this with dry_run=true to show Steve the computed ledger (harvest, totals, "
        "closing treasury, which defaults were applied), and only after he confirms call "
        "it again with dry_run=false. "
        "The server derives: harvestOutcome from stewardResult × fateResult (tiebreaker "
        "'win'/'lose' when both are Success); harvestIncome = round(baseHarvest × "
        "multiplier) − 1 L per damaged field; fateConflict = conflictRoll − reduction "
        "(manor DV if siegeSuccess, plus 1 per presSword/presBattle/presValorous; Bandits "
        "never reduced); lifestyleCost from lifestyle; vassalIncome from vassal manors; "
        "treasury = prevTreasury + income − expenses. Defaults when omitted: year = "
        "current game year, improvIncome/improvMaint from active improvements, lifestyle "
        "and family carried forward from last year, prevTreasury from the latest ledger "
        "year, fateWeather shared from any other manor already recorded this year. "
        "Pass explicit harvestOutcome/harvestIncome/fateConflict to override the derived "
        "figures. hatred/care update the manor's standing passions. Misc lines are lists "
        "of {amount, note}. Fails with 409 if the year already exists unless "
        "overwrite=true — prefer update_manor_year for edits."
    )
)
def record_manor_year(
    manor: str,
    year: int | None = None,
    dry_run: bool = True,
    overwrite: bool = False,
    stewardResult: str | None = None,
    fateResult: str | None = None,
    tiebreaker: str | None = None,
    harvestOutcome: str | None = None,
    harvestIncome: float | None = None,
    luck: str | None = None,
    luckSeason: str | None = None,
    conflict: str | None = None,
    conflictSeason: str | None = None,
    conflictRoll: float | None = None,
    siegeSuccess: bool | None = None,
    presSword: bool | None = None,
    presBattle: bool | None = None,
    presValorous: bool | None = None,
    fateWeather: float | None = None,
    fateConflict: float | None = None,
    fateCommoners: float | None = None,
    fatePresence: float | None = None,
    fateMisc: float | None = None,
    stewardIndustry: float | None = None,
    improvIncome: float | None = None,
    discretionary: float | None = None,
    extraManorial: float | None = None,
    miscIncomeItems: list[dict] | None = None,
    lifestyle: str | None = None,
    improvMaint: float | None = None,
    family: float | None = None,
    improvBuild: float | None = None,
    miscExpItems: list[dict] | None = None,
    prevTreasury: float | None = None,
    hatred: int | None = None,
    care: int | None = None,
    notes: str | None = None,
    notes2: str | None = None,
) -> dict:
    body = _strip_none(
        year=year, dry_run=dry_run, overwrite=overwrite,
        stewardResult=stewardResult, fateResult=fateResult, tiebreaker=tiebreaker,
        harvestOutcome=harvestOutcome, harvestIncome=harvestIncome,
        luck=luck, luckSeason=luckSeason, conflict=conflict, conflictSeason=conflictSeason,
        conflictRoll=conflictRoll, siegeSuccess=siegeSuccess, presSword=presSword,
        presBattle=presBattle, presValorous=presValorous,
        fateWeather=fateWeather, fateConflict=fateConflict, fateCommoners=fateCommoners,
        fatePresence=fatePresence, fateMisc=fateMisc,
        stewardIndustry=stewardIndustry, improvIncome=improvIncome, discretionary=discretionary,
        extraManorial=extraManorial, miscIncomeItems=miscIncomeItems,
        lifestyle=lifestyle, improvMaint=improvMaint, family=family, improvBuild=improvBuild,
        miscExpItems=miscExpItems, prevTreasury=prevTreasury,
        hatred=hatred, care=care, notes=notes, notes2=notes2,
    )
    return _api("POST", f"/api/mcp/manor/{manor}/year", json=body)


@mcp.tool(
    description=(
        "Edit an already-recorded ledger year for a player manor. PARTIAL UPDATE — only "
        "the fields you pass change. Income/expense totals and the closing treasury are "
        "recomputed from the lines (pass 'treasury' to set it outright instead). Nothing "
        "else is re-derived: to change the harvest pass both harvestOutcome and "
        "harvestIncome; to change the conflict misfortune pass fateConflict. If the "
        "treasury changes and later years exist, the response says so — confirm with "
        "Steve, then call again with ripple_treasury=true to carry the difference "
        "through every later recorded year (the same offer the Binder's edit modal makes)."
    )
)
def update_manor_year(
    manor: str,
    year: int,
    ripple_treasury: bool = False,
    treasury: float | None = None,
    stewardResult: str | None = None,
    fateResult: str | None = None,
    tiebreaker: str | None = None,
    harvestOutcome: str | None = None,
    harvestIncome: float | None = None,
    luck: str | None = None,
    luckSeason: str | None = None,
    conflict: str | None = None,
    conflictSeason: str | None = None,
    conflictRoll: float | None = None,
    siegeSuccess: bool | None = None,
    presSword: bool | None = None,
    presBattle: bool | None = None,
    presValorous: bool | None = None,
    fateWeather: float | None = None,
    fateConflict: float | None = None,
    fateCommoners: float | None = None,
    fatePresence: float | None = None,
    fateMisc: float | None = None,
    stewardIndustry: float | None = None,
    improvIncome: float | None = None,
    discretionary: float | None = None,
    extraManorial: float | None = None,
    miscIncomeItems: list[dict] | None = None,
    lifestyle: str | None = None,
    lifestyleCost: float | None = None,
    improvMaint: float | None = None,
    family: float | None = None,
    improvBuild: float | None = None,
    miscExpItems: list[dict] | None = None,
    prevTreasury: float | None = None,
    hatred: int | None = None,
    care: int | None = None,
    notes: str | None = None,
    notes2: str | None = None,
) -> dict:
    body = _strip_none(
        ripple_treasury=ripple_treasury, treasury=treasury,
        stewardResult=stewardResult, fateResult=fateResult, tiebreaker=tiebreaker,
        harvestOutcome=harvestOutcome, harvestIncome=harvestIncome,
        luck=luck, luckSeason=luckSeason, conflict=conflict, conflictSeason=conflictSeason,
        conflictRoll=conflictRoll, siegeSuccess=siegeSuccess, presSword=presSword,
        presBattle=presBattle, presValorous=presValorous,
        fateWeather=fateWeather, fateConflict=fateConflict, fateCommoners=fateCommoners,
        fatePresence=fatePresence, fateMisc=fateMisc,
        stewardIndustry=stewardIndustry, improvIncome=improvIncome, discretionary=discretionary,
        extraManorial=extraManorial, miscIncomeItems=miscIncomeItems,
        lifestyle=lifestyle, lifestyleCost=lifestyleCost, improvMaint=improvMaint, family=family,
        improvBuild=improvBuild, miscExpItems=miscExpItems, prevTreasury=prevTreasury,
        hatred=hatred, care=care, notes=notes, notes2=notes2,
    )
    return _api("PATCH", f"/api/mcp/manor/{manor}/year/{year}", json=body)


@mcp.tool(
    description=(
        "Delete one recorded ledger year from a player manor. Irreversible — confirm "
        "with Steve first. Later years keep their own treasury figures, so deleting a "
        "middle year leaves a gap in the chain (the response warns when that happens)."
    )
)
def delete_manor_year(manor: str, year: int) -> dict:
    return _api("DELETE", f"/api/mcp/manor/{manor}/year/{year}")


@mcp.tool(
    description=(
        "Update a player manor's standing figures. PARTIAL UPDATE. Fields: hatred, care "
        "(the commoners' passions), baseHarvest (L), dvBase (base defensive value), "
        "lifestyle (Impoverished/Poor/Normal/Rich/Extravagant), steward_skill, "
        "steward_industry, faction, notes. Knight, player, lord/steward/heir assignments "
        "and succession are NOT editable here — Steve handles those in the Binder."
    )
)
def update_manor(
    manor: str,
    hatred: int | None = None,
    care: int | None = None,
    baseHarvest: int | None = None,
    dvBase: int | None = None,
    lifestyle: str | None = None,
    steward_skill: int | None = None,
    steward_industry: int | None = None,
    faction: str | None = None,
    notes: str | None = None,
) -> dict:
    body = _strip_none(hatred=hatred, care=care, baseHarvest=baseHarvest, dvBase=dvBase,
                       lifestyle=lifestyle, steward_skill=steward_skill,
                       steward_industry=steward_industry, faction=faction, notes=notes)
    if not body:
        return {"error": "No fields to update"}
    return _api("PATCH", f"/api/mcp/manor/{manor}", json=body)


@mcp.tool(
    description=(
        "Log property damage on a player manor (e.g. a Property Destruction result). "
        "type: General, Field, Building or Livestock. For Field damage give numFields — "
        "each damaged field costs 1 L of harvest every year until repaired, and the "
        "description defaults to 'N fields damaged'. repairCost in L; yearApplied "
        "defaults to the current game year. The entry starts as status 'damaged'."
    )
)
def add_manor_damage(
    manor: str,
    description: str | None = None,
    type: str = "General",
    numFields: int | None = None,
    repairCost: float | None = None,
    yearApplied: int | None = None,
    notes: str | None = None,
) -> dict:
    body = _strip_none(description=description, type=type, numFields=numFields,
                       repairCost=repairCost, yearApplied=yearApplied, notes=notes)
    return _api("POST", f"/api/mcp/manor/{manor}/damage", json=body)


@mcp.tool(
    description=(
        "Edit or repair a property-damage entry on a player manor (ids come from "
        "get_manor's propertyDamage list). PARTIAL UPDATE. status 'repaired' marks it "
        "fixed (yearRepaired defaults to the current game year); 'damaged' reopens it. "
        "Also editable: type, numFields, description, repairCost, yearApplied, "
        "yearRepaired, notes."
    )
)
def update_manor_damage(
    manor: str,
    damage_id: str,
    status: str | None = None,
    type: str | None = None,
    numFields: int | None = None,
    description: str | None = None,
    repairCost: float | None = None,
    yearApplied: int | None = None,
    yearRepaired: int | None = None,
    notes: str | None = None,
) -> dict:
    body = _strip_none(status=status, type=type, numFields=numFields, description=description,
                       repairCost=repairCost, yearApplied=yearApplied, yearRepaired=yearRepaired,
                       notes=notes)
    if not body:
        return {"error": "No fields to update"}
    return _api("PATCH", f"/api/mcp/manor/{manor}/damage/{damage_id}", json=body)


@mcp.tool(
    description=(
        "Add an improvement to a player manor. cat: 'improvement' (investment), "
        "'fortification' or 'enhancement'. buildCost (L, one-off — remember to include it "
        "in that year's improvBuild), maintenance (L/yr, feeds improvMaint), income "
        "(L/yr, feeds improvIncome; use incomeNote for dice like '1d2'), dvMod (+DV for "
        "fortifications), yearBuilt (defaults to the current game year). Starts 'active'."
    )
)
def add_manor_improvement(
    manor: str,
    name: str,
    cat: str = "improvement",
    buildCost: float | None = None,
    maintenance: float | None = None,
    income: float | None = None,
    incomeNote: str | None = None,
    dvMod: int | None = None,
    dvNote: str | None = None,
    yearBuilt: int | None = None,
    notes: str | None = None,
) -> dict:
    body = _strip_none(name=name, cat=cat, buildCost=buildCost, maintenance=maintenance,
                       income=income, incomeNote=incomeNote, dvMod=dvMod, dvNote=dvNote,
                       yearBuilt=yearBuilt, notes=notes)
    return _api("POST", f"/api/mcp/manor/{manor}/improvement", json=body)


@mcp.tool(
    description=(
        "Edit an improvement on a player manor (ids from get_manor's improvements list). "
        "PARTIAL UPDATE. status: 'active' (counts for income, maintenance and DV), "
        "'damaged' (excluded until repaired — set back to 'active') or 'inactive'. "
        "Also editable: name, cat, buildCost, maintenance, income, incomeNote, dvMod, "
        "dvNote, yearBuilt, notes."
    )
)
def update_manor_improvement(
    manor: str,
    improvement_id: str,
    status: str | None = None,
    name: str | None = None,
    cat: str | None = None,
    buildCost: float | None = None,
    maintenance: float | None = None,
    income: float | None = None,
    incomeNote: str | None = None,
    dvMod: int | None = None,
    dvNote: str | None = None,
    yearBuilt: int | None = None,
    notes: str | None = None,
) -> dict:
    body = _strip_none(status=status, name=name, cat=cat, buildCost=buildCost,
                       maintenance=maintenance, income=income, incomeNote=incomeNote,
                       dvMod=dvMod, dvNote=dvNote, yearBuilt=yearBuilt, notes=notes)
    if not body:
        return {"error": "No fields to update"}
    return _api("PATCH", f"/api/mcp/manor/{manor}/improvement/{improvement_id}", json=body)


# ── Entry Point ──────────────────────────────────────────────────────────────

class RedactToken(logging.Filter):
    """Keep the secret URL segment out of the log file.

    uvicorn's access log prints the raw request line, so every successful call
    would otherwise write the token to /var/log/pendragon-mcp.log in plaintext —
    turning a readable log into a full-access credential.
    """

    def __init__(self, token: str):
        super().__init__()
        self.token = token

    def filter(self, record):
        if isinstance(record.msg, str) and self.token in record.msg:
            record.msg = record.msg.replace(self.token, "<token>")
        if record.args:
            record.args = tuple(
                a.replace(self.token, "<token>") if isinstance(a, str) else a
                for a in record.args
            )
        return True


class SecretPathGate:
    """Require a secret URL segment before the MCP app is reachable.

    The tunnel publishes this server to the open internet, and the tools it
    exposes carry GM privileges (including gm_notes and deletes), so an
    unauthenticated /mcp is a full read/write hole. Everything that does not
    present the token gets a flat 404 — no hint that a real endpoint is here.
    """

    def __init__(self, app, token: str):
        self.app = app
        self.token = token

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        head, _, rest = path.lstrip("/").partition("/")
        if hmac.compare_digest(head, self.token):
            inner = "/" + rest
            scope = dict(scope)
            scope["path"] = inner
            scope["raw_path"] = inner.encode()
            return await self.app(scope, receive, send)

        await send({
            "type": "http.response.start",
            "status": 404,
            "headers": [(b"content-type", b"text/plain")],
        })
        await send({"type": "http.response.body", "body": b"Not Found"})


if __name__ == "__main__":
    import sys
    if "--http" in sys.argv:
        port = 8766
        for i, a in enumerate(sys.argv):
            if a == "--port" and i + 1 < len(sys.argv):
                port = int(sys.argv[i + 1])

        if not MCP_PUBLIC_TOKEN:
            sys.exit(
                "MCP_PUBLIC_TOKEN missing from secrets.env — refusing to start an "
                "unauthenticated server on a publicly tunnelled port."
            )

        import uvicorn

        _redact = RedactToken(MCP_PUBLIC_TOKEN)
        for _name in ("uvicorn.access", "uvicorn.error", "uvicorn", ""):
            logging.getLogger(_name).addFilter(_redact)

        mcp.settings.host = "127.0.0.1"
        mcp.settings.port = port
        mcp.settings.transport_security = TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=[
                "127.0.0.1:*",
                "localhost:*",
                "mcp.pendragon-binder.com",
            ],
        )
        uvicorn.run(
            SecretPathGate(mcp.streamable_http_app(), MCP_PUBLIC_TOKEN),
            host="127.0.0.1",
            port=port,
        )
    else:
        mcp.run(transport="stdio")
