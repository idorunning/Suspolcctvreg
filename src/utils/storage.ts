import { Camera, UserRole, UserStatus } from '../types';
import Papa from 'papaparse';

const STORAGE_KEY = 'sussex_cameras_data';

export const loadCameras = (): Camera[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveCameras = (cameras: Camera[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras));
};

export const exportToCSV = (cameras: Camera[]) => {
  const csv = Papa.unparse(cameras);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `cameras_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const importFromCSV = (file: File): Promise<Camera[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const cameras: Camera[] = results.data.map((row: any) => ({
            id: row.id || crypto.randomUUID(),
            type: row.type || 'other',
            name: row.name || '',
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            direction: row.direction !== undefined && row.direction !== null && row.direction !== '' ? Number(row.direction) : undefined,
            fieldOfView: row.fieldOfView !== undefined && row.fieldOfView !== null && row.fieldOfView !== '' ? Number(row.fieldOfView) : undefined,
            viewDistance: row.viewDistance !== undefined && row.viewDistance !== null && row.viewDistance !== '' ? Number(row.viewDistance) : undefined,
            address: row.address || '',
            ownerName: row.ownerName || '',
            policeReferenceNumber: row.policeReferenceNumber || '',
            addedBy: row.addedBy || 'local_user',
            creatorEmail: row.creatorEmail || '',
            createdAt: row.createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || new Date().toISOString(),
            lastVerifiedAt: row.lastVerifiedAt || undefined,
          }));
          resolve(cameras);
        } catch (err) {
          reject(new Error('Invalid CSV format. Please ensure all required columns are present.'));
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};
