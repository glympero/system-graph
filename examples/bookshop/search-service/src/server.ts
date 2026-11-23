import express from 'express';
import { search, suggest } from './index';
import { startConsumer } from './consumer';

const app = express();

app.get('/search', async (req, res) => {
  const hits = await search(String(req.query.q ?? ''));
  res.json(hits);
});

app.get('/suggest', async (req, res) => {
  res.json(await suggest(String(req.query.prefix ?? '')));
});

app.get('/health', (_req, res) => res.json({ ok: true }));

startConsumer().then(() => app.listen(Number(process.env.PORT ?? 8080)));
