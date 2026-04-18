import { query } from '../db/pool.js';
import type { CameraCreateInput, CameraUpdateInput } from '../validation.js';

export interface CameraRow {
  id: string;
  type: 'cctv' | 'police_council' | 'pfs' | 'other';
  name: string | null;
  address: string | null;
  ownerName: string | null;
  policeReferenceNumber: string | null;
  latitude: number;
  longitude: number;
  direction: number | null;
  fieldOfView: number | null;
  viewDistance: number | null;
  addedBy: string;
  creatorEmail: string;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbCameraRow {
  id: string;
  type: CameraRow['type'];
  name: string | null;
  address: string | null;
  owner_name: string | null;
  police_reference_number: string | null;
  latitude: number;
  longitude: number;
  direction: number | null;
  field_of_view: number | null;
  view_distance: number | null;
  added_by: string;
  creator_email: string;
  last_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapCamera(row: DbCameraRow): CameraRow {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    address: row.address,
    ownerName: row.owner_name,
    policeReferenceNumber: row.police_reference_number,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    direction: row.direction === null ? null : Number(row.direction),
    fieldOfView: row.field_of_view === null ? null : Number(row.field_of_view),
    viewDistance: row.view_distance === null ? null : Number(row.view_distance),
    addedBy: row.added_by,
    creatorEmail: row.creator_email,
    lastVerifiedAt: row.last_verified_at ? row.last_verified_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listCameras(): Promise<CameraRow[]> {
  const { rows } = await query<DbCameraRow>('SELECT * FROM cameras ORDER BY created_at DESC');
  return rows.map(mapCamera);
}

export async function findCameraById(id: string): Promise<CameraRow | null> {
  const { rows } = await query<DbCameraRow>('SELECT * FROM cameras WHERE id = $1', [id]);
  return rows[0] ? mapCamera(rows[0]) : null;
}

export async function insertCamera(
  input: CameraCreateInput,
  addedBy: string,
  creatorEmail: string,
): Promise<CameraRow> {
  const { rows } = await query<DbCameraRow>(
    `INSERT INTO cameras (
      type, name, address, owner_name, police_reference_number,
      latitude, longitude, direction, field_of_view, view_distance,
      added_by, creator_email
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *`,
    [
      input.type,
      input.name ?? null,
      input.address ?? null,
      input.ownerName ?? null,
      input.policeReferenceNumber ?? null,
      input.latitude,
      input.longitude,
      input.direction ?? null,
      input.fieldOfView ?? null,
      input.viewDistance ?? null,
      addedBy,
      creatorEmail,
    ],
  );
  return mapCamera(rows[0]);
}

const COLUMN_MAP: Record<keyof CameraUpdateInput, string> = {
  type: 'type',
  name: 'name',
  address: 'address',
  ownerName: 'owner_name',
  policeReferenceNumber: 'police_reference_number',
  latitude: 'latitude',
  longitude: 'longitude',
  direction: 'direction',
  fieldOfView: 'field_of_view',
  viewDistance: 'view_distance',
};

export async function updateCameraRow(
  id: string,
  patch: CameraUpdateInput,
): Promise<CameraRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(patch) as (keyof CameraUpdateInput)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${COLUMN_MAP[key]} = $${params.length}`);
  }
  if (sets.length === 0) return findCameraById(id);
  params.push(id);
  const { rows } = await query<DbCameraRow>(
    `UPDATE cameras SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  return rows[0] ? mapCamera(rows[0]) : null;
}

export async function verifyCameraRow(id: string): Promise<CameraRow | null> {
  const { rows } = await query<DbCameraRow>(
    `UPDATE cameras SET last_verified_at = NOW() WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ? mapCamera(rows[0]) : null;
}

export async function deleteCameraRow(id: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM cameras WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
