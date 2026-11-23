import express from 'express';
import { startConsumers } from './consumers';

const app = express();

app.get('/health', (_req, res) => res.json({ ok: true }));

startConsumers().then(() => app.listen(Number(process.env.PORT ?? 8080)));
