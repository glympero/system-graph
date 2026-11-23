import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GraphIndex } from './graph.ts';
import { buildView } from './lenses.ts';
import { decodeState, encodeState } from './links.ts';
import type { FindingsData, GraphData } from './types.ts';

const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../../out/${name}`, import.meta.url), 'utf8')) as T;
const index = new GraphIndex(read<GraphData>('graph.json'), read<FindingsData>('findings.json'));

describe('lenses', () => {
  it('services lens folds endpoints into services and tables into schemas', () => {
    const view = buildView(index, 'services');
    const types = new Set(view.nodes.map((n) => n.type));
    expect(types).toEqual(new Set(['service', 'topic', 'schema']));
    const call = view.edges.find((e) => e.id === 'service:payments-service|calls|service:orders-service');
    expect(call?.edges.map((e) => e.to)).toEqual(['endpoint:orders-service:GET /orders/{id}']);
    expect(view.edges.some((e) => e.id === 'service:payments-service|writes_table|schema:orders')).toBe(true);
  });

  it('data lens shows only services and tables', () => {
    const view = buildView(index, 'data');
    expect(new Set(view.nodes.map((n) => n.type))).toEqual(new Set(['service', 'table']));
  });

  it('impact lens keeps the focus and what depends on it', () => {
    const view = buildView(index, 'impact', 'table:inventory.stock', 1);
    expect(view.nodes.map((n) => n.id)).toEqual(['service:inventory-service', 'table:inventory.stock']);
  });
});

describe('links', () => {
  it('round-trips the view state through the hash', () => {
    const state = { lens: 'impact' as const, focus: 'table:orders.orders', depth: 2, q: 'impact', args: { node: 'table:orders.orders', depth: '2' } };
    expect(decodeState(encodeState(state))).toMatchObject(state);
  });

  it('keeps display options and filters in the link', () => {
    const state = { lens: 'services' as const, hideLabels: true, plainColours: true, spread: 1.5, hidden: ['topic' as const, 'schema' as const] };
    expect(decodeState(encodeState(state))).toMatchObject(state);
    expect(encodeState({ lens: 'services' })).toBe('#lens=services');
  });

  it('falls back to the services lens for an unknown lens', () => {
    expect(decodeState('#lens=bogus').lens).toBe('services');
  });
});
