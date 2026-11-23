import type { GraphIndex } from './graph.ts';
import type { Evidence, GraphEdge, GraphNode, NodeType } from './types.ts';

export interface Param {
  name: string;
  label: string;
  kind: 'node' | 'depth' | 'rule';
  types?: readonly NodeType[];
  optional?: boolean;
}

export interface Row {
  label: string;
  nodeIds: string[];
  evidence: Evidence[];
  depth?: number;
  detail?: string;
}

export interface Answer {
  question: string;
  title: string;
  summary: string;
  rows: Row[];
}

export interface Question {
  id: string;
  title: string;
  description: string;
  params: readonly Param[];
  run: (ix: GraphIndex, args: Record<string, string>) => Answer;
}

const SERVICES = ['service'] as const;

function nodeArg(ix: GraphIndex, args: Record<string, string>, name: string): GraphNode {
  const query = args[name] ?? '';
  const node = ix.resolve(query);
  if (!node) throw new Error(`No node matches "${query}". Try an id like service:orders-service or a name.`);
  return node;
}

/** Collapse edges into one row per label, keeping every edge as evidence. */
function grouped(ix: GraphIndex, entries: { label: string; nodeIds: string[]; edge: GraphEdge }[]): Row[] {
  const rows = new Map<string, Row>();
  for (const { label, nodeIds, edge } of entries) {
    const row = rows.get(label) ?? { label, nodeIds, evidence: [] };
    row.evidence.push(ix.evidence(edge));
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
}

const name = (ix: GraphIndex, id: string): string => ix.node(id).name;

function callLabel(ix: GraphIndex, edge: GraphEdge): string {
  const target = ix.node(edge.to);
  if (target.type === 'endpoint') return `${name(ix, ix.callTarget(edge))} ${target.name}`;
  const unmatched = edge.props?.unmatched;
  return typeof unmatched === 'string' ? `${target.name} ${unmatched}` : target.name;
}

/** Calls into a service land on its endpoints, or on the service itself when no route matched. */
function incomingCalls(ix: GraphIndex, serviceId: string): GraphEdge[] {
  const endpoints = ix.outgoing(serviceId).filter((e) => e.rel === 'exposes').map((e) => e.to);
  return [serviceId, ...endpoints].flatMap((id) => ix.incoming(id).filter((e) => e.rel === 'calls'));
}

const isTableUse = (e: GraphEdge): boolean => e.rel === 'reads_table' || e.rel === 'writes_table';
const isStructural = (e: GraphEdge): boolean => e.rel === 'exposes' || e.rel === 'declared_dependency';
const verbOf = (e: GraphEdge): string => e.rel.replace('_table', '');

type Entry = { label: string; nodeIds: string[]; edge: GraphEdge };

function outgoingEntry(ix: GraphIndex, edge: GraphEdge): Entry {
  if (edge.rel === 'calls') return { label: `calls ${callLabel(ix, edge)}`, nodeIds: [ix.callTarget(edge), edge.to], edge };
  return { label: `${verbOf(edge)} ${name(ix, edge.to)}`, nodeIds: [edge.to], edge };
}

function incomingEntry(ix: GraphIndex, edge: GraphEdge): Entry {
  const nodeIds = [edge.from, edge.to];
  if (edge.rel !== 'calls') return { label: `${verbOf(edge)} by ${name(ix, edge.from)}`, nodeIds, edge };
  const target = ix.node(edge.to);
  const route = target.type === 'endpoint' ? target.name : edge.props?.unmatched;
  const via = typeof route === 'string' ? ` ${route}` : '';
  return { label: `called by ${name(ix, edge.from)}${via}`, nodeIds, edge };
}

function connects(ix: GraphIndex, args: Record<string, string>): Answer {
  const node = nodeArg(ix, args, 'node');
  const incoming = node.type === 'service' ? incomingCalls(ix, node.id) : ix.incoming(node.id);
  const rows = grouped(ix, [
    ...ix.outgoing(node.id).filter((e) => !isStructural(e)).map((e) => outgoingEntry(ix, e)),
    ...incoming.filter((e) => !isStructural(e)).map((e) => incomingEntry(ix, e)),
  ]);
  return { question: 'connects', title: `What connects to ${node.name}`, summary: `${rows.length} connections.`, rows };
}

function callers(ix: GraphIndex, args: Record<string, string>): Answer {
  const node = nodeArg(ix, args, 'node');
  const edges = node.type === 'service' ? incomingCalls(ix, node.id) : ix.incoming(node.id).filter((e) => e.rel === 'calls');
  const rows = grouped(ix, edges.map((edge) => ({
    label: `${name(ix, edge.from)} calls ${callLabel(ix, edge)}`,
    nodeIds: [edge.from, edge.to],
    edge,
  })));
  return { question: 'callers', title: `Who calls ${node.name}`, summary: `${rows.length} callers.`, rows };
}

function byRelation(rel: 'publishes' | 'subscribes', question: string, verb: string) {
  return (ix: GraphIndex, args: Record<string, string>): Answer => {
    const node = nodeArg(ix, args, 'node');
    const rows = grouped(ix, ix.incoming(node.id).filter((e) => e.rel === rel).map((edge) => ({
      label: name(ix, edge.from),
      nodeIds: [edge.from, node.id],
      edge,
    })));
    return { question, title: `Who ${verb} ${node.name}`, summary: `${rows.length} ${question}.`, rows };
  };
}

function tableUsers(ix: GraphIndex, args: Record<string, string>): Answer {
  const node = nodeArg(ix, args, 'node');
  const rows = grouped(ix, ix.incoming(node.id).filter(isTableUse).map((edge) => ({
    label: `${name(ix, edge.from)} ${edge.rel === 'reads_table' ? 'reads' : 'writes'}`,
    nodeIds: [edge.from, node.id],
    edge,
  })));
  return { question: 'table-users', title: `Who uses ${node.name}`, summary: `${rows.length} usages.`, rows };
}

/** Services subscribed to a topic, directly in code or through a Terraform subscription labelled with a service. */
function topicSubscribers(ix: GraphIndex, topicId: string): [string, GraphEdge][] {
  const result: [string, GraphEdge][] = [];
  for (const edge of ix.incoming(topicId).filter((e) => e.rel === 'subscribes')) {
    const from = ix.node(edge.from);
    const owner = from.type === 'subscription' ? `service:${String(from.props?.service)}` : edge.from;
    if (ix.nodes.has(owner)) result.push([owner, edge]);
  }
  return result;
}

/** One step of "who depends on this": the services that break when the node changes. */
function dependents(ix: GraphIndex, id: string): [string, GraphEdge][] {
  const node = ix.node(id);
  const users = (target: string) => ix.incoming(target).filter(isTableUse).map((e): [string, GraphEdge] => [e.from, e]);
  switch (node.type) {
    case 'table':
      return users(id);
    case 'schema':
      return ix.ofType('table').filter((t) => ix.ownerOf(t.id) === id).flatMap((t) => users(t.id));
    case 'endpoint':
      return ix.incoming(id).filter((e) => e.rel === 'calls').map((e) => [e.from, e]);
    case 'topic':
      return topicSubscribers(ix, id);
    case 'subscription':
      return topicSubscribers(ix, `topic:${String(node.props?.topic)}`).filter(([, e]) => e.from === id);
    case 'service':
      return [
        ...incomingCalls(ix, id).map((e): [string, GraphEdge] => [e.from, e]),
        ...ix.outgoing(id).filter((e) => e.rel === 'publishes').flatMap((e) => topicSubscribers(ix, e.to)),
      ];
    default:
      return [];
  }
}

/** Add the services one step past `frontier` to `found`; returns the ones seen for the first time. */
function expand(ix: GraphIndex, startId: string, frontier: string[], depth: number, found: Map<string, Row>): string[] {
  const next: string[] = [];
  for (const id of frontier) {
    for (const [service, edge] of dependents(ix, id)) {
      const known = found.get(service);
      if (service === startId || (known && known.depth !== depth)) continue;
      const row = known ?? { label: name(ix, service), nodeIds: [service], evidence: [], depth,
        detail: `${depth === 1 ? 'directly' : `${depth} steps`} via ${name(ix, id)}` };
      row.evidence.push(ix.evidence(edge));
      if (!known) {
        found.set(service, row);
        next.push(service);
      }
    }
  }
  return next;
}

function impact(ix: GraphIndex, args: Record<string, string>): Answer {
  const start = nodeArg(ix, args, 'node');
  const maxDepth = Math.max(1, Math.min(6, Number(args.depth ?? 2) || 2));
  const found = new Map<string, Row>();
  let frontier = [start.id];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) frontier = expand(ix, start.id, frontier, depth, found);
  const rows = [...found.values()].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || a.label.localeCompare(b.label));
  const steps = maxDepth === 1 ? 'step' : 'steps';
  return { question: 'impact', title: `What breaks if ${start.name} changes`, summary: `${rows.length} services within ${maxDepth} ${steps}.`, rows };
}

/** Service-level dependency hops: synchronous calls first, then event flows. */
function hops(ix: GraphIndex, serviceId: string): Map<string, { label: string; edges: GraphEdge[] }> {
  const result = new Map<string, { label: string; edges: GraphEdge[] }>();
  const from = name(ix, serviceId);
  for (const edge of ix.outgoing(serviceId).filter((e) => e.rel === 'calls')) {
    const target = ix.callTarget(edge);
    if (target === serviceId) continue;
    const hop = result.get(target) ?? { label: `${from} calls ${name(ix, target)}`, edges: [] };
    hop.edges.push(edge);
    result.set(target, hop);
  }
  for (const pub of ix.outgoing(serviceId).filter((e) => e.rel === 'publishes')) {
    for (const [target, sub] of topicSubscribers(ix, pub.to)) {
      if (target === serviceId || result.has(target)) continue;
      result.set(target, { label: `${from} publishes ${name(ix, pub.to)} to ${name(ix, target)}`, edges: [pub, sub] });
    }
  }
  return new Map([...result].sort(([a], [b]) => a.localeCompare(b)));
}

function path(ix: GraphIndex, args: Record<string, string>): Answer {
  const from = nodeArg(ix, args, 'from');
  const to = nodeArg(ix, args, 'to');
  const previous = new Map<string, { from: string; label: string; edges: GraphEdge[] }>();
  const queue = [from.id];
  const seen = new Set(queue);
  while (queue.length > 0 && !seen.has(to.id)) {
    const current = queue.shift() as string;
    for (const [target, hop] of hops(ix, current)) {
      if (seen.has(target)) continue;
      seen.add(target);
      previous.set(target, { from: current, ...hop });
      queue.push(target);
    }
  }
  const rows: Row[] = [];
  for (let at = to.id; previous.has(at); at = (previous.get(at) as { from: string }).from) {
    const hop = previous.get(at) as { from: string; label: string; edges: GraphEdge[] };
    rows.unshift({ label: hop.label, nodeIds: [hop.from, at], evidence: hop.edges.map((e) => ix.evidence(e)) });
  }
  const summary = rows.length > 0 ? `${rows.length} hops.` : `No path from ${from.name} to ${to.name} through calls or events.`;
  return { question: 'path', title: `How ${from.name} reaches ${to.name}`, summary, rows };
}

function findingsOf(ruleId: string, question: string, title: string) {
  return (ix: GraphIndex): Answer => {
    const rows = ix.findings.findings.filter((f) => f.rule === ruleId).map((f) => ({
      label: `${f.label}: ${f.message}`,
      nodeIds: f.nodes,
      evidence: f.evidence,
      detail: f.id,
    }));
    return { question, title, summary: `${rows.length} findings.`, rows };
  };
}

function rule(ix: GraphIndex, args: Record<string, string>): Answer {
  const id = (args.rule ?? '').toUpperCase();
  const meta = ix.findings.rules.find((r) => r.id === id);
  if (!meta) throw new Error(`No rule "${args.rule}". Rules are ${ix.findings.rules.map((r) => r.id).join(', ')}.`);
  return findingsOf(id, 'rule', `${meta.id} ${meta.title}`)(ix);
}

export const QUESTIONS: readonly Question[] = [
  { id: 'impact', title: 'What breaks if this changes?', description: 'Services that depend on a node, step by step.',
    params: [{ name: 'node', label: 'Node', kind: 'node' }, { name: 'depth', label: 'Steps', kind: 'depth', optional: true }], run: impact },
  { id: 'connects', title: 'What connects to this?', description: 'Every proven relation of a node, in both directions.',
    params: [{ name: 'node', label: 'Node', kind: 'node' }], run: connects },
  { id: 'callers', title: 'Who calls this endpoint?', description: 'Callers of an endpoint, or of every endpoint of a service.',
    params: [{ name: 'node', label: 'Endpoint or service', kind: 'node', types: ['endpoint', 'service'] }], run: callers },
  { id: 'publishers', title: 'Who publishes to this topic?', description: 'Services that send events to a topic.',
    params: [{ name: 'node', label: 'Topic', kind: 'node', types: ['topic'] }], run: byRelation('publishes', 'publishers', 'publishes to') },
  { id: 'subscribers', title: 'Who subscribes to this topic?', description: 'Services and subscriptions that consume a topic.',
    params: [{ name: 'node', label: 'Topic', kind: 'node', types: ['topic'] }], run: byRelation('subscribes', 'subscribers', 'subscribes to') },
  { id: 'table-users', title: 'Who reads or writes this table?', description: 'Services that use a table, and how.',
    params: [{ name: 'node', label: 'Table', kind: 'node', types: ['table'] }], run: tableUsers },
  { id: 'path', title: 'How does A reach B?', description: 'Shortest chain of calls and events between two services.',
    params: [{ name: 'from', label: 'From service', kind: 'node', types: SERVICES }, { name: 'to', label: 'To service', kind: 'node', types: SERVICES }], run: path },
  { id: 'pinned', title: 'Which services cannot scale?', description: 'No autoscaler, or one pinned at min = max.',
    params: [], run: findingsOf('R6', 'pinned', 'Services pinned at a fixed size') },
  { id: 'drift', title: 'Where do the docs disagree with the code?', description: 'Declared dependencies with no proof, and proven calls nobody declared.',
    params: [], run: findingsOf('R5', 'drift', 'Declared vs actual dependencies') },
  { id: 'rule', title: 'Show the findings of a rule', description: 'Findings of one architecture rule, R1 to R8.',
    params: [{ name: 'rule', label: 'Rule', kind: 'rule' }], run: rule },
];

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function runQuestion(ix: GraphIndex, id: string, args: Record<string, string> = {}): Answer {
  const question = questionById(id);
  if (!question) throw new Error(`Unknown question "${id}".`);
  return question.run(ix, args);
}
