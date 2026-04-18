import { query } from '../db/pool.js';

export interface EventRow {
  id: string;
  action: string;
  userId: string | null;
  userEmail: string;
  details: string | null;
  timestamp: string;
}

interface DbEventRow {
  id: string;
  action: string;
  user_id: string | null;
  user_email: string;
  details: string | null;
  timestamp: Date;
}

function map(row: DbEventRow): EventRow {
  return {
    id: row.id,
    action: row.action,
    userId: row.user_id,
    userEmail: row.user_email,
    details: row.details,
    timestamp: row.timestamp.toISOString(),
  };
}

export async function appendEvent(input: {
  action: string;
  userId: string | null;
  userEmail: string;
  details?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO events (action, user_id, user_email, details) VALUES ($1, $2, $3, $4)`,
    [input.action, input.userId, input.userEmail, input.details ?? null],
  );
}

export async function listEvents(limit = 500): Promise<EventRow[]> {
  const { rows } = await query<DbEventRow>(
    `SELECT * FROM events ORDER BY timestamp DESC LIMIT $1`,
    [limit],
  );
  return rows.map(map);
}
