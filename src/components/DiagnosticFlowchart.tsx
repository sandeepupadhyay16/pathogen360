'use client';

import { useState } from 'react';

interface Step {
  stepId: string;
  label: string;
  status: 'success' | 'warning' | 'error' | 'info';
  value: string;
  durationMs?: number;
  details?: string;
  metadata?: Record<string, any>;
}

interface DiagnosticFlowchartProps {
  medicalTermResolution?: any;
  routeSelection?: any;
  contextAssembly?: any;
  cacheCheck?: any;
  tokenUsage?: any;
  routingPath?: Array<{
    stepId: string;
    label: string;
    status: string;
    value: string;
    details?: string;
    metadata?: Record<string, any>;
    durationMs?: number;
  }>;
  className?: string;
}

const getStatusColor = (status: string) => {
  if (status === 'success') return 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100';
  if (status === 'warning') return 'border-amber-500 bg-amber-50 hover:bg-amber-100';
  if (status === 'error') return 'border-red-500 bg-red-50 hover:bg-red-100';
  return 'border-blue-500 bg-blue-50 hover:bg-blue-100';
};

export default function DiagnosticFlowchart({
  medicalTermResolution,
  routeSelection,
  contextAssembly,
  cacheCheck,
  tokenUsage,
  routingPath,
  className = ''
}: DiagnosticFlowchartProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!routingPath || routingPath.length === 0) return null;

  return (
    <div className={`bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-white">Diagnostic Flow</h3>
            <p className="text-xs text-blue-100">{routingPath.length} Steps</p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-white hover:text-blue-100 transition flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
        >
          {showDetails ? 'Hide Details' : 'View Details'}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {routingPath.map((step, index) => (
          <div
            key={index}
            className={`p-3 rounded-xl border-l-4 ${getStatusColor(step.status)} transition-all duration-200 hover:scale-[1.01]`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg font-bold text-gray-400">0{index + 1}.</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{step.label}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium bg-slate-200`}>
                    {step.value}
                  </span>
                  <div className="flex gap-1 items-center">
                    {step.status === 'success' && (
                      <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {step.status === 'warning' && (
                      <svg className="h-3 w-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {step.status === 'error' && (
                      <svg className="h-3 w-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {!['success', 'warning', 'error'].includes(step.status) && (
                      <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {step.durationMs !== undefined && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-1 font-mono">
                        {step.durationMs}ms
                      </span>
                    )}
                  </div>
                </div>
                {step.details && (
                  <p className={`text-xs ${showDetails ? 'text-gray-600' : 'text-gray-400'}`}>
                    {step.details}
                  </p>
                )}
                {showDetails && step.metadata && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    {Object.entries(step.metadata).map(([key, value]) => {
                      if (key === 'originalQuery' || key === 'value' || key === 'status') return null;
                      return (
                        <div key={key} className="flex justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">{key}:</span>
                          <span className="text-xs text-gray-700">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {!showDetails && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setShowDetails(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition"
            >
              Show full diagnostic details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

