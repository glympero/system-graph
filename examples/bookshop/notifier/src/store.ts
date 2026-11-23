import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function recordNotification(topic: string, event: unknown): Promise<void> {
  await pool.query('INSERT INTO notifications (topic, payload) VALUES ($1, $2)', [topic, JSON.stringify(event)]);
}
