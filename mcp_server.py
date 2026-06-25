"""
Pendragon GM's Binder — MCP Server

Exposes the Binder's Flask API as Claude-callable tools via the MCP protocol.
Runs as a stdio server for Claude Code integration.

Usage:
    /home/solaire503/pendragon/mcp-venv/bin/python /home/solaire503/pendragon/mcp_server.py
"""

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
        "NPCs, and chronicles. NPC updates are partial — only send the fields "
        "you want to change."
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
        "year_born, year_died, pronoun, manor, faction, glory, and notes for each. "
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
    glory: int = 0,
    notes: str = "",
    eligibility: str = "",
) -> dict:
    body = {
        "name": name, "role": role, "status": status, "pronoun": pronoun,
        "manor": manor, "household": household, "faction": faction,
        "glory": glory, "notes": notes, "eligibility": eligibility,
    }
    if year_born is not None:
        body["year_born"] = year_born
    return _api("POST", "/api/mcp/npc", json=body)


@mcp.tool(
    description=(
        "Update an NPC's fields. PARTIAL UPDATE — only the fields you pass are "
        "changed; everything else stays as-is. Use for targeted edits like "
        "'add a note', 'change status to Dead', 'set glory to 1500'. "
        "If status changes to 'Dead', the NPC automatically moves to the dead list "
        "(and vice versa back to living). "
        "Updatable fields: name, role, household, status, year_born, year_died, "
        "pronoun, manor, faction, glory, notes, eligibility, dowry, passions, "
        "skills, stats, con, blessed, blessed_note, barren, fate_touched, "
        "out_of_story, out_of_story_note, round_table, statblock_template, "
        "and training fields (page_placed, page_court, training_path, etc)."
    )
)
def update_npc(
    npc_id: str,
    name: str = "",
    role: str = "",
    status: str = "",
    year_born: int | None = None,
    year_died: int | None = None,
    pronoun: str = "",
    manor: str = "",
    household: str = "",
    faction: str = "",
    glory: int | None = None,
    notes: str = "",
    eligibility: str = "",
    dowry: str = "",
    passions: str = "",
    skills: str = "",
    stats: str = "",
) -> dict:
    body = {}
    if name:
        body["name"] = name
    if role:
        body["role"] = role
    if status:
        body["status"] = status
    if year_born is not None:
        body["year_born"] = year_born
    if year_died is not None:
        body["year_died"] = year_died
    if pronoun:
        body["pronoun"] = pronoun
    if manor:
        body["manor"] = manor
    if household:
        body["household"] = household
    if faction:
        body["faction"] = faction
    if glory is not None:
        body["glory"] = glory
    if notes:
        body["notes"] = notes
    if eligibility:
        body["eligibility"] = eligibility
    if dowry:
        body["dowry"] = dowry
    if passions:
        body["passions"] = passions
    if skills:
        body["skills"] = skills
    if stats:
        body["stats"] = stats
    if not body:
        return {"error": "No fields to update"}
    return _api("PATCH", f"/api/mcp/npc/{npc_id}", json=body)


# ── Chronicle Write Tools ────────────────────────────────────────────────────

@mcp.tool(
    description=(
        "Add a chronicle entry to a specific game year. 'year' is the numeric "
        "game year (e.g. 502). 'text' is the event description. "
        "'cat' is the category (default 'political' — also: 'death', 'battle', "
        "'marriage', 'birth', 'religious', 'custom')."
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
    text: str = "",
    cat: str = "",
) -> dict:
    body = {}
    if text:
        body["text"] = text
    if cat:
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
    title: str = "",
    summary: str = "",
    notes: str = "",
) -> dict:
    body = {}
    if title:
        body["title"] = title
    if summary:
        body["summary"] = summary
    if notes:
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
    text: str = "",
    status: str = "",
    notes: str = "",
    completed: str = "",
) -> dict:
    body = {}
    if text:
        body["text"] = text
    if status:
        body["status"] = status
    if notes:
        body["notes"] = notes
    if completed:
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
    game_year: str = "",
    location: str = "",
    status: str = "",
    previous_session_id: str = "",
    previously: str = "",
    arcs_in_play: list | None = None,
    npcs_staged: list | None = None,
    open_questions: list | None = None,
    gm_notes: list | None = None,
) -> dict:
    body = {}
    if session_number is not None:
        body["session_number"] = session_number
    if game_year:
        body["game_year"] = game_year
    if location:
        body["location"] = location
    if status:
        body["status"] = status
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
    if not body:
        return {"error": "No fields to update"}
    return _api("PUT", f"/api/prep/{prep_id}", json=body)


@mcp.tool(
    description="Delete a session prep object permanently."
)
def delete_prep(prep_id: str) -> dict:
    return _api("DELETE", f"/api/prep/{prep_id}")


# ── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if "--http" in sys.argv:
        mcp.settings.host = "127.0.0.1"
        mcp.settings.port = 8766
        mcp.settings.transport_security = TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=[
                "127.0.0.1:*",
                "localhost:*",
                "mcp.pendragon-binder.com",
            ],
        )
        mcp.run(transport="streamable-http")
    else:
        mcp.run(transport="stdio")
