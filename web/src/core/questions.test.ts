// Golden test per question over the bookshop demo graph. Expected values come from reading the demo estate's code.
// Needs `npm run graph` first (CI runs it before the tests).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GraphIndex } from './graph.ts';
import { QUESTIONS, runQuestion, type Answer } from './questions.ts';
import type { FindingsData, GraphData } from './types.ts';

const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../../out/${name}`, import.meta.url), 'utf8')) as T;
const index = new GraphIndex(read<GraphData>('graph.json'), read<FindingsData>('findings.json'));

const ask = (id: string, args: Record<string, string> = {}): Answer => runQuestion(index, id, args);
const subjects = (answer: Answer): string[] => answer.rows.map((r) => r.nodeIds[0]).sort();

describe('questions over the bookshop estate', () => {
  it('impact: changing the orders table reaches six services within two steps', () => {
    const answer = ask('impact', { node: 'orders.orders', depth: '2' });
    expect(subjects(answer)).toEqual([
      'service:admin-portal',
      'service:inventory-service',
      'service:notifier',
      'service:orders-service',
      'service:payments-service',
      'service:storefront-web',
    ]);
    const depthOf = Object.fromEntries(answer.rows.map((r) => [r.nodeIds[0], r.depth]));
    expect(depthOf['service:payments-service']).toBe(1);
    expect(depthOf['service:notifier']).toBe(2);
  });

  it('callers of an endpoint', () => {
    expect(subjects(ask('callers', { node: 'endpoint:orders-service:GET /orders/{id}' }))).toEqual([
      'service:payments-service',
      'service:storefront-web',
    ]);
  });

  it('publishers and subscribers of a topic', () => {
    expect(subjects(ask('publishers', { node: 'orders.placed' }))).toEqual(['service:orders-service']);
    expect(subjects(ask('subscribers', { node: 'orders.placed' }))).toEqual([
      'service:inventory-service',
      'service:payments-service',
      'subscription:inventory-orders-placed',
    ]);
  });

  it('table users say whether they read or write', () => {
    const rows = ask('table-users', { node: 'orders.orders' }).rows.map((r) => r.label);
    expect(rows).toEqual(['orders-service reads', 'orders-service writes', 'payments-service writes']);
  });

  it('connects lists every relation of a service in both directions', () => {
    const labels = ask('connects', { node: 'search-service' }).rows.map((r) => r.label);
    expect(labels).toEqual([
      'called by storefront-web GET /search',
      'calls catalog-api GET /books',
      'subscribes catalog.book-updated',
    ]);
  });

  it('path follows calls and events', () => {
    const answer = ask('path', { from: 'storefront-web', to: 'notifier' });
    expect(answer.rows.map((r) => r.label)).toEqual([
      'storefront-web calls orders-service',
      'orders-service calls payments-service',
      'payments-service publishes payments.completed to notifier',
    ]);
  });

  it('pinned, drift and rule questions read the findings', () => {
    expect(subjects(ask('pinned'))).toEqual(['service:notifier', 'service:payments-service']);
    expect(ask('drift').rows).toHaveLength(2);
    expect(subjects(ask('rule', { rule: 'R3' }))).toEqual(['table:orders.orders']);
  });

  it('every question has a title and every answer row carries evidence', () => {
    for (const q of QUESTIONS) expect(q.title).toBeTruthy();
    const answer = ask('impact', { node: 'orders.orders', depth: '2' });
    for (const row of answer.rows) expect(row.evidence.length).toBeGreaterThan(0);
  });

  it('unknown nodes give a clear error instead of an empty answer', () => {
    expect(() => ask('callers', { node: 'nope' })).toThrow(/No node matches "nope"/);
  });
});
