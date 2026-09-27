"""One-page printable coordination brief (contracts §6.6 Brief). All source text is HTML-escaped."""
from html import escape

from engine.tiers import TIER_LABELS

TIMING = {"same_window": "Same build window", "within_1y": "Within 1 year", "separate": "Separate timing"}
UTILITY = {"DESC": "Dominion Energy South Carolina", "GPC": "Georgia Power"}

STYLE = """
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
body { font: 14px/1.5 "IBM Plex Sans", system-ui, sans-serif; color: #181011; background: #fff; margin: 0; }
.strip { background: #302023; color: #fff; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
.strip span { font: 600 11px/1 system-ui; letter-spacing: .1em; color: #aaa; }
main { padding: 24px; max-width: 8in; margin: 0 auto; }
h1 { font-size: 30px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 8px; }
h2 { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; margin: 24px 0 8px; border-bottom: 1px solid #181011; padding-bottom: 4px; }
.tag { display: inline-block; font: 600 11px/1.2 system-ui; letter-spacing: .1em; text-transform: uppercase; padding: 2px 8px;
  border: 1px solid #181011; border-radius: 4px; margin-right: 6px; }
.tier { background: #6e36b5; border-color: #6e36b5; color: #fff; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card { border: 1px solid #d8d4d4; border-radius: 4px; padding: 12px; }
.mono { font-family: "IBM Plex Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.muted { color: #666; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 8px 0 0; font-size: 13px; }
dt { color: #666; } dd { margin: 0; }
blockquote { margin: 4px 0 10px; padding-left: 8px; border-left: 2px solid #d8d4d4; }
.strip button { font: 600 11px/1 system-ui; letter-spacing: .1em; padding: 6px 12px; border: 1px solid #aaa; border-radius: 100px; background: transparent; color: #fff; cursor: pointer; }
@media print { .strip button { display: none; } }
"""


def _money(value: float | None) -> str:
    return "—" if value is None else f"${value:,.0f}"


def _project(p: dict) -> str:
    window = f"{p['window_start']} → {p['window_end']}" if p.get("window_start") else "not published"
    endpoints = ", ".join(f"{escape(e['name_raw'])} ({escape(e['precision'].replace('_', ' '))})" for e in p["endpoints"])
    cost = _money(p["cost_public"]["total_usd"]) if p.get("cost_public") else "redacted in public filing"
    return f"""<div class="card"><span class="tag">{escape(p['utility'])}</span><span class="mono muted">{escape(p['id'])}</span>
<p><strong>{escape(p['name'])}</strong></p>
<dl><dt>Utility</dt><dd>{escape(UTILITY.get(p['utility'], p['utility']))}</dd>
<dt>In service</dt><dd class="mono">{escape(p['in_service_date'])}</dd>
<dt>Build window</dt><dd class="mono">{escape(window)}</dd>
<dt>Endpoints</dt><dd>{endpoints or '—'}</dd>
<dt>Public cost</dt><dd class="mono">{escape(cost)}</dd>
<dt>Source</dt><dd class="mono">{escape(p['source_id'])} P.{p.get('detail_page') or p['page']}</dd></dl></div>"""


def _evidence(items: list[dict]) -> str:
    rows = []
    for e in items:
        ref = f" <span class='mono muted'>{escape(e['source_id'])} P.{e['page']}</span>" if e.get("page") else ""
        rows.append(f"<div><span class='tag'>{escape(e['label'])}</span>{ref}<blockquote>{escape(e['quote'])}</blockquote></div>")
    return "\n".join(rows)


def render_brief(detail: dict) -> str:
    tier = detail["tier"]
    tier_text = f"{tier} · {TIER_LABELS[tier]}" if tier else "BEYOND 25 MI"
    closest = "touching (shared facility)" if detail["touching"] else f"{detail['dist_closest_mi']:.2f} mi"
    est = detail["estimator"]["result"]
    inputs = detail["estimator"]["inputs"]
    facts = [e for e in detail["evidence"] if e["type"] != "interpretation"]
    interpretation = next((e["quote"] for e in detail["evidence"] if e["type"] == "interpretation"), "")
    a, b = detail["project_a"], detail["project_b"]
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>GridPulse brief · {escape(detail['id'])}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>{STYLE}</style></head><body>
<div class="strip"><strong>GridPulse · coordination brief</strong><span>CANDIDATE FOR HUMAN REVIEW</span>
<button type="button" onclick="window.print()">PRINT</button></div>
<main>
<p><span class="tag tier">{escape(tier_text)}</span><span class="tag">{escape(TIMING[detail['timeline_label']])}</span>
<span class="tag">Rank #{detail['rank']}</span></p>
<h1>{escape(a['name'])} × {escape(b['name'])}</h1>
<p><em>{escape(interpretation)}</em></p>
<h2>Distance and timing</h2>
<dl><dt>Closest points</dt><dd class="mono">{escape(closest)}</dd>
<dt>Centers (Sperry method)</dt><dd class="mono">{detail['dist_center_mi']:.2f} mi</dd>
<dt>In-service gap</dt><dd class="mono">{detail['in_service_gap_days']} days</dd>
<dt>Build-window overlap</dt><dd class="mono">{detail['window_overlap_days'] if detail['window_overlap_days'] is not None else '—'} days</dd>
<dt>Flags</dt><dd>{escape(', '.join(detail['flags']) or 'none')}</dd></dl>
<h2>Projects</h2><div class="grid">{_project(a)}{_project(b)}</div>
<h2>Rough estimate <span class="tag">ROUGH ESTIMATE</span></h2>
<p class="mono muted">{escape(est['formula'])}</p>
<dl><dt>Shared corridor</dt><dd class="mono">{inputs['shared_corridor_mi']:.1f} mi (edit in the app)</dd>
<dt>ROW width</dt><dd class="mono">{inputs['row_width_ft']} ft (team assumption)</dd>
<dt>Mobilization saved</dt><dd class="mono">{_money(est['mobilization_saved_usd'])}</dd>
<dt>Estimated value</dt><dd class="mono">{_money(est['total_usd'])}</dd></dl>
<h2>Evidence</h2>{_evidence(facts)}
<p class="muted">Sources: DESC $2M+ project lists (scrtp.com), Georgia Power 2025 IRP Vol. 3 public disclosure (unredacted fields only),
OpenStreetMap (ODbL), Sperry answer key. Generated by GridPulse.</p>
</main></body></html>"""
