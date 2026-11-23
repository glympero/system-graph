// The data contract written by the Python pipeline. The UI and the MCP server read only these two files.

export type NodeType =
  | 'repo'
  | 'service'
  | 'endpoint'
  | 'topic'
  | 'subscription'
  | 'table'
  | 'schema'
  | 'function'
  | 'library';

export type Relation =
  | 'calls'
  | 'publishes'
  | 'subscribes'
  | 'reads_table'
  | 'writes_table'
  | 'exposes'
  | 'routes_to'
  | 'uses_library'
  | 'declared_dependency';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  repo?: string;
  file?: string;
  line?: number;
  props?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  rel: Relation;
  source: 'code' | 'iac' | 'declared';
  file: string;
  line: number;
  confidence: number;
  extractor: string;
  props?: Record<string, unknown>;
}

export interface GraphData {
  version: number;
  name: string;
  built: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Evidence {
  file: string;
  line: number;
  note?: string;
}

export type Label = 'Bad' | 'Gap' | 'Good';

export interface Finding {
  id: string;
  rule: string;
  title: string;
  label: Label;
  subject: string;
  nodes: string[];
  message: string;
  evidence: Evidence[];
}

export interface FindingsData {
  version: number;
  rules: { id: string; title: string }[];
  findings: Finding[];
}
