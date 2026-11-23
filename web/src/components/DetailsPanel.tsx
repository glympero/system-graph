import type { GraphIndex } from '../core/graph.ts';
import type { GraphNode } from '../core/types.ts';
import { TYPE_LABEL } from '../theme.ts';
import { EvidenceList } from './EvidenceList.tsx';

interface Props {
  index: GraphIndex;
  node: GraphNode;
  onAsk: (question: string, nodeId: string) => void;
  onImpactLens: (nodeId: string) => void;
  onClose: () => void;
}

interface Scaling {
  replicas?: number;
  min?: number;
  max?: number;
  min_available?: number;
  metrics?: string[];
  file: string;
  line: number;
}

function scalingText(key: 'deployment' | 'hpa' | 'pdb', value: Scaling): string {
  if (key === 'deployment') return `${value.replicas} replicas`;
  if (key === 'hpa') return `autoscale ${value.min} to ${value.max} on ${value.metrics?.join(', ')}`;
  return `PDB minAvailable ${value.min_available}`;
}

const TEXT_PROPS =['description', 'owner', 'tier', 'method', 'path', 'schema', 'topic', 'service', 'dead_letter_topic'];

export function DetailsPanel({ index, node, onAsk, onImpactLens, onClose }: Props) {
  const props = node.props ?? {};
  const scaling = (['deployment', 'hpa', 'pdb'] as const).flatMap((key) => {
    const value = props[key] as Scaling | undefined;
    if (!value) return [];
    const text = scalingText(key, value);
    return [{ key, text, evidence: { file: value.file, line: value.line, note: text } }];
  });
  const findings = index.findings.findings.filter((f) => f.nodes.includes(node.id));
  const counts = { out: index.outgoing(node.id).length, in: index.incoming(node.id).length };
  return (
    <section className="panel" aria-labelledby="details-title">
      <header className="panel-head">
        <h2 id="details-title">
          <span className="type">{TYPE_LABEL[node.type] ?? node.type}</span> {node.name}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </header>
      <dl className="props">
        {TEXT_PROPS.filter((k) => props[k] !== undefined).map((k) => (
          <div key={k}>
            <dt>{k.replace('_', ' ')}</dt>
            <dd>{String(props[k])}</dd>
          </div>
        ))}
        {node.repo && (
          <div>
            <dt>repo</dt>
            <dd>{node.repo}</dd>
          </div>
        )}
        {props.ordered !== undefined && (
          <div>
            <dt>ordered</dt>
            <dd>{props.ordered ? 'yes' : 'no'}</dd>
          </div>
        )}
        <div>
          <dt>edges</dt>
          <dd>{counts.out} out, {counts.in} in</dd>
        </div>
      </dl>
      {node.file && node.line && <EvidenceList index={index} evidence={[{ file: node.file, line: node.line, note: 'declared here' }]} />}
      {scaling.length > 0 && <EvidenceList index={index} evidence={scaling.map((s) => s.evidence)} />}
      {findings.length > 0 && (
        <ul className="node-findings">
          {findings.map((f) => (
            <li key={f.id} className={`label-${f.label.toLowerCase()}`}>
              <strong>{f.label}</strong> {f.message}
            </li>
          ))}
        </ul>
      )}
      <div className="panel-buttons">
        <button type="button" onClick={() => onAsk('impact', node.id)}>What breaks if this changes?</button>
        <button type="button" onClick={() => onAsk('connects', node.id)}>What connects to this?</button>
        <button type="button" onClick={() => onImpactLens(node.id)}>Open in Impact lens</button>
      </div>
    </section>
  );
}
