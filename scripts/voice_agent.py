"""Create the GridPulse voice agent (ElevenLabs Agents) and its client tools.

Usage:  python scripts/voice_agent.py ~/.elevenlabs_key     # prints only the new agent id
        python scripts/voice_agent.py --dry-run              # prints the payloads, no key needed

The agent knows nothing on its own: every fact comes from a client tool that the browser answers from the GridPulse
API (frontend/src/components/VoiceAgent.tsx implements the same tool names). The prompt forbids guessing.
"""
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

API = "https://api.elevenlabs.io/v1/convai"
VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # same premade voice as the read-aloud briefing
TTS_MODEL = "eleven_flash_v2"  # English agents require a v2 turbo/flash model

PROMPT = """You are the GridPulse analyst, a voice guide to the Savannah / Augusta study for Sperry Tech's
GridLock challenge.
GridPulse compares Dominion Energy South Carolina (DESC) and Georgia Power (GPC) transmission plans and ranks the
cross-utility project pairs that should coordinate. Tiers: T1 touching or a shared facility (must coordinate),
T2 under 1 mile (share land), T3 under 5 miles (share logistics), T4 within 25 miles (share crews).

Rules:
- You know nothing about the data except what your tools return. Call a tool before stating any number, name,
  date, tier or page. Never guess, round away detail, or fill gaps; if a tool does not say it, say you don't know.
- When you state a source fact, say where it comes from, e.g. "page 31 of DESC's 2024 to 2028 list".
- Distances are measured at closest points; Sperry's center-to-center distance is a second method. Say which.
- Locations come from OpenStreetMap only; unresolved endpoints are not guessed. Sperry's answer key is a benchmark.
- Every opportunity is a candidate for human review, not a decision. Never recommend skipping review.
- When the user asks to see, open or show a pair, call show_opportunity so it opens on screen, then describe it.
- Speak plainly and briefly: two to four sentences, then offer a next step.
- Say "T one", "T two" and so on for tiers.
- Stay on this study. Politely decline unrelated requests."""

FIRST_MESSAGE = ("Hi, I'm the GridPulse analyst. I can walk you through the ranked opportunities between "
                 "Dominion Energy "
                 "South Carolina and Georgia Power, explain any pair, or tell you what changed between plan editions. "
                 "Where would you like to start?")


def _tool(name: str, description: str, properties: dict | None = None, required: list[str] | None = None) -> dict:
    return {"tool_config": {
        "type": "client", "name": name, "description": description, "expects_response": True,
        "response_timeout_secs": 15,
        "parameters": {"type": "object", "properties": properties or {}, "required": required or []},
    }}


RANK = {"rank": {"type": "integer", "description": "Rank of the pair in the list, 1 is the most important."}}

TOOLS = [
    _tool("get_study_summary", "Overview of the study: number of projects, pairs, tiers, plan changes, data quality "
          "and validation results, plus the top three pairs. Call this first for general questions."),
    _tool("list_opportunities", "Ranked cross-utility pairs, optionally filtered to one tier.",
          {"tier": {"type": "string", "description": "Optional tier filter: T1, T2, T3 or T4."},
           "limit": {"type": "integer", "description": "How many pairs to return, 1 to 10. Default 5."}}),
    _tool("get_opportunity", "Full detail for one pair: projects, tier, closest and center distances, timing, "
          "flags, and source facts with page numbers.", RANK, ["rank"]),
    _tool("get_plan_changes", "Changes between plan editions (schedule slips, cost changes, renames, source "
          "conflicts) for projects whose name or id matches the query.",
          {"query": {"type": "string", "description": "Project name words or id, e.g. 'Jasper' or 'McIntosh'."}},
          ["query"]),
    _tool("get_data_quality", "Data-quality summary: located vs unresolved endpoints, issue counts by kind, "
          "coordinate conflicts, and the answer-key validation."),
    _tool("show_opportunity", "Open a pair on the user's screen (detail panel and map). Use whenever the user asks "
          "to see, open or show a pair.", RANK, ["rank"]),
]
TOOL_NAMES = [t["tool_config"]["name"] for t in TOOLS]


def agent_payload(tool_ids: list[str]) -> dict:
    return {
        "name": "GridPulse analyst",
        "conversation_config": {
            "agent": {"first_message": FIRST_MESSAGE, "language": "en",
                      "prompt": {"prompt": PROMPT, "temperature": 0, "tool_ids": tool_ids}},
            "tts": {"voice_id": VOICE_ID, "model_id": TTS_MODEL},
            "conversation": {"max_duration_seconds": 600},
        },
        "platform_settings": {"auth": {"enable_auth": True}},  # sessions need a signed URL from our server
    }


def _post(path: str, key: str, payload: dict) -> dict:
    request = Request(f"{API}{path}", method="POST", data=json.dumps(payload).encode(),
                      headers={"xi-api-key": key, "Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read())


def main(argv: list[str]) -> int:
    if argv[1:] == ["--dry-run"]:
        print(json.dumps({"tools": TOOLS, "agent": agent_payload(["<tool ids>"])}, indent=1))
        return 0
    key = Path(argv[1]).expanduser().read_text().strip()
    tool_ids = [_post("/tools", key, tool)["id"] for tool in TOOLS]
    print(_post("/agents/create", key, agent_payload(tool_ids))["agent_id"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
