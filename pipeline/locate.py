"""Locate project endpoints (contracts §1.5), following Sperry's "Finding Real Locations" guide.

Order: OSM feature by name (own state, then the neighboring state for tie lines), disambiguated by
the GPC planning zone; then Sperry answer-key coordinates; then manual overrides; else unresolved.
Every result carries precision, method, source and whether context confirmed it: the GPC planning zone, the
project voltage in the OSM name, or a tie line in the title. A unique name alone is located but not "confirmed";
several same-named candidates with no context are left unresolved rather than guessed.
"""
import re

from pipeline.normalize import facility_name, slug

NEIGHBOR = {"SC": "GA", "GA": "SC"}
# Rough extents of GPC planning zones seen in the study area (lat_min, lat_max, lon_min, lon_max).
ZONE_BOXES = {
    "219": (31.6, 32.8, -82.3, -80.8),   # Savannah
    "215": (32.4, 34.4, -83.4, -81.4),   # Augusta / east Georgia
    "218": (30.3, 32.3, -82.8, -81.1),   # southeast coast (Jesup, Brunswick)
}
WORK_WORDS = re.compile(
    r"\b(bus and jumper replacement|bank [a-z] replacement|equipment replacement|relay modernization|"
    r"reactors? installation|reactor removal|statcom system|breaker replacement|new auto transformer|"
    r"network improvements|transmission improvements|improvements|upgrades|replacement|new build sub|"
    r"new sub|switching station|substation|transmission|sub|ss)\b.*$"
)
OSM_SUFFIXES = re.compile(r"\b(substation|switching station|switchyard|sub|tap|electric)\b")
OSM_FACILITY_TAIL = re.compile(r"\s+(dam|power plant|plant|generating station|nuclear plant|nuclear power plant)$")
SPELLING = ((re.compile(r"\bsaint\b"), "st"), (re.compile(r"borough\b"), "boro"), (re.compile(r"\bft\b"), "fort"))


def _spelling(name: str) -> str:
    for pattern, replacement in SPELLING:
        name = pattern.sub(replacement, name)
    return name


def core_name(raw: str) -> str:
    name = facility_name(raw).lower()
    name = re.sub(r"\bpri\b\.?", "primary", name)
    name = WORK_WORDS.sub("", name)
    return _spelling(re.sub(r"\s+", " ", name).strip(" .-"))


def name_variants(raw: str) -> list[str]:
    core = core_name(raw)
    variants = [core, re.sub(r"\s*#\s*\d+$", "", core)]
    variants.append(re.sub(r"\s+(dam|primary|plant)$", "", variants[-1]))
    return list(dict.fromkeys(v for v in variants if v))


def osm_cores(name: str) -> set[str]:
    """All normalized keys an OSM feature name answers to."""
    base = re.sub(r"\s*\([^)]*\)", "", name.lower())
    base = _spelling(re.sub(r"\s+", " ", OSM_SUFFIXES.sub("", base)).strip(" .-#"))
    return {base, OSM_FACILITY_TAIL.sub("", base)}


def _latlon(element: dict) -> tuple[float, float]:
    center = element.get("center") or element
    return center["lat"], center["lon"]


class OsmIndex:
    """OSM power features grouped by state and normalized name."""

    def __init__(self, elements_by_state: dict[str, list[dict]]):
        self._by_state: dict[str, dict[str, list[dict]]] = {}
        for state, elements in elements_by_state.items():
            names: dict[str, list[dict]] = {}
            for element in elements:
                name = element.get("tags", {}).get("name")
                for core in osm_cores(name) if name else ():
                    names.setdefault(core, []).append(element)
            self._by_state[state] = names

    def find(self, state: str, core: str) -> list[dict]:
        return self._by_state.get(state, {}).get(core, [])


def _in_zone(element: dict, zone: str | None) -> bool:
    box = ZONE_BOXES.get(zone or "")
    if box is None:
        return False
    lat, lon = _latlon(element)
    return box[0] <= lat <= box[1] and box[2] <= lon <= box[3]


def _search(name: str, state: str, index: OsmIndex) -> tuple[list[dict], str] | None:
    for position, variant in enumerate(name_variants(name)):
        found = index.find(state, variant)
        if found:
            return found, "exact" if position == 0 else f"relaxed ('{variant}')"
    return None


def _endpoint(name: str, element: dict, method: str, confirmed: bool, alternatives: list[dict]) -> dict:
    lat, lon = _latlon(element)
    return {
        "id": f"osm:{element['type']}/{element['id']}",
        "name_raw": name,
        "osm_name": element["tags"].get("name"),
        "osm_operator": element["tags"].get("operator"),
        "lat": lat,
        "lon": lon,
        "precision": "osm_feature",
        "method": method,
        "source": "OpenStreetMap (ODbL)",
        "confirmed_by_pdf_context": confirmed,
        "alternatives": [{"id": f"osm:{a['type']}/{a['id']}", "lat": _latlon(a)[0], "lon": _latlon(a)[1]}
                         for a in alternatives],
        "reviewer": None,
    }


def unresolved(name: str, state: str) -> dict:
    return {"id": f"{state.lower()}:{slug(core_name(name) or name)}", "name_raw": name, "lat": None, "lon": None,
            "precision": "unresolved", "method": "no OSM name match", "source": None,
            "confirmed_by_pdf_context": False, "alternatives": [], "reviewer": None}


def _narrow(candidates: list[dict], zone: str | None, voltage_kv: int | None) -> tuple[list[dict], list[str]]:
    reasons = []
    in_zone = [c for c in candidates if _in_zone(c, zone)]
    if in_zone:
        candidates, reasons = in_zone, ["zone match"]
    if len(candidates) > 1 and voltage_kv:
        tag = f"{voltage_kv}kv"
        by_voltage = [c for c in candidates if tag in c["tags"]["name"].lower().replace(" ", "")]
        if by_voltage:
            candidates, reasons = by_voltage, [*reasons, f"{voltage_kv} kV name match"]
    return candidates, reasons


def locate_endpoint(name: str, state: str, zone: str | None, title: str, index: OsmIndex,
                    voltage_kv: int | None = None) -> dict:
    is_tie = bool(re.search(r"\btie\b", title, re.IGNORECASE))
    for search_state, where in ((state, "own state"), (NEIGHBOR[state], "neighboring state")):
        hit = _search(name, search_state, index)
        if hit is None:
            continue
        candidates, how = hit
        pool, reasons = _narrow(candidates, zone, voltage_kv)
        zone_ok = "zone match" in reasons
        if where != "own state" and not (is_tie or zone_ok):
            continue
        if len(pool) > 1:  # several same-named features and no context to choose: do not guess
            return {**unresolved(name, state), "method": f"{len(pool)} OSM features share this name; left unresolved"}
        chosen, others = pool[0], [c for c in candidates if c is not pool[0]]
        tie_context = where != "own state" and is_tie
        confirmed = bool(reasons) or tie_context  # zone box, voltage in the OSM name, or a tie line in the title
        reason = ", ".join(reasons) or "unique OSM name in state"
        method = f"OSM name {how}, {where}, {reason}" + (", tie line" if tie_context else "")
        return _endpoint(name, chosen, method, confirmed, others)
    return unresolved(name, state)
