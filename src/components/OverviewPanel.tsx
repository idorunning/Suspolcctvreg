import React, { useMemo } from 'react';
import { Camera } from '../types';
import { X, Camera as CameraIcon, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface OverviewPanelProps {
  cameras: Camera[];
  usersCount: number;
  onClose: () => void;
}

const COLORS: Record<string, string> = {
  cctv: '#2563eb',
  police_council: '#7e22ce',
  pfs: '#ea580c',
  other: '#4b5563',
};

const LABELS: Record<string, string> = {
  cctv: 'Retail CCTV',
  police_council: 'Police/Council',
  pfs: 'Petrol Station',
  other: 'Other',
};

export default function OverviewPanel({ cameras, usersCount, onClose }: OverviewPanelProps) {
  const containerRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {
      cctv: 0,
      police_council: 0,
      pfs: 0,
      other: 0,
    };

    cameras.forEach((cam) => {
      if (counts[cam.type] !== undefined) {
        counts[cam.type]++;
      } else {
        counts.other++;
      }
    });

    return Object.entries(counts)
      .map(([type, count]) => ({
        name: LABELS[type],
        type,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [cameras]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="overview-title"
    >
      <div
        ref={containerRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 id="overview-title" className="text-2xl font-bold text-gray-800">
            System Overview
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors"
            aria-label="Close overview"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="bg-blue-100 p-4 rounded-full text-blue-600">
                <CameraIcon size={32} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Cameras</p>
                <p className="text-3xl font-bold text-gray-900">{cameras.length}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="bg-green-100 p-4 rounded-full text-green-600">
                <Users size={32} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{usersCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Cameras by Type</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.map((entry) => (
                      <Cell key={`cell-${entry.type}`} fill={COLORS[entry.type] || COLORS.other} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
