"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Activity, Clock, CheckCircle2, AlertCircle, RefreshCw,
    ArrowLeft, List, Search, Calendar, ChevronRight, XCircle, Globe, FlaskConical, Trash2
} from 'lucide-react';

export default function OperationsHistoryPage() {
    const [operations, setOperations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOp, setSelectedOp] = useState<any>(null);
    const [filter, setFilter] = useState('ALL');
    const [stoppingId, setStoppingId] = useState<string | null>(null);
    const [restartingId, setRestartingId] = useState<string | null>(null);
    const [confirmRestartId, setConfirmRestartId] = useState<string | null>(null);

    const fetchOperations = async () => {
        try {
            const res = await fetch('/api/admin/operations');
            if (!res.ok) {
                console.error(`fetchOperations returned ${res.status}`);
                return;
            }
            const text = await res.text();
            if (!text) return;
            const data = JSON.parse(text);
            setOperations(data);
        } catch (err) {
            console.error('Failed to fetch operations', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetails = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/operations?id=${id}`);
            if (!res.ok) {
                console.error(`API returned ${res.status}: ${res.statusText}`);
                setSelectedOp(null);
                return;
            }
            const text = await res.text();
            if (!text) {
                setSelectedOp(null);
                return;
            }
            const data = JSON.parse(text);
            setSelectedOp(data);
        } catch (err) {
            console.error('Failed to fetch details', err);
        }
    };

    const handleAbort = async (id: string) => {
        if (!confirm('Are you sure you want to stop this operation? Some progress may be saved, but the task will halt immediately.')) return;
        setStoppingId(id);
        try {
            const res = await fetch('/api/admin/operations/abort', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error('Failed to send abort signal');

            // Give the backend a moment to update and force a fresh fetch
            setTimeout(async () => {
                await fetchOperations();
                if (selectedOp?.id === id) {
                    const detailRes = await fetch(`/api/admin/operations?id=${id}&t=${Date.now()}`, { cache: 'no-store' });
                    const detailData = await detailRes.json();
                    setSelectedOp(detailData);
                }
                setStoppingId(null);
            }, 800);
        } catch (err: any) {
            alert(`Error stopping task: ${err.message}`);
            console.error('Failed to abort operation', err);
            setStoppingId(null);
        }
    };

    const handleRestart = async (id: string) => {
        setRestartingId(id);
        try {
            const res = await fetch('/api/admin/operations/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to trigger restart');

            if (data.operationId) {
                await fetchOperations();
                fetchDetails(data.operationId);
            }
            setRestartingId(null);
        } catch (err: any) {
            alert(`Error restarting task: ${err.message}`);
            setRestartingId(null);
        }
    };

    const handleDeleteOperation = async (id: string, e?: React.MouseEvent) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        if (!confirm('Permanently delete this operation record and its logs?')) return;
        
        try {
            const res = await fetch(`/api/admin/operations?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete operation');
            
            if (selectedOp?.id === id) setSelectedOp(null);
            await fetchOperations();
        } catch (err: any) {
            alert(`Error deleting operation: ${err.message}`);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Clear all completed, failed, and cancelled operations from history? Active tasks will be preserved.')) return;
        
        try {
            const res = await fetch('/api/admin/operations?all=true', { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to clear history');
            
            const data = await res.json();
            alert(data.message || 'History cleared.');
            setSelectedOp(null);
            await fetchOperations();
        } catch (err: any) {
            alert(`Error clearing history: ${err.message}`);
        }
    };

    useEffect(() => {
        fetchOperations();
        const interval = setInterval(fetchOperations, 5000);
        return () => clearInterval(interval);
    }, []);

    const filteredOps = operations.filter(op => {
        if (filter === 'ALL') return true;
        if (filter === 'RUNNING') return op.status === 'RUNNING' || op.status === 'PENDING';
        if (filter === 'FAILED') return op.status === 'FAILED';
        if (filter === 'COMPLETED') return op.status === 'COMPLETED';
        return true;
    });

    const formatDuration = (ms?: number) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remSecs = seconds % 60;
        return `${minutes}m ${remSecs}s`;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                <header className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 hover:bg-slate-100 rounded-lg transition">
                            <ArrowLeft className="w-6 h-6 text-slate-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">System Operations History</h1>
                            <p className="text-slate-500 font-medium">Monitor background ingestion and synthesis tasks</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleClearAll}
                            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-bold transition"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>CLEAR HISTORY</span>
                        </button>
                        <div className="flex bg-slate-100 p-1 rounded-xl" role="group" aria-label="Filter operations by status">
                            {['ALL', 'RUNNING', 'COMPLETED', 'FAILED'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${filter === f ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <List className="w-4 h-4" /> Recent Runs
                                </h3>
                                <button 
                                    onClick={fetchOperations} 
                                    className="p-1.5 hover:bg-slate-200 rounded-lg transition"
                                    title="Refresh Operations"
                                >
                                    <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                                {loading && operations.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">Loading history...</div>
                                ) : filteredOps.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400">No operations found.</div>
                                ) : filteredOps.map(op => (
                                    <div
                                        key={op.id}
                                        onClick={() => fetchDetails(op.id)}
                                        className={`w-full text-left p-4 transition hover:bg-slate-50 relative group cursor-pointer ${selectedOp?.id === op.id ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                op.type === 'INGEST' ? 'bg-blue-100 text-blue-700' :
                                                op.type === 'SYNTHESIZE' ? 'bg-purple-100 text-purple-700' : 
                                                op.type === 'ONBOARD' ? 'bg-green-100 text-green-700' :
                                                op.type === 'SYNC_TRIALS' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-200 text-slate-700'
                                                }`}>
                                                {op.type}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={(e) => handleDeleteOperation(op.id, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-red-500 rounded transition"
                                                    title="Delete this record"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                                <span className={`text-[10px] font-bold ${op.status === 'COMPLETED' ? 'text-green-600' :
                                                    op.status === 'FAILED' ? 'text-red-600' :
                                                        op.status === 'CANCELLED' ? 'text-amber-600' :
                                                            'text-blue-600 animate-pulse'
                                                    }`}>
                                                    {op.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="font-bold text-slate-800 text-sm truncate pr-6">{op.target || 'Global'}</div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-2">
                                            <Clock className="w-3 h-3" />
                                            {new Date(op.startedAt).toLocaleString()}
                                            <span className="ml-auto font-mono">{formatDuration(op.durationMs)}</span>
                                        </div>
                                        {op.status === 'RUNNING' && (
                                            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-500 w-full"
                                                />
                                            </div>
                                        )}
                                        {selectedOp?.id === op.id && !restartingId && <div className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500"><ChevronRight className="w-5 h-5" /></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Details / Logs */}
                    <div className="lg:col-span-2 space-y-6">
                        {selectedOp ? (
                            <div className="space-y-6">
                                {/* Summary Card */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h2 className="text-xl font-bold text-slate-800">{selectedOp.type} Operation</h2>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                                    (selectedOp.status === 'COMPLETED' || (selectedOp.status === 'RUNNING' && selectedOp.progress === 100)) ? 'bg-green-100 text-green-700' :
                                                    selectedOp.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                                    selectedOp.status === 'CANCELLED' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-blue-100 text-blue-700 animate-pulse'
                                                    }`}>
                                                    {selectedOp.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-sm font-medium">ID: {selectedOp.id}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {(selectedOp.status === 'RUNNING' || selectedOp.status === 'PENDING') && (
                                                <button
                                                    onClick={() => handleAbort(selectedOp.id)}
                                                    disabled={stoppingId === selectedOp.id}
                                                    className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-bold transition mr-4 disabled:opacity-50"
                                                >
                                                    {stoppingId === selectedOp.id ? (
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4" />
                                                    )}
                                                    {stoppingId === selectedOp.id ? 'STOPPING...' : 'STOP TASK'}
                                                </button>
                                            )}

                                            {(selectedOp.status === 'FAILED' || selectedOp.status === 'CANCELLED') && selectedOp.metadata && (
                                                <div className="flex gap-2 mr-4">
                                                    {confirmRestartId === selectedOp.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleRestart(selectedOp.id)}
                                                                disabled={restartingId === selectedOp.id}
                                                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                                                            >
                                                                {restartingId === selectedOp.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                                CONFIRM RESTART
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmRestartId(null)}
                                                                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                                                            >
                                                                CANCEL
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmRestartId(selectedOp.id)}
                                                            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold transition"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                            RESTART TASK
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-400 uppercase">Duration</div>
                                                <div className="text-xl font-black text-slate-800">{formatDuration(selectedOp.durationMs || (Date.now() - new Date(selectedOp.startedAt).getTime()))}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Started</div>
                                            <div className="text-xs font-bold text-slate-700">{new Date(selectedOp.startedAt).toLocaleTimeString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Finished</div>
                                            <div className="text-xs font-bold text-slate-700">{selectedOp.completedAt ? new Date(selectedOp.completedAt).toLocaleTimeString() : 'In Progress'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Target</div>
                                            <div className="text-xs font-bold text-slate-700 truncate">{selectedOp.target || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Progress</div>
                                            <div className="text-xs font-bold text-slate-700">{selectedOp.progress}%</div>
                                        </div>
                                    </div>

                                    {selectedOp.error && (
                                        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                            <div>
                                                <div className="text-sm font-bold text-red-800">Operation Error</div>
                                                <div className="text-xs text-red-700 mt-1 font-mono break-all">{selectedOp.error}</div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedOp.metadata?.exactSearchParameters && (
                                        <div className="mt-6 p-5 bg-white border border-slate-200 shadow-sm rounded-xl space-y-4">
                                            <div className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                                                <Search className="w-4 h-4 text-blue-500" />
                                                Exact Search Parameters
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />PubMed API</h4>
                                                    <dl className="space-y-2 text-sm">
                                                        <div className="flex justify-between"><dt className="text-slate-500">Query:</dt><dd className="font-mono font-semibold text-slate-800 text-right break-all">{selectedOp.metadata.exactSearchParameters.pubmed.query}</dd></div>
                                                        <div className="flex justify-between"><dt className="text-slate-500">Limit:</dt><dd className="font-mono font-semibold text-slate-800">{selectedOp.metadata.exactSearchParameters.pubmed.limit}</dd></div>
                                                        <div className="flex justify-between"><dt className="text-slate-500">Timeframe:</dt><dd className="font-mono font-semibold text-slate-800">{selectedOp.metadata.exactSearchParameters.pubmed.startYear || 'All Time'} - {selectedOp.metadata.exactSearchParameters.pubmed.endYear || 'Present'}</dd></div>
                                                        <div className="flex justify-between"><dt className="text-slate-500">Detail Level:</dt><dd className="font-mono font-semibold text-slate-800">{selectedOp.metadata.exactSearchParameters.pubmed.fetchFullText ? 'Full Text' : 'Abstract'}</dd></div>
                                                    </dl>
                                                </div>
                                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" />ClinicalTrials.gov</h4>
                                                    <dl className="space-y-2 text-sm">
                                                        <div className="flex justify-between"><dt className="text-slate-500">Query:</dt><dd className="font-mono font-semibold text-slate-800 text-right break-all">{selectedOp.metadata.exactSearchParameters.clinicalTrials.query}</dd></div>
                                                        <div className="flex justify-between"><dt className="text-slate-500">Limit:</dt><dd className="font-mono font-semibold text-slate-800">{selectedOp.metadata.exactSearchParameters.clinicalTrials.limit}</dd></div>
                                                    </dl>
                                                </div>
                                            </div>

                                            {/* Search Clusters Visualization */}
                                            {(selectedOp.metadata.exactSearchParameters.pubmed.clusters || selectedOp.metadata.exactSearchParameters.clinicalTrials.clusters) && (
                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                        <List className="w-3 h-3" /> Multi-Cluster Search Strategy
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(selectedOp.metadata.exactSearchParameters.pubmed.clusters || []).map((cluster: string, idx: number) => (
                                                            <span key={idx} className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[10px] font-bold">
                                                                {cluster}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Strategy & Coverage Analysis (New Section) */}
                                            {((selectedOp.type === 'INGEST' || selectedOp.type === 'ONBOARD') && selectedOp.metadata) && (
                                                <div className="mt-6 pt-6 border-t border-slate-100">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                            <Activity className="w-4 h-4 text-purple-500" />
                                                            Strategy & Coverage Analysis
                                                        </h4>
                                                        <div className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold uppercase">
                                                            Ingestion Math
                                                        </div>
                                                    </div>
                                                    
                                                    {!selectedOp.metadata.ingestionStats ? (
                                                        <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                                                            <RefreshCw className="w-5 h-5 text-slate-300 animate-spin mb-2" />
                                                            <div className="text-xs font-bold text-slate-400">Collecting ingestion math...</div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Raw Matches Found</div>
                                                                <div className="text-lg font-black text-slate-800">{selectedOp.metadata.ingestionStats.totalRawFound}</div>
                                                                <div className="text-[9px] text-slate-500 font-medium">Sum of all cluster results</div>
                                                            </div>
                                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Deduplicated Items</div>
                                                                <div className="text-lg font-black text-slate-800">{selectedOp.metadata.ingestionStats.totalUniqueSaved}</div>
                                                                <div className="text-[9px] text-slate-500 font-medium">Final unique articles saved</div>
                                                            </div>
                                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Compression (Overlap)</div>
                                                                <div className="text-lg font-black text-slate-800">
                                                                    {selectedOp.metadata.ingestionStats.totalRawFound > 0 
                                                                        ? `${Math.round((selectedOp.metadata.ingestionStats.overlapCount / selectedOp.metadata.ingestionStats.totalRawFound) * 100)}%`
                                                                        : '0%'
                                                                    }
                                                                </div>
                                                                <div className="text-[9px] text-slate-500 font-medium">{selectedOp.metadata.ingestionStats.overlapCount} redundant results filtered</div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {selectedOp.metadata.ingestionStats && (
                                                        <div className="space-y-2">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cluster Breakdown</div>
                                                            <div className="border border-slate-100 rounded-lg overflow-hidden">
                                                                <table className="w-full text-[11px] text-left border-collapse">
                                                                    <thead className="bg-slate-50 border-b border-slate-100">
                                                                        <tr>
                                                                            <th className="p-2 font-bold text-slate-500">Search Cluster (Keywords)</th>
                                                                            <th className="p-2 font-bold text-slate-500 text-center">Depth</th>
                                                                            <th className="p-2 font-bold text-slate-500 text-right">Yield</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-50">
                                                                        {selectedOp.metadata.ingestionStats.clusterBreakdown?.map((c: any, i: number) => (
                                                                            <tr key={i} className="hover:bg-slate-50/50">
                                                                                <td className="p-2 font-medium text-slate-700">
                                                                                    {c.isPrimary && <span className="mr-1.5 px-1 bg-blue-100 text-blue-700 rounded-[3px] text-[8px] font-black uppercase">Primary</span>}
                                                                                    <span className="font-mono">{c.query}</span>
                                                                                </td>
                                                                                <td className="p-2 text-center text-slate-500 font-mono">top {c.limit}</td>
                                                                                <td className="p-2 text-right font-black text-slate-800">{c.found}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 font-medium italic mt-2">
                                                                * The system combines results from multiple specialized clusters to ensure high-fidelity coverage across the therapeutic landscape, removing any overlapping articles to maintain a clean database.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Logs Section */}
                                <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
                                    <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                                        <h3 className="text-slate-300 font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                                            <Activity className="w-4 h-4 text-blue-400" /> Execution Logs
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-500">{selectedOp.logs?.length || 0} entries</span>
                                    </div>
                                    <div className="p-4 font-mono text-xs space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {selectedOp.logs?.length === 0 ? (
                                            <div className="text-slate-600 italic">No logs generated for this operation.</div>
                                        ) : (
                                            selectedOp.logs.map((log: any) => (
                                                <div key={log.id} className="group border-b border-slate-800/50 pb-2 last:border-0 hover:bg-slate-800/30 transition px-2 -mx-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-500 tabular-nums">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                        <span className={`font-black tracking-tighter w-12 ${log.level === 'ERROR' ? 'text-red-500' :
                                                            log.level === 'WARN' ? 'text-amber-500' : 'text-blue-500'
                                                            }`}>[{log.level}]</span>
                                                        <span className={`flex-1 ${log.level === 'ERROR' ? 'text-red-400' : 'text-slate-300'}`}>{log.message}</span>
                                                        {log.durationMs && (
                                                            <span className="text-green-500/70 font-bold ml-auto">{formatDuration(log.durationMs)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                                    <Activity className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">Select an Operation</h3>
                                <p className="text-slate-500 max-w-xs mt-2">Choose an operation from the list on the left to view detailed logs and performance metrics.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #475569;
                }
            `}</style>
        </div>
    );
}
