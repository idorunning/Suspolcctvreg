import React, { useMemo } from 'react';
import { Camera } from '../types';
import { X, Camera as CameraIcon, Shield, Users, EyeOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OverviewPanelProps {
  cameras: Camera[];
  usersCount: number;
  onClose: () => void;
}

const COLORS: Record<string, string> = {
  cctv: '#3b82f6',
  police_council: '#8b5cf6',
  pfs: '#f97316',
  other: '#64748b'
};

const LABELS: Record<string, string> = {
  cctv: 'Retail CCTV',
  police_council: 'Police/Council',
  pfs: 'Petrol Station',
  other: 'Other'
};

export default function OverviewPanel({ cameras, usersCount, onClose }: OverviewPanelProps) {
  const stats = useMemo(() => {
    const counts: Record<string, number> = {
      cctv: 0,
      police_council: 0,
      pfs: 0,
      other: 0
    };

    cameras.forEach(cam => {
      if (counts[cam.type] !== undefined) {
        counts[cam.type]++;
      } else {
        counts.other++;
      }
    });

    return Object.entries(counts).map(([type, count]) => ({
      name: LABELS[type],
      type,
      count
    })).sort((a, b) => b.count - a.count);
  }, [cameras]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 select-none animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-950 font-display">System Analytics</h2>
            <p className="text-xs text-slate-500 font-medium">Sussex camera registry compliance and telemetry snapshot</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
              <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl border border-blue-100">
                <CameraIcon size={24} className="stroke-[2]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Nodes</p>
                <p className="text-2xl font-bold text-slate-950 font-mono mt-0.5">{cameras.length}</p>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
              <div className="bg-purple-50 text-purple-600 p-3.5 rounded-xl border border-purple-100">
                <Users size={24} className="stroke-[2]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Officers</p>
                <p className="text-2xl font-bold text-slate-950 font-mono mt-0.5">{usersCount}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4">
              <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-xl border border-emerald-100">
                <EyeOff size={24} className="stroke-[2]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Privacy Standard</p>
                <p className="text-2xl font-bold text-emerald-600 font-mono mt-0.5">100%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 font-display">Camera Registry Distribution</h3>
            <div className="h-72 w-full font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip 
                    cursor={{fill: 'rgba(241,245,249,0.5)'}}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', fontFamily: 'sans-serif', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                    {stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.type] || COLORS.other} />
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

