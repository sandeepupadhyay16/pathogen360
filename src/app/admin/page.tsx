'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Database, RefreshCw, AlertCircle, CheckCircle2, Brain, Sparkles, Trash2, FlaskConical, Activity, Search, ChevronUp, ChevronDown, ChevronsUpDown, Filter, Eye, Tag, Globe, Bell, Clock, ChevronRight } from 'lucide-react';
import { getMedicalTermType } from '@/lib/taxonomy';

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [synthesizing, setSynthesizing] = useState(false);
    const [classifying, setClassifying] = useState(false);
    const [refreshingCT, setRefreshingCT] = useState(false);
    const [syncingHealth, setSyncingHealth] = useState(false);
    const [refreshTarget, setRefreshTarget] = useState('');
    const [ingestScope, setIngestScope] = useState<'term' | 'category' | 'all'>('term');
    const [timeframe, setTimeframe] = useState<'3y' | '5y' | '10y' | 'custom'>('3y');
    const [customYearStart, setCustomYearStart] = useState(2010);
    const [customYearEnd, setCustomYearEnd] = useState(new Date().getFullYear());
    const [pubmedDetail, setPubmedDetail] = useState<'abstract' | 'full'>('abstract');
    const [trialsDetail, setTrialsDetail] = useState<'basic' | 'detailed'>('detailed');
    const [scanDepth, setScanDepth] = useState(25);
    const [purging, setPurging] = useState(false);
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
    const [purgeConfirmText, setPurgeConfirmText] = useState('');
    const [progress, setProgress] = useState(0);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info', text: string, opId?: string } | null>(null);
    const [currentOpId, setCurrentOpId] = useState<string | null>(null);
    const [medicalTermToDelete, setMedicalTermToDelete] = useState<{ id: string, name: string } | null>(null);
    const [ctStats, setCtStats] = useState<{ totalTrials: number; activeTrials: number; lastRefreshed: string | null } | null>(null);

    // Table search / filter / sort state
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [sortCol, setSortCol] = useState<string>('totalArticles');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [cleaningStale, setCleaningStale] = useState(false);


    // Column sort toggle
    const handleSort = (col: string) => {
        if (sortCol === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('desc');
        }
    };

    // Derived: filtered + sorted rows (memoized)
    const filteredAndSorted = useMemo(() => {
        const getValue = (m: any, col: string): number => {
            if (col === 'totalArticles') return m.totalArticles ?? 0;
            if (col === 'clinicalTrialsCount') return m.clinicalTrialsCount ?? 0;
            return 0;
        };

        return metrics
            .filter(m => {
                if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
                if (filterCategory !== 'ALL' && m.category !== filterCategory) return false;
                return true;
            })
            .sort((a, b) => {
                const aVal = getValue(a, sortCol);
                const bVal = getValue(b, sortCol);
                return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
            });
    }, [metrics, search, filterCategory, sortCol, sortDir]);

    useEffect(() => {
        fetchMetrics();
        fetchCtStats();

        // Poll for updates every 8 seconds to reflect background task progress
        const interval = setInterval(() => {
            fetchMetrics();
            fetchCtStats();
        }, 8000);

        return () => clearInterval(interval);
    }, []);

    const fetchCtStats = async () => {
        try {
            const res = await fetch('/api/admin/refresh-clinical-trials');
            if (res.ok) setCtStats(await res.json());
        } catch { /* silent */ }
    };

    const fetchMetrics = async () => {
        try {
            const res = await fetch('/api/admin/metrics', { cache: 'no-store' });
            const data = await res.json();
            setMetrics(data.medicalTerms || []);
        } catch (err) {
            console.error('Failed to fetch metrics', err);
        } finally {
            setLoading(false);
        }
    };

    const [onboardPreset, setOnboardPreset] = useState<'quick' | 'deep' | 'custom'>('quick');

    const handleOnboard = async (term: string, preset: 'quick' | 'deep' | 'custom') => {
        if (!term) return;
        setRefreshing(true);
        setStatusMsg({ type: 'info', text: `Onboarding process started for ${term}...` });

        try {
            const res = await fetch('/api/admin/onboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    medicalTerm: term,
                    preset,
                    // Pass custom params if preset is custom
                    ...(preset === 'custom' ? {
                        timeframe,
                        pubmedDetails: pubmedDetail,
                        maxResults: scanDepth,
                        customYearStart,
                        customYearEnd
                    } : {})
                }),
            });
            const data = await res.json();
            if (data.operationId) setStatusMsg({ type: 'info', text: `Onboarding task started for ${term}.`, opId: data.operationId });
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Failed to start onboarding.' });
        } finally {
            setRefreshing(false);
        }
    };

    const handleResynthesizeAll = async () => {
        if (!confirm('This will trigger an incremental refresh and synthesis for ALL ingested terms. Continue?')) return;
        
        setSynthesizing(true);
        setStatusMsg({ type: 'info', text: 'Bulk resynthesis started...' });
        
        try {
            let started = 0;
            for (const m of metrics) {
                // We fire these sequentially or parallel? 
                // Parallel might hit rate limits, but the backend uses an operation queue if implemented.
                // For now, let's just trigger them.
                await fetch('/api/admin/onboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        medicalTerm: m.name,
                        preset: 'quick' // Default to quick refresh for bulk
                    }),
                });
                started++;
            }
            setStatusMsg({ type: 'success', text: `Successfully queued refresh/synthesis for ${started} terms.` });
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Bulk resynthesis failed to queue at some point.' });
        } finally {
            setSynthesizing(false);
            fetchMetrics();
        }
    };
    const handleAbort = async () => {
        const id = statusMsg?.opId;
        if (!id) return;
        if (!confirm('Abort currently running task?')) return;

        try {
            await fetch('/api/admin/operations/abort', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setStatusMsg({ type: 'info', text: 'Abort signal sent. Task will stop shortly.' });
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Failed to send abort signal.' });
        }
    };

    const handleRefreshClinicalTrials = async () => {
        setRefreshingCT(true);
        setStatusMsg({ type: 'info', text: 'Clinical trials refresh task started in background.' });
        try {
            const res = await fetch('/api/admin/refresh-clinical-trials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.operationId) setStatusMsg({ type: 'info', text: 'Clinical trials refresh task started in background.', opId: data.operationId });
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Failed to start trials refresh.' });
        } finally {
            setRefreshingCT(false);
        }
    };

    const handlePurge = async () => {
        if (purgeConfirmText !== 'PURGE') return;
        setShowPurgeConfirm(false);
        setPurgeConfirmText('');
        setPurging(true);
        setStatusMsg({ type: 'info', text: 'System purge task started in background.' });
        try {
            const res = await fetch('/api/admin/purge', { method: 'POST' });
            if (!res.ok) throw new Error('API reported failure');
            setTimeout(fetchMetrics, 1000);
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Purge request failed.' });
        } finally {
            setPurging(false);
        }
    };

    const handleCleanupStaleTasks = async () => {
        setCleaningStale(true);
        try {
            const res = await fetch('/api/admin/operations/cleanup', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg({ type: 'success', text: data.message || 'Cleanup complete.' });
            } else {
                setStatusMsg({ type: 'error', text: data.error || 'Cleanup failed.' });
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Cleanup request failed.' });
        } finally {
            setCleaningStale(false);
        }
    };

    const handleDelete = (id: string, name: string) => {
        setMedicalTermToDelete({ id, name });
    };

    const executeDelete = async () => {
        if (!medicalTermToDelete) return;
        const { id, name } = medicalTermToDelete;
        setMedicalTermToDelete(null);
        try {
            const res = await fetch(`/api/admin/medical-term/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg({ type: 'success', text: `Deleted "${name}" (${data.deletedArticles} articles removed).` });
                fetchMetrics();
            } else {
                setStatusMsg({ type: 'error', text: data.error || 'Delete failed.' });
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Delete request failed.' });
        }
    };

    const handleBackfillCategories = async () => {
        setClassifying(true);
        setStatusMsg({ type: 'info', text: 'Classifying terms into research categories...' });
        setStatusLog([]);
        try {
            const res = await fetch('/api/admin/backfill-categories', { method: 'POST' });
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const lines = decoder.decode(value).split('\n').filter(Boolean);
                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.message) {
                                setStatusLog(prev => [parsed.message, ...prev].slice(0, 50));
                                setStatusMsg({ type: 'info', text: parsed.message });
                            }
                        } catch { /* skip */ }
                    }
                }
            }
            setStatusMsg({ type: 'success', text: 'Family classification complete.' });
            fetchMetrics();
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Family classification failed.' });
        } finally {
            setClassifying(false);
        }
    };

    const handleSyncHealthMetrics = async () => {
        setSyncingHealth(true);
        setStatusMsg({ type: 'info', text: 'Health metrics sync task started in background.' });
        try {
            const res = await fetch('/api/admin/sync-health-metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.operationId) setStatusMsg({ type: 'info', text: 'Health metrics sync task started in background.', opId: data.operationId });
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Sync failed to start.' });
        } finally {
            setSyncingHealth(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                <header className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Database className="w-8 h-8 text-blue-700" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Knowledge Base Admin</h1>
                            <p className="text-slate-500 font-medium text-sm">Manage PubMed extraction boundaries and monitor system processing integrity.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleResynthesizeAll}
                            disabled={synthesizing || refreshing || metrics.length === 0}
                            className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-xl font-bold transition disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${synthesizing ? 'animate-spin' : ''}`} />
                            <span>Resynthesize All</span>
                        </button>
                        <Link href="/admin/operations" className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold transition">
                            <Activity className="w-4 h-4" />
                            <span>View Task History</span>
                        </Link>
                        <button
                            onClick={fetchMetrics}
                            className="p-2.5 bg-slate-100 font-bold rounded-xl text-slate-700 hover:bg-slate-200 transition"
                            title="Refresh Dashboard Metrics"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </header>

                {statusMsg && (
                    <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 ${statusMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                        statusMsg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                            'bg-blue-50 border-blue-200 text-blue-800'}`}>
                        <div className="flex items-center gap-3">
                            {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                                statusMsg.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                                    <Activity className="w-5 h-5 animate-pulse" />}
                            <div>
                                <span className="font-bold">{statusMsg.text}</span>
                                {statusMsg.opId && (
                                    <div className="flex items-center gap-4 mt-1">
                                        <Link href="/admin/operations" className="underline font-bold text-xs decoration-2 underline-offset-2">View Live Progress →</Link>
                                        <button
                                            onClick={handleAbort}
                                            className="text-[10px] bg-white/20 hover:bg-white/40 border border-white/20 px-2 py-0.5 rounded-md font-black uppercase tracking-widest transition"
                                        >
                                            Abort Run
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setStatusMsg(null)} className="text-sm opacity-50 hover:opacity-100 font-black">✕</button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
                    {/* Simplified Onboard Data Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-600 rounded-2xl">
                                    <Globe className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Onboard Data</h2>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ingest and Synthesize new research intelligence</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            <div className="w-full md:w-1/2 space-y-6">
                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">Medical Search Term</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="e.g. Parkinson's Disease, Pembrolizumab..."
                                            value={refreshTarget}
                                            onChange={(e) => setRefreshTarget(e.target.value)}
                                            disabled={refreshing}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4">
                                    {(['quick', 'deep', 'custom'] as const).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setOnboardPreset(p)}
                                            className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition border-2 ${onboardPreset === p ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>

                                {onboardPreset === 'quick' && (
                                    <p className="text-sm text-slate-500 font-medium">
                                        <span className="font-bold text-indigo-600">Quick Mode:</span> Last 5 years of data, abstracts only from PubMed & Clinical Trials (Max 50 results).
                                    </p>
                                )}
                                {onboardPreset === 'deep' && (
                                    <p className="text-sm text-slate-500 font-medium">
                                        <span className="font-bold text-indigo-600">Deep Mode:</span> Last 5 years of data, full documents from PubMed & Clinical Trials (Max 250 results).
                                    </p>
                                )}

                                <button
                                    onClick={() => handleOnboard(refreshTarget, onboardPreset)}
                                    disabled={refreshing || !refreshTarget}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-100 transition disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {refreshing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                    {refreshing ? 'Processing Intelligence...' : 'Initiate Ingestion & Synthesis'}
                                </button>
                            </div>

                            {onboardPreset === 'custom' && (
                                <div className="w-full md:w-1/2 bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Custom Parameters</h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Timeframe</label>
                                            <select
                                                value={timeframe}
                                                title="Timeframe"
                                                onChange={(e: any) => setTimeframe(e.target.value)}
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                            >
                                                <option value="3y">3 Years</option>
                                                <option value="5y">5 Years</option>
                                                <option value="10y">10 Years</option>
                                                <option value="custom">Custom Range</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Depth</label>
                                            <select
                                                value={scanDepth}
                                                title="Scan Depth"
                                                onChange={(e: any) => setScanDepth(Number(e.target.value))}
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                            >
                                                <option value={50}>50 results</option>
                                                <option value={100}>100 results</option>
                                                <option value={250}>250 results</option>
                                                <option value={500}>500 results</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">PubMed Detail</label>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setPubmedDetail('abstract')}
                                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 transition ${pubmedDetail === 'abstract' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}
                                            >
                                                Abstract
                                            </button>
                                            <button 
                                                onClick={() => setPubmedDetail('full')}
                                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 transition ${pubmedDetail === 'full' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}
                                            >
                                                Full Text
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {onboardPreset !== 'custom' && (
                                <div className="hidden md:flex flex-1 items-center justify-center opacity-10">
                                    <Sparkles className="w-32 h-32 text-slate-300" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Maintenance and tools */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="flex items-center gap-2 mb-4">
                            <Tag className="w-5 h-5 text-emerald-600" />
                            <h2 className="text-xl font-bold text-slate-800">Global Sync</h2>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={handleBackfillCategories}
                                disabled={refreshing || synthesizing || classifying || metrics.length === 0}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-between"
                            >
                                <span className="text-xs">Classify Research Categories</span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </button>
                            <button
                                onClick={handleRefreshClinicalTrials}
                                disabled={refreshingCT || refreshing || synthesizing || syncingHealth}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-between"
                            >
                                <span className="text-xs">Sync ClinicalTrials.gov</span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-amber-600" />
                            <h2 className="text-xl font-bold text-slate-800">Cleanup</h2>
                        </div>
                        <button
                            onClick={handleCleanupStaleTasks}
                            disabled={refreshing || synthesizing || cleaningStale}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-between"
                        >
                            <span className="text-xs">Clear Stale (Zombie) Tasks</span>
                            <Activity className={`w-4 h-4 ${cleaningStale ? 'animate-spin text-amber-500' : 'text-slate-400'}`} />
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Trash2 className="w-5 h-5 text-red-600" />
                            <h2 className="text-xl font-bold text-slate-800">Purge</h2>
                        </div>
                        <button
                            onClick={() => setShowPurgeConfirm(true)}
                            disabled={refreshing || synthesizing || purging || refreshingCT || syncingHealth}
                            className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                        >
                            <span>Purge Entire Knowledge Base</span>
                        </button>
                    </div>
                </div>


                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl text-center">
                            <div className="text-4xl font-black text-blue-700 mb-1">{metrics.length}</div>
                            <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">Monitored Terms</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl text-center">
                            <div className="text-4xl font-black text-green-700 mb-1">{metrics.reduce((acc, curr) => acc + curr.totalArticles, 0)}</div>
                            <div className="text-xs font-bold text-green-900 uppercase tracking-wider">Ingested Articles</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl text-center col-span-2">
                            <div className="text-4xl font-black text-purple-700 mb-1">{metrics.reduce((acc, curr) => acc + curr.totalReports, 0)}</div>
                            <div className="text-xs font-bold text-purple-900 uppercase tracking-wider">Reports Generated</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Database Ingestion Metrics</h2>

                    {/* Search, filter and sort controls */}
                    {!loading && metrics.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-5 items-center">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search terms..."
                                    title="Search library"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            {/* Category filter */}
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <select
                                    value={filterCategory}
                                    onChange={e => setFilterCategory(e.target.value)}
                                    title="Filter by category"
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="ALL">All Categories</option>
                                    {[...new Set(metrics.map(m => m.category).filter(Boolean))].sort().map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>


                            {/* Result count */}
                            <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">
                                {filteredAndSorted.length} of {metrics.length} terms
                            </span>
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-10 text-slate-500 animate-pulse">Loading core metrics...</div>
                    ) : metrics.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">Database is currently empty. Use the manual refresh tool to begin tracking.</div>
                    ) : (
                        <div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                                        <th className="px-4 py-3 font-semibold rounded-tl-lg min-w-[200px]">Medical Term</th>
                                        <th className="px-4 py-3 font-semibold min-w-[150px]">Category</th>
                                        <th className="px-4 py-3 font-semibold text-right min-w-[120px]">
                                            <button onClick={() => handleSort('totalArticles')}
                                                className="flex items-center gap-1 ml-auto hover:text-blue-700 transition">
                                                PubMed
                                                {sortCol === 'totalArticles'
                                                    ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                                    : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-right min-w-[140px]">
                                            <button onClick={() => handleSort('clinicalTrialsCount')}
                                                className="flex items-center gap-1 ml-auto hover:text-teal-700 transition">
                                                Clinical Trials
                                                {sortCol === 'clinicalTrialsCount'
                                                    ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                                    : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-center min-w-[120px]">Synthesis</th>
                                        <th className="px-4 py-3 font-semibold text-right rounded-tr-lg min-w-[120px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {filteredAndSorted.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-slate-400">No medical terms match your filters.</td></tr>
                                    ) : filteredAndSorted.map((m) => {
                                        const ptype = getMedicalTermType(m.category);
                                        return (
                                            <tr key={m.id} className="hover:bg-slate-50 transition">
                                                {/* Term name + badge */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col items-start gap-1.5 break-words whitespace-normal">
                                                        <Link
                                                            href={`/admin/medical-term/${m.id}`}
                                                            className="font-semibold text-slate-800 hover:text-blue-600 transition leading-tight"
                                                        >
                                                            {m.name}
                                                        </Link>
                                                        {m.isSynthesized && (
                                                            <span className="flex items-center gap-0.5 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap">
                                                                <Sparkles className="w-2.5 h-2.5" />Synthesized
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Category + Type stacked */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase leading-normal whitespace-normal break-words break-all" title={m.category}>
                                                            {m.category || '—'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold w-fit ${ptype === 'BIOLOGICAL' ? 'bg-purple-50 text-purple-700' :
                                                            ptype === 'PHARMACOLOGICAL' ? 'bg-amber-50 text-amber-700' :
                                                                ptype === 'CLINICAL' ? 'bg-green-50 text-green-700' :
                                                                    'bg-slate-100 text-slate-500'}`}>
                                                            {ptype === 'BIOLOGICAL' ? '🧬 Biological' :
                                                                ptype === 'PHARMACOLOGICAL' ? '💊 Pharmacological' :
                                                                    ptype === 'CLINICAL' ? '🏥 Clinical' : 'Other'}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* PubMed */}
                                                <td className="px-4 py-3 font-bold text-slate-800 text-right tabular-nums">
                                                    {m.totalArticles > 0 ? (
                                                        <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold w-fit ml-auto">
                                                            <Activity className="w-3 h-3 mr-1" />
                                                            {m.totalArticles}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                {/* Clinical Trials */}
                                                <td className="px-4 py-3 font-bold text-slate-800 text-right tabular-nums">
                                                    {m.clinicalTrialsCount > 0 ? (
                                                        <span className="inline-flex items-center justify-center bg-teal-50 text-teal-700 px-2.5 py-1 rounded-md text-xs font-bold w-fit ml-auto">
                                                            <FlaskConical className="w-3 h-3 mr-1" />
                                                            {m.clinicalTrialsCount}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                {/* Synthesis (Icons only) */}
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleOnboard(m.name, 'quick')}
                                                        disabled={synthesizing || refreshing || m.totalArticles === 0}
                                                        title="Ingest incrementally and Re-synthesize"
                                                        className={`mx-auto w-8 h-8 flex items-center justify-center rounded-md transition disabled:opacity-30 ${m.isSynthesized ? 'bg-amber-100 hover:bg-amber-200 text-amber-700' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'}`}
                                                    >
                                                        {m.isSynthesized ? <RefreshCw className="w-4 h-4 shadow-sm" /> : <Brain className="w-4 h-4 shadow-sm" />}
                                                    </button>
                                                </td>
                                                {/* Actions (View, Delete) */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            href={`/admin/medical-term/${m.id}`}
                                                            title="View detailed articles and trials"
                                                            className="w-8 h-8 shrink-0 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition shadow-sm"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(m.id, m.name)}
                                                            disabled={synthesizing || refreshing}
                                                            title="Delete this term and all its data"
                                                            className="w-8 h-8 shrink-0 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-md transition disabled:opacity-30 shadow-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {medicalTermToDelete && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Confirm Deletion</h3>
                            <p className="text-slate-600 mb-6">
                                Are you sure you want to delete "{medicalTermToDelete.name}" and all its associated articles and reports? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setMedicalTermToDelete(null)}
                                    className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeDelete}
                                    className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showPurgeConfirm && (
                    <div className="fixed inset-0 bg-red-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-red-600 p-8 text-white flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl">
                                    <AlertCircle className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-0">Extreme Action</h3>
                                    <p className="text-red-100 font-medium">This will permanently delete the entire Medical 360 knowledge base.</p>
                                </div>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <p className="text-slate-600 text-sm leading-relaxed">
                                        You are about to delete all <strong>Medical Terms, Articles, Clinical Trials, Health Metrics, and Conversations</strong>. This process is irreversible.
                                    </p>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 text-center">Type "PURGE" to continue</p>
                                        <input
                                            type="text"
                                            value={purgeConfirmText}
                                            onChange={(e) => setPurgeConfirmText(e.target.value.toUpperCase())}
                                            placeholder="Type PURGE here..."
                                            className="w-full bg-white border-2 border-slate-200 focus:border-red-500 py-3 px-4 rounded-xl outline-none font-black tracking-widest text-center transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setShowPurgeConfirm(false); setPurgeConfirmText(''); }}
                                        className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition"
                                    >
                                        Abort
                                    </button>
                                    <button
                                        onClick={handlePurge}
                                        disabled={purgeConfirmText !== 'PURGE'}
                                        className="flex-[1.5] py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-red-200"
                                    >
                                        PURGE EVERYTHING
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
