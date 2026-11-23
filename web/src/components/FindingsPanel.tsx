import type { GraphIndex } from '../core/graph.ts';
import type { Finding, Label } from '../core/types.ts';
import { EvidenceList } from './EvidenceList.tsx';

const ORDER: readonly Label[] = ['Bad', 'Gap', 'Good'];

interface Props {
  index: GraphIndex;
  selected?: string;
  onSelect: (finding: Finding | undefined) => void;
}

export function FindingsPanel({ index, selected, onSelect }: Props) {
  const findings = index.findings.findings;
  return (
    <section className="panel" aria-labelledby="findings-title">
      <header className="panel-head">
        <h2 id="findings-title">Findings ({findings.length})</h2>
      </header>
      {ORDER.map((label) => {
        const group = findings.filter((f) => f.label === label);
        if (group.length === 0) return null;
        return (
          <div key={label}>
            <h3 className={`label label-${label.toLowerCase()}`}>
              {label} <span className="count">{group.length}</span>
            </h3>
            <ul className="findings">
              {group.map((f) => {
                const open = f.id === selected;
                return (
                  <li key={f.id} className={open ? 'open' : undefined}>
                    <button type="button" aria-expanded={open} onClick={() => onSelect(open ? undefined : f)}>
                      <span className="rule">{f.rule}</span> {f.message}
                    </button>
                    {open && (
                      <div className="finding-body">
                        <p className="detail">{f.title}</p>
                        <EvidenceList index={index} evidence={f.evidence} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
