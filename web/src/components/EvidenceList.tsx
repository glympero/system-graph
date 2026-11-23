import type { GraphIndex } from '../core/graph.ts';
import type { Evidence } from '../core/types.ts';

export function EvidenceList({ index, evidence }: { index: GraphIndex; evidence: readonly Evidence[] }) {
  return (
    <ul className="evidence">
      {evidence.map((ev) => {
        const url = index.evidenceUrl(ev);
        const where = `${ev.file}:${ev.line}`;
        return (
          <li key={`${where}|${ev.note ?? ''}`}>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {where}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            ) : (
              <code>{where}</code>
            )}
            {ev.note && <span className="note">{ev.note}</span>}
          </li>
        );
      })}
    </ul>
  );
}
