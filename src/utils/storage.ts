import { Camera } from '../types';
import Papa from 'papaparse';

const COLUMNS: (keyof Camera)[] = [
  'id',
  'type',
  'name',
  'address',
  'policeReferenceNumber',
  'publicOutputUrl',
  'latitude',
  'longitude',
  'direction',
  'fieldOfView',
  'viewDistance',
  'addedBy',
  'lastEditedBy',
  'createdAt',
  'updatedAt',
  'lastVerifiedAt',
];

function dateStamp(): string {
  return new Date().toISOString().split('T')[0];
}

function download(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const exportToCSV = (cameras: Camera[]) => {
  const csv = Papa.unparse({ fields: COLUMNS as string[], data: cameras });
  download(csv, `cameras_export_${dateStamp()}.csv`);
};

export const exportAreaToCSV = (
  cameras: Camera[],
  area: { lat: number; lng: number; radiusM: number },
) => {
  const csv = Papa.unparse({ fields: COLUMNS as string[], data: cameras });
  const fname = `cameras_area_${area.lat.toFixed(4)}_${area.lng.toFixed(4)}_${Math.round(area.radiusM)}m_${dateStamp()}.csv`;
  download(csv, fname);
};
