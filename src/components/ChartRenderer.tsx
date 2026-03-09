'use client';

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface ChartRendererProps {
  visuals: any;
  pathogenName?: string;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

export const ChartRenderer: React.FC<ChartRendererProps> = ({ visuals, pathogenName }) => {
  if (!visuals) return null;

  return (
    <div className="space-y-8 mt-6">
      {/* 1. EPIDEMIOLOGY METRICS (New Dynamic Section) */}
      {visuals.epiVisuals && (
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              {visuals.epiVisuals.title || `Epidemiology: ${pathogenName || 'Pathogen'}`}
            </h4>
            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded uppercase">Historical Metrics</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visuals.epiVisuals.epidemiologyMetrics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={11} tick={{fill: '#64748B'}} />
                <YAxis fontSize={11} tick={{fill: '#64748B'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-4 italic">
            Data sourced from WHO Global Health Observatory (GHO). Values represent {visuals.epiVisuals.epidemiologyMetrics?.[0]?.indicator || 'tracked metrics'}.
          </p>
        </div>
      )}

      {/* 2. AGGREGATE TRIAL ACTIVITY */}
      {visuals.aggregateTrialActivity && (
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              {visuals.aggregateTrialTitle || "Clinical Trial Distribution"}
            </h4>
            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded uppercase">Pipeline Analysis</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visuals.aggregateTrialActivity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={80} tick={{fill: '#64748B'}} />
                <YAxis fontSize={11} tick={{fill: '#64748B'}} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                <Bar name="Total Trials" dataKey="total" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar name="Active/Recruiting" dataKey="active" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. AGGREGATE EPIDEMIOLOGY (COMPARISON) */}
      {visuals.aggregateEpiActivity && (
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Comparative Prevalence Data</h4>
            <span className="px-2 py-1 bg-teal-50 text-teal-600 text-xs font-semibold rounded uppercase">Market Impact</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visuals.aggregateEpiActivity}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={11} tick={{fill: '#64748B'}} />
                <YAxis fontSize={11} tick={{fill: '#64748B'}} />
                <Tooltip />
                <Bar dataKey="value" fill="#14B8A6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. TRIAL PHASES (PIE) */}
      {visuals.trialPhases && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-6">Phase Distribution</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visuals.trialPhases}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {visuals.trialPhases.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. VACCINE FOCUS */}
          {visuals.vaccineStats && (
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-6">Vaccine vs Therapeutic</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={visuals.vaccineStats}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#10B981" />
                      <Cell fill="#6366F1" />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. KEY METRICS CARDS */}
      {visuals.trialStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-600 font-bold uppercase">Total Trials</p>
            <p className="text-2xl font-black text-blue-900">{visuals.trialStats.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <p className="text-xs text-green-600 font-bold uppercase">Active Programs</p>
            <p className="text-2xl font-black text-green-900">{visuals.trialStats.active}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <p className="text-xs text-purple-600 font-bold uppercase">Vaccine Trials</p>
            <p className="text-2xl font-black text-purple-900">{visuals.trialStats.vaccines}</p>
          </div>
        </div>
      )}

      {visuals.summaryText && (
        <div className="pt-6 border-t border-gray-100">
            <p className="text-xs leading-relaxed text-gray-500 italic">
                <span className="font-bold text-gray-700 not-italic uppercase tracking-tighter text-[10px] mr-2">Analysis:</span>
                {visuals.summaryText}
            </p>
        </div>
      )}
    </div>
  );
};

export default ChartRenderer;
