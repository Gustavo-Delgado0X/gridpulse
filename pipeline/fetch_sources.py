"""Fetch and cache external location data (contracts §1.5).

OpenStreetMap via Overpass: power substations/plants per state area. Results are cached under
data/cache/ (gitignored) and only refetched with --refresh. Data (c) OpenStreetMap contributors, ODbL.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parents[1] / "data" / "cache"
USER_AGENT = "GridPulse/0.1 (ShellHacks 2026 hackathon project)"
OVERPASS_MIRRORS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
STATES = ("SC", "GA")
RETRY_PAUSE_S = 10


def substation_query(state: str) -> str:
    return (f'[out:json][timeout:170];area["ISO3166-2"="US-{state}"][admin_level=4]->.s;'
            f'(nwr["power"~"^(substation|plant)$"](area.s););out center tags;')


def _post(url: str, query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    request = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=200) as response:
        payload = json.loads(response.read())
    if "elements" not in payload:
        raise ValueError(f"unexpected Overpass payload from {url}")
    return payload


def fetch_overpass(query: str, target: Path, refresh: bool = False) -> dict:
    if target.exists() and not refresh:
        return json.loads(target.read_text())
    errors = []
    for attempt, url in enumerate(OVERPASS_MIRRORS * 2):
        try:
            payload = _post(url, query)
        except (OSError, ValueError) as exc:  # urllib errors are OSError subclasses
            errors.append(f"{url}: {exc}")
            time.sleep(RETRY_PAUSE_S * (attempt + 1) // 2)
            continue
        target.write_text(json.dumps(payload))
        return payload
    raise RuntimeError("all Overpass mirrors failed:\n" + "\n".join(errors))


def main(argv: list[str]) -> None:
    refresh = "--refresh" in argv
    CACHE.mkdir(parents=True, exist_ok=True)
    for state in STATES:
        payload = fetch_overpass(substation_query(state), CACHE / f"osm_power_{state}.json", refresh)
        print(f"{state}: {len(payload['elements'])} OSM power features")


if __name__ == "__main__":
    main(sys.argv)
