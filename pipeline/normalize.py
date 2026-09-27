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
