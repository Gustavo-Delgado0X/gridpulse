export function ExportMenu({ briefUrl, csvUrl }: { briefUrl: string | null; csvUrl: string }) {
  return (
    <div className="export">
      {briefUrl && <a className="btn btn--pill" href={briefUrl} target="_blank" rel="noreferrer">Export brief</a>}
      <a className="btn btn--ghost" href={csvUrl} download>CSV (Sperry format)</a>
    </div>
  );
}
