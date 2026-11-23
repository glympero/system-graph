import type { Evidence, FindingsData, GraphData, GraphEdge, GraphNode, NodeType } from './types.ts';

/** In-memory adjacency over graph.json plus findings.json. Framework-free, shared by the UI and the MCP server. */
export class GraphIndex {
  readonly nodes = new Map<string, GraphNode>();
  readonly out = new Map<string, GraphEdge[]>();
  readonly in = new Map<string, GraphEdge[]>();
  readonly data: GraphData;
  readonly findings: FindingsData;

  constructor(data: GraphData, findings: FindingsData) {
    this.data = data;
    this.findings = findings;
    for (const node of data.nodes) this.nodes.set(node.id, node);
    for (const edge of data.edges) {
      push(this.out, edge.from, edge);
      push(this.in, edge.to, edge);
    }
  }

  node(id: string): GraphNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`unknown node ${id}`);
    return node;
  }

  outgoing(id: string): GraphEdge[] {
    return this.out.get(id) ?? [];
  }

  incoming(id: string): GraphEdge[] {
    return this.in.get(id) ?? [];
  }

  ofType(type: NodeType): GraphNode[] {
    return this.data.nodes.filter((n) => n.type === type);
  }

  /** The service an endpoint belongs to, the schema a table lives in, the topic a subscription reads. */
  ownerOf(id: string): string | undefined {
    const node = this.node(id);
    const props = node.props ?? {};
    if (node.type === 'endpoint') return `service:${String(props.service)}`;
    if (node.type === 'table') return `schema:${String(props.schema)}`;
    if (node.type === 'subscription') return `topic:${String(props.topic)}`;
    return undefined;
  }

  /** A call edge seen at service level: endpoint targets fold into their service. */
  callTarget(edge: GraphEdge): string {
    return this.node(edge.to).type === 'endpoint' ? (this.ownerOf(edge.to) as string) : edge.to;
  }

  /** An edge in words, for evidence notes: `payments-service writes orders.orders`. */
  describe(edge: GraphEdge): string {
    const target = this.node(edge.to);
    const to = target.type === 'endpoint' ? `${String(target.props?.service)} ${target.name}` : target.name;
    return `${this.node(edge.from).name} ${REL_TEXT[edge.rel] ?? edge.rel} ${to}`;
  }

  evidence(edge: GraphEdge): Evidence {
    return { file: edge.file, line: edge.line, note: this.describe(edge) };
  }

  /** Find a node by exact id, exact name, or a unique partial match, so people and assistants can type names. */
  resolve(query: string): GraphNode | undefined {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    const exact = this.nodes.get(query.trim());
    if (exact) return exact;
    const byName = this.data.nodes.filter((n) => n.name.toLowerCase() === q && n.type !== 'repo');
    if (byName.length > 0) return byName.sort((a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type])[0];
    const partial = this.search(q);
    return partial.length === 1 ? partial[0] : undefined;
  }

  search(query: string, types?: readonly NodeType[], limit = 50): GraphNode[] {
    const q = query.trim().toLowerCase();
    return this.data.nodes
      .filter((n) => n.type !== 'repo' && (!types || types.includes(n.type)))
      .filter((n) => !q || n.id.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))
      .slice(0, limit);
  }

  /** Link to the exact line on the repo host, when the repo declares a link template. */
  evidenceUrl(evidence: Evidence): string | undefined {
    const slash = evidence.file.indexOf('/');
    const repo = this.nodes.get(`repo:${evidence.file.slice(0, slash)}`);
    const template = repo?.props?.link;
    if (typeof template !== 'string') return undefined;
    return template.replaceAll('{path}', evidence.file.slice(slash + 1)).replaceAll('{line}', String(evidence.line));
  }
}

const REL_TEXT: Partial<Record<GraphEdge['rel'], string>> = {
  publishes: 'publishes to',
  subscribes: 'subscribes to',
  reads_table: 'reads',
  writes_table: 'writes',
  declared_dependency: 'declares a dependency on',
};

const TYPE_RANK: Record<NodeType, number> = {
  service: 0,
  table: 1,
  topic: 2,
  endpoint: 3,
  subscription: 4,
  schema: 5,
  function: 6,
  library: 7,
  repo: 8,
};

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

