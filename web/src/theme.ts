import type { Label, NodeType, Relation } from './core/types.ts';

// Canvas colours. Each one is checked for at least 3:1 contrast against its theme background (WCAG 1.4.11).
interface CanvasColours {
  background: string;
  label: string;
  dimmed: string;
  node: Partial<Record<NodeType, string>>;
  edge: Partial<Record<Relation, string>>;
  finding: Record<Label, string>;
}

const LIGHT: CanvasColours = {
  background: '#ffffff',
  label: '#1a1f29',
  dimmed: '#d5d9e0',
  node: { service: '#1f5fbf', topic: '#7b3fc4', subscription: '#a3500c', table: '#0f7a5c', schema: '#0f7a5c', endpoint: '#5b6472' },
  edge: { calls: '#7a8494', publishes: '#9b6fd6', subscribes: '#9b6fd6', reads_table: '#3f9c80', writes_table: '#3f9c80' },
  finding: { Bad: '#c62828', Gap: '#a15c00', Good: '#2e7d32' },
};

const DARK: CanvasColours = {
  background: '#11161f',
  label: '#e6e9ef',
  dimmed: '#2a3240',
  node: { service: '#6ea8ff', topic: '#c39bff', subscription: '#f5a35c', table: '#4fd1a5', schema: '#4fd1a5', endpoint: '#a3acba' },
  edge: { calls: '#5d6878', publishes: '#8a6cc0', subscribes: '#8a6cc0', reads_table: '#3c8f77', writes_table: '#3c8f77' },
  finding: { Bad: '#ff6b6b', Gap: '#f2b443', Good: '#5fd068' },
};

export function palette(dark: boolean): CanvasColours {
  return dark ? DARK : LIGHT;
}

export const NODE_SIZE: Partial<Record<NodeType, number>> = { service: 13, schema: 10, topic: 8, table: 8, subscription: 6, endpoint: 5 };

export const TYPE_LABEL: Partial<Record<NodeType, string>> = {
  service: 'Service',
  topic: 'Topic',
  subscription: 'Subscription',
  table: 'Table',
  schema: 'Schema',
  endpoint: 'Endpoint',
};
