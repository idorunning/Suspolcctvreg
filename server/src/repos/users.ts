import { query } from '../db/pool.js';

export interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'user' | 'viewer';
  status: 'pending' | 'approved';
  createdAt: string;
}

interface DbUserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'user' | 'viewer';
  status: 'pending' | 'approved';
  created_at: Date;
}

function mapUser(row: DbUserRow): UserRow {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await query<DbUserRow>('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await query<DbUserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function listUsers(): Promise<UserRow[]> {
  const { rows } = await query<DbUserRow>('SELECT * FROM users ORDER BY created_at DESC');
  return rows.map(mapUser);
}

export async function countUsers(): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  return Number(rows[0]?.count ?? 0);
}

export async function createUser(input: {
  email: string;
  displayName: string | null;
  role: UserRow['role'];
  status: UserRow['status'];
}): Promise<UserRow> {
  const { rows } = await query<DbUserRow>(
    `INSERT INTO users (email, display_name, role, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.email, input.displayName, input.role, input.status],
  );
  return mapUser(rows[0]);
}

export async function updateUser(
  id: string,
  patch: { role?: UserRow['role']; status?: UserRow['status'] },
): Promise<UserRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.role) {
    params.push(patch.role);
    sets.push(`role = $${params.length}`);
  }
  if (patch.status) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  if (sets.length === 0) return findUserById(id);
  params.push(id);
  const { rows } = await query<DbUserRow>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
