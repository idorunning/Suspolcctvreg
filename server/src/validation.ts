import { z } from 'zod';

// Ported from firestore.rules so client and server share the same invariants.

export const cameraTypeEnum = z.enum(['cctv', 'police_council', 'pfs', 'other']);

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim())
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const numberInRange = (min: number, max: number) =>
  z.number().finite().min(min).max(max);

export const cameraCreateSchema = z.object({
  type: cameraTypeEnum,
  name: optionalString(200),
  address: optionalString(500),
  ownerName: optionalString(200),
  policeReferenceNumber: optionalString(100),
  latitude: numberInRange(-90, 90),
  longitude: numberInRange(-180, 180),
  direction: numberInRange(0, 359.999999).nullable().optional(),
  fieldOfView: numberInRange(0.0001, 360).nullable().optional(),
  viewDistance: numberInRange(0.0001, 10000).nullable().optional(),
});

export const cameraUpdateSchema = cameraCreateSchema.partial();

export const loginSchema = z.object({
  email: z.string().email().max(256),
  password: z.string().min(1).max(256),
});

export const userPatchSchema = z.object({
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  status: z.enum(['pending', 'approved']).optional(),
});

export type CameraCreateInput = z.infer<typeof cameraCreateSchema>;
export type CameraUpdateInput = z.infer<typeof cameraUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserPatchInput = z.infer<typeof userPatchSchema>;
