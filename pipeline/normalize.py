"""Name normalization shared by the pipeline (contracts §1.5, §2.7)."""
import re

FACILITY_SUFFIXES = re.compile(r"\b(sub|substation|switching station|ss|ts|ds)\.?$", re.IGNORECASE)
ZONE_PREFIX = re.compile(r"^[A-Z]{2,4}:\s*")


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def facility_name(raw: str) -> str:
    """'Hooks Sub' -> 'Hooks'; 'SAV: MCINTOSH' -> 'MCINTOSH'; keeps distinctive words like 'Primary'."""
    name = ZONE_PREFIX.sub("", raw.strip())
    name = re.sub(r"\s*\([^)]*\)", "", name)  # "(SAV)", "(USA)" qualifiers
    return FACILITY_SUFFIXES.sub("", name).strip(" -,")


def endpoint_id(state: str, raw_name: str) -> str:
    return f"{state.lower()}:{slug(facility_name(raw_name))}"


VOLTAGE_TAIL = re.compile(r"\s*\d+(?:\.\d+)?(?:\s*[-/]\s*\d+(?:\.\d+)?)*\s*kV.*$", re.IGNORECASE)


def endpoint_names(title: str) -> list[str]:
    """Facility names from a project title.

    'Hooks - Thurmond 115 kV Tie: Rebuild' -> ['Hooks', 'Thurmond'];
    'SAV: GOSHEN (SAV) - MCINTOSH 115KV LINE REBUILD' -> ['GOSHEN', 'MCINTOSH'].
    """
    head = ZONE_PREFIX.sub("", title.strip())
    head = re.sub(r"\s*\([^)]*\)?", "", head)  # qualifiers like (SAV), (USA), unclosed "(..."
    head = re.split(r"[:,&]|\s/\s?|/(?=[A-Za-z])", head)[0]
    head = VOLTAGE_TAIL.sub("", head)
    parts = re.split(r"\s*[-–]\s*", head)
    return [re.sub(r"\s+", " ", p).strip() for p in parts if p.strip() and not re.fullmatch(r"[\d.]+", p.strip())]
