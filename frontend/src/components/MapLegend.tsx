export function MapLegend() {
  return (
    <aside className="legend" aria-label="Map legend">
      <span className="legend__item"><span className="shape shape--circle chip--DESC" aria-hidden="true" /> DESC project</span>
      <span className="legend__item"><span className="shape shape--square chip--GPC" aria-hidden="true" /> GPC project</span>
      <span className="legend__item"><span className="swatch swatch--T1" aria-hidden="true" /> T1 touching (ring = shared facility)</span>
      <span className="legend__item"><span className="swatch swatch--T2" aria-hidden="true" /> T2 &lt; 1 mi</span>
      <span className="legend__item"><span className="swatch swatch--T3" aria-hidden="true" /> T3 &lt; 5 mi (dashed)</span>
      <span className="legend__item"><span className="swatch swatch--T4" aria-hidden="true" /> T4 ≤ 25 mi (dotted)</span>
      <span className="legend__item"><span className="shape shape--circle shape--hollow" aria-hidden="true" /> hollow = approximate location</span>
      <span className="legend__item muted">Unresolved endpoints are not drawn · © OpenStreetMap contributors (ODbL) · US Census boundaries</span>
    </aside>
  );
}
