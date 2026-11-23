import type { GraphIndex } from './graph.ts';
import { runQuestion } from './questions.ts';
import type { GraphEdge, NodeType, Relation } from './types.ts';

export type Lens = 'services' | 'events' | 'data' | 'impact';

export const LENSES: readonly { id: Lens; label: string; hint: string }[] = [
  { id: 'services', label: 'Services', hint: 'Services, topics and schemas. Endpoints fold into services, tables into schemas, subscriptions into topics.' },
  { id: 'events', label: 'Events', hint: 'Who publishes and who subscribes, including Terraform subscriptions.' },
  { id: 'data', label: 'Data', hint: 'Which service reads and writes which table.' },
  { id: 'impact', label: 'Impact', hint: 'Everything that depends on the selected node, up to N steps away.' },
];

export interface ViewNode {
  id: string;
  type: NodeType;
  label: string;
}

export interface ViewEdge {
  id: string;
  from: string;
  to: string;
  rel: Relation;
  edges: GraphEdge[]; // the original edges folded into this one, for evidence
}

export interface View {
  nodes: ViewNode[];
  edges: ViewEdge[];
}

const RELS: Record<Exclude<Lens, 'impact'>, readonly Relation[]> = {
  services: ['calls', 'publishes', 'subscribes', 'reads_table', 'writes_table'],
  events: ['publishes', 'subscribes'],
  data: ['reads_table', 'writes_table'],
};

/** Where a node is drawn in a lens: itself, folded into its owner, or hidden (undefined). */
export function displayId(ix: GraphIndex, lens: Lens, id: string): string | undefined {
  const type = ix.node(id).type;
  if (type === 'repo') return undefined;
  if (lens === 'services') return type === 'endpoint' || type === 'table' || type === 'subscription' ? ix.ownerOf(id) : id;
  if (lens === 'events') return type === 'service' || type === 'topic' || type === 'subscription' ? id : undefined;
  if (lens === 'data') return type === 'service' || type === 'table' ? id : undefined;
  return type === 'endpoint' ? ix.ownerOf(id) : id;
}

export function buildView(ix: GraphIndex, lens: Lens, focus?: string, depth = 2): View {
  let keep: Set<string> | undefined;
  let rels: readonly Relation[] = lens === 'impact' ? RELS.services : RELS[lens];
  if (lens === 'impact') {
    if (!focus || !ix.nodes.has(focus)) return { nodes: [], edges: [] };
    const answer = runQuestion(ix, 'impact', { node: focus, depth: String(depth) });
    keep = new Set([focus, ...answer.rows.map((r) => r.nodeIds[0])]);
    rels = [...RELS.services];
  }
  const edges = new Map<string, ViewEdge>();
  const used = new Set<string>();
  for (const edge of ix.data.edges) {
    if (!rels.includes(edge.rel)) continue;
    const from = displayId(ix, lens, edge.from);
    const to = displayId(ix, lens, edge.to);
    if (!from || !to || from === to) continue;
    if (keep && !(keep.has(edge.from) || keep.has(from))) continue;
    if (keep && !(keep.has(edge.to) || keep.has(to))) continue;
    const id = `${from}|${edge.rel}|${to}`;
    const view = edges.get(id) ?? { id, from, to, rel: edge.rel, edges: [] };
    view.edges.push(edge);
    edges.set(id, view);
    used.add(from).add(to);
  }
  // Services stay visible in the services lens even with no edges, so nothing silently disappears.
  if (lens === 'services') for (const s of ix.ofType('service')) used.add(s.id);
  if (keep) for (const id of keep) used.add(displayId(ix, lens, id) ?? id);
  const nodes = [...used].sort().map((id) => {
    const node = ix.node(id);
    return { id, type: node.type, label: node.type === 'schema' ? `${node.name} schema` : node.name };
  });
  return { nodes, edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
