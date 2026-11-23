#!/usr/bin/env node
// MCP server over graph.json and findings.json. One tool per explorer question, answered by the same core code
// as the UI, each answer with evidence lines and a deep link into the explorer.
// Run: node web/mcp/server.ts   (Node 22.18+ runs TypeScript directly)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GraphIndex } from '../src/core/graph.ts';
import { deepLink, type ViewState } from '../src/core/links.ts';
import { QUESTIONS, type Answer, type Param, type Question } from '../src/core/questions.ts';
import type { FindingsData, GraphData } from '../src/core/types.ts';

const outDir = process.env.SYSGRAPH_OUT ? resolve(process.env.SYSGRAPH_OUT) : fileURLToPath(new URL('../../out/', import.meta.url));
const viewUrl = process.env.SYSGRAPH_VIEW_URL ?? 'http://localhost:5173/';

function load(): GraphIndex {
  const read = <T,>(name: string): T => JSON.parse(readFileSync(resolve(outDir, name), 'utf8')) as T;
  return new GraphIndex(read<GraphData>('graph.json'), read<FindingsData>('findings.json'));
}

const index = load();

function schemaFor(param: Param) {
  if (param.kind === 'depth') return z.number().int().min(1).max(6).optional().describe('How many steps to follow (default 2).');
  if (param.kind === 'rule') return z.string().describe('Rule id, R1 to R8.');
  const types = param.types ? ` (${param.types.join(' or ')})` : '';
  return z.string().describe(`${param.label}${types}: a node id like service:orders-service, or just a name like "orders".`);
}

function formatAnswer(ix: GraphIndex, answer: Answer, link: string): string {
  const lines = [`# ${answer.title}`, answer.summary, ''];
  for (const row of answer.rows) {
    lines.push(`- ${row.label}${row.detail ? ` (${row.detail})` : ''}`);
    for (const ev of row.evidence) {
      const url = ix.evidenceUrl(ev);
      lines.push(`  - ${ev.file}:${ev.line}${ev.note ? ` ${ev.note}` : ''}${url ? ` <${url}>` : ''}`);
    }
  }
  lines.push('', `Open in the explorer: ${link}`);
  return lines.join('\n');
}

function stateFor(question: Question, args: Record<string, string>): ViewState {
  const focus = args.node ? index.resolve(args.node)?.id : undefined;
  if (question.id === 'impact' && focus) {
    return { lens: 'impact', focus, depth: Number(args.depth ?? 2), q: question.id, args: { ...args, node: focus } };
  }
  return { lens: 'services', focus, q: question.id, args };
}

const server = new McpServer({ name: 'system-graph', version: '0.1.0' });

for (const question of QUESTIONS) {
  const shape = Object.fromEntries(question.params.map((p) => [p.name, schemaFor(p)]));
  server.registerTool(
    question.id.replace('-', '_'),
    { title: question.title, description: `${question.description} Every answer cites the file and line that proves it.`, inputSchema: shape },
    (input: Record<string, unknown>) => {
      const args = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
      try {
        const answer = question.run(index, args);
        return { content: [{ type: 'text' as const, text: formatAnswer(index, answer, deepLink(viewUrl, stateFor(question, args))) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
      }
    },
  );
}

server.registerTool(
  'find_nodes',
  {
    title: 'Find nodes',
    description: 'Search services, endpoints, topics, subscriptions, tables and schemas by name. Use it to get node ids for the other tools.',
    inputSchema: { query: z.string().describe('Part of a name, e.g. "orders".') },
  },
  ({ query }) => {
    const hits = index.search(query);
    const text = hits.length > 0 ? hits.map((n) => `- ${n.id} (${n.type})`).join('\n') : `No node matches "${query}".`;
    return { content: [{ type: 'text' as const, text }] };
  },
);

server.registerTool(
  'findings',
  { title: 'All findings', description: 'Every architecture rule finding (Bad, Gap, Good) with its evidence.', inputSchema: {} },
  () => {
    const text = index.findings.findings
      .map((f) => [`- [${f.label}] ${f.id}: ${f.message}`, ...f.evidence.map((ev) => `  - ${ev.file}:${ev.line} ${ev.note ?? ''}`.trimEnd())].join('\n'))
      .join('\n');
    return { content: [{ type: 'text' as const, text: `${text}\n\nOpen in the explorer: ${viewUrl}` }] };
  },
);

await server.connect(new StdioServerTransport());
