// Smoke test: start the real MCP server over stdio and ask it the README question.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const client = new Client({ name: 'test', version: '0.0.0' });

beforeAll(async () => {
  const server = fileURLToPath(new URL('./server.ts', import.meta.url));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
});

afterAll(() => client.close());

describe('mcp server', () => {
  it('lists one tool per question plus search and findings', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['impact', 'table_users', 'path', 'find_nodes', 'findings']));
  });

  it('answers impact with evidence and a deep link', async () => {
    const result = await client.callTool({ name: 'impact', arguments: { node: 'orders.orders', depth: 1 } });
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toContain('payments-service');
    expect(text).toContain('payments-service/src/main/java/com/inkwell/payments/OrderStatusWriter.java:18');
    expect(text).toContain('#lens=impact&focus=table%3Aorders.orders');
  });

  it('reports an unknown node as a tool error', async () => {
    const result = await client.callTool({ name: 'callers', arguments: { node: 'nope' } });
    expect(result.isError).toBe(true);
  });
});
