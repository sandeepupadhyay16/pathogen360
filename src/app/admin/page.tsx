'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Database, RefreshCw, AlertCircle, CheckCircle2, Brain, Sparkles, Trash2, FlaskConical, Activity, Search, ChevronUp, ChevronDown, ChevronsUpDown, Filter, Eye, Tag, Globe, Bell, Clock, ChevronRight } from 'lucide-react';
import { getPathogenType } from '@/lib/taxonomy';

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [synthesizing, setSynthesizing] = useState(false);
    const [classifying, setClassifying] = useState(false);
    const [refreshingCT, setRefreshingCT] = useState(false);
    const [syncingHealth, setSyncingHealth] = useState(false);
    const [refreshTarget, setRefreshTarget] = useState('');
    const [ingestScope, setIngestScope] = useState<'pathogen' | 'family' | 'all'>('pathogen');
    const [timeframe, setTimeframe] = useState<'3y' | '5y' | '10y' | 'custom'>('10y');
    const [customYearStart, setCustomYearStart] = useState(2010);
    const [customYearEnd, setCustomYearEnd] = useState(new Date().getFullYear());
    const [pubmedDetail, setPubmedDetail] = useState<'abstract' | 'full'>('full');
    const [trialsDetail, setTrialsDetail] = useState<'basic' | 'detailed'>('detailed');
    const [healthDetail, setHealthDetail] = useState<'essential' | 'comprehensive'>('comprehensive');
    const [scanDepth, setScanDepth] = useState(50);
    const [purging, setPurging] = useState(false);
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
    const [purgeConfirmText, setPurgeConfirmText] = useState('');
    const [progress, setProgress] = useState(0);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info', text: string, opId?: string } | null>(null);
    const [currentOpId, setCurrentOpId] = useState<string | null>(null);
    const [cleaningStale, setCleaningStale] = useState(false);
    const [pathogenToDelete, setPathogenToDelete] = useState<{ id: string, name: string } | null>(null);
    const [ctStats, setCtStats] = useState<{ totalTrials: number; vaccineTrials: number; activeTrials: number; lastRefreshed: string | null } | null>(null);

    // Table search / filter / sort state
    const [search, setSearch] = useState('');
    const [filterFamily, setFilterFamily] = useState('ALL');
    const [filterType, setFilterType] = useState('ALL');
    const [filterCountry, setFilterCountry] = useState('ALL');
    const [sortCol, setSortCol] = useState<string>('totalArticles');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');


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
            if (col === 'totalArticles') return filterCountry === 'ALL' ? (m.totalArticles ?? 0) : (m.countryBreakdown[filterCountry] ?? 0);
            if (col === 'vaccineTrialsCount') return filterCountry === 'ALL' ? (m.vaccineTrialsCount ?? 0) : (m.vaccineTrialsBreakdown[filterCountry] ?? 0);
            return 0;
        };

        return metrics
            .filter(m => {
                if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
                if (filterFamily !== 'ALL' && m.family !== filterFamily) return false;
                if (filterType !== 'ALL' && getPathogenType(m.family) !== filterType.toUpperCase()) return false;
                if (filterCountry !== 'ALL' && (m.countryBreakdown[filterCountry] ?? 0) === 0) return false;
                return true;
            })
            .sort((a, b) => {
                const aVal = getValue(a, sortCol);
                const bVal = getValue(b, sortCol);
                return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
            });
    }, [metrics, search, filterFamily, filterType, filterCountry, sortCol, sortDir]);

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
            setMetrics(data.pathogens || []);
        } catch (err) {
            console.error('Failed to fetch metrics', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async (target: string) => {
        if (!target) return;
        setRefreshing(true);
        setStatusMsg({ type: 'info', text: `Ingestion task started in background for ${target}.` });

        try {
            const res = await fetch('/api/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pathogenName: target,
                    maxResults: scanDepth,
                    scope: ingestScope,
                    timeframe,
                    pubmedDetails: pubmedDetail,
                    customYearStart,
                    customYearEnd
                }),
            });
            const data = await res.json();
            if (data.operationId) setStatusMsg({ type: 'info', text: `Ingestion task started in background for ${target}.`, opId: data.operationId });
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Failed to start ingestion.' });
        } finally {
            setRefreshing(false);
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

    const handleRefreshAll = async () => {
        setIngestScope('all');
        handleRefresh('ALL_REGISTRY');
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

            // Wait a moment then refresh metrics to show empty state
            setTimeout(fetchMetrics, 1000);
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Purge request failed.' });
        } finally {
            setPurging(false);
        }
    };

    const handleSynthesize = async (pathogenId?: string, force?: boolean) => {
        setSynthesizing(true);
        setStatusMsg({ type: 'info', text: 'Synthesis task started in background.' });
        try {
            const payload = pathogenId ? { pathogenId, force: true } : { all: true, force: !!force };
            const res = await fetch('/api/synthesize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.operationId) setStatusMsg({ type: 'info', text: 'Synthesis task started in background.', opId: data.operationId });
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Synthesis failed to start.' });
        } finally {
            setSynthesizing(false);
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
        setPathogenToDelete({ id, name });
    };

    const executeDelete = async () => {
        if (!pathogenToDelete) return;
        const { id, name } = pathogenToDelete;
        setPathogenToDelete(null);

        try {
            const res = await fetch(`/api/admin/pathogen/${id}`, { method: 'DELETE' });
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

    const handleBackfillFamilies = async () => {
        setClassifying(true);
        setStatusMsg({ type: 'info', text: 'Classifying pathogens with missing families...' });
        setStatusLog([]);
        try {
            const res = await fetch('/api/admin/backfill-families', { method: 'POST' });
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* STEP 1: INGEST */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm">1</div>
                            <h2 className="text-xl font-bold text-slate-800">Universal Ingestion</h2>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mb-5 uppercase tracking-wider leading-tight">
                            Syncs PubMed Literature, Clinical Trials, and World Health metrics in one pass.
                        </p>

                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Ingestion Scope</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['pathogen', 'family', 'all'].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setIngestScope(s as any)}
                                            className={`py-2 px-1 rounded-lg text-xs font-semibold transition ${ingestScope === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                        >
                                            {s.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {ingestScope !== 'all' && (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                        {ingestScope === 'family' ? "Taxonomic Group" : "Pathogen Name"}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={ingestScope === 'family' ? "e.g. Filoviridae" : "e.g. Zika Virus"}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        value={refreshTarget}
                                        onChange={(e) => setRefreshTarget(e.target.value)}
                                        disabled={refreshing}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Timeframe Filter</label>
                                <select
                                    value={timeframe}
                                    onChange={(e: any) => setTimeframe(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="3y">Last 3 Years</option>
                                    <option value="5y">Last 5 Years</option>
                                    <option value="10y">Last 10 Years</option>
                                    <option value="custom">Custom Range...</option>
                                </select>

                                {timeframe === 'custom' && (
                                    <div className="flex gap-2 mt-2">
                                        <input
                                            type="number"
                                            value={customYearStart}
                                            onChange={(e) => setCustomYearStart(parseInt(e.target.value))}
                                            className="w-1/2 px-2 py-1 border border-slate-200 rounded text-xs"
                                        />
                                        <input
                                            type="number"
                                            value={customYearEnd}
                                            onChange={(e) => setCustomYearEnd(parseInt(e.target.value))}
                                            className="w-1/2 px-2 py-1 border border-slate-200 rounded text-xs"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Source Detail Level</label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                                        <span className="text-xs font-medium text-slate-700">PubMed Research</span>
                                        <button
                                            onClick={() => setPubmedDetail(pubmedDetail === 'abstract' ? 'full' : 'abstract')}
                                            className={`text-[10px] px-2 py-1 rounded uppercase font-bold transition ${pubmedDetail === 'full' ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-700'}`}
                                        >
                                            {pubmedDetail}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 opacity-60 pointer-events-none">
                                        <span className="text-xs font-medium text-slate-700">Clinical Trials</span>
                                        <button className="text-[10px] px-2 py-1 rounded bg-slate-300 text-slate-700 uppercase font-bold">Standard</button>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 opacity-60 pointer-events-none">
                                        <span className="text-xs font-medium text-slate-700">WHO/CDC Data</span>
                                        <button className="text-[10px] px-2 py-1 rounded bg-slate-300 text-slate-700 uppercase font-bold">Essential</button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Ingestion Depth</label>
                                <div className="grid grid-cols-5 gap-1">
                                    {[25, 50, 100, 500, 1000].map((v) => (
                                        <button
                                            key={v}
                                            onClick={() => setScanDepth(v)}
                                            className={`py-1.5 rounded-lg text-[10px] font-bold transition ${scanDepth === v ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                        >
                                            {v === 1000 ? 'ALL' : v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => handleRefresh(ingestScope === 'all' ? 'FULL_REGISTRY' : refreshTarget)}
                                disabled={refreshing || (!refreshTarget && ingestScope !== 'all')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition disabled:bg-blue-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                            >
                                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                                {refreshing ? 'Processing...' : 'Run Ingestion'}
                            </button>
                        </div>
                    </div>

                    {/* STEP 2: SYNTHESIZE */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="bg-purple-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm">2</div>
                            <h2 className="text-xl font-bold text-slate-800">Synthesize Base</h2>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">
                            Constructs the "Knowledge Nucleus" by running high-level analysis on the ingested literature and health metrics.
                        </p>

                        <div className="mt-auto space-y-4">
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                <div className="text-xs font-bold text-purple-700 uppercase mb-1">Total Coverage</div>
                                <div className="text-2xl font-black text-purple-900">{metrics.reduce((acc, curr) => acc + (curr.isSynthesized ? 1 : 0), 0)} / {metrics.length}</div>
                                <div className="text-[10px] text-purple-600 mt-1">Pathogens with Knowledge Nucleus</div>
                                {statusMsg?.opId && synthesizing && (
                                    <div className="mt-3 h-1.5 w-full bg-purple-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-600 animate-pulse" style={{ width: '100%' }} />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => handleSynthesize()}
                                disabled={refreshing || synthesizing || metrics.length === 0}
                                className="w-full bg-purple-700 hover:bg-purple-800 text-white py-4 rounded-xl font-bold transition disabled:bg-purple-300 flex items-center justify-center gap-2 shadow-lg shadow-purple-100"
                            >
                                <Brain className={`w-5 h-5 ${synthesizing ? 'animate-pulse' : ''}`} />
                                <span>{synthesizing ? 'Synthesizing...' : 'Re-Synthesize All'}</span>
                            </button>
                        </div>
                    </div>

                    {/* STEP 3: MAINTENANCE */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="bg-emerald-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm">3</div>
                            <h2 className="text-xl font-bold text-slate-800">Global Sync Tools</h2>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mb-5 uppercase tracking-wider leading-tight">
                            Maintenance tools for database-wide refreshes of public data sources.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleBackfillFamilies}
                                disabled={refreshing || synthesizing || classifying || metrics.length === 0}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-slate-500" />
                                    <span>Classify Taxonomic Families</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </button>

                            <button
                                onClick={handleRefreshClinicalTrials}
                                disabled={refreshingCT || refreshing || synthesizing || syncingHealth}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2">
                                    <FlaskConical className="w-4 h-4 text-slate-500" />
                                    <span>Sync ClinicalTrials.gov</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </button>

                            <button
                                onClick={handleSyncHealthMetrics}
                                disabled={syncingHealth || refreshing || synthesizing || refreshingCT}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-slate-500" />
                                    <span>Sync Health Surveillance</span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </button>

                            <button
                                onClick={handleCleanupStaleTasks}
                                disabled={refreshing || synthesizing || cleaningStale}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <span>Clear Stale (Zombie) Tasks</span>
                                </div>
                                <Activity className={`w-4 h-4 ${cleaningStale ? 'animate-spin text-amber-500' : 'text-slate-400'}`} />
                            </button>
                        </div>

                        <div className="mt-auto pt-6">
                            <button
                                onClick={() => setShowPurgeConfirm(true)}
                                disabled={refreshing || synthesizing || purging || refreshingCT || syncingHealth}
                                className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-5 h-5" />
                                <span>{purging ? 'Purging...' : 'Purge Entire Knowledge Base'}</span>
                            </button>
                            <p className="text-[10px] text-red-400 mt-2 text-center uppercase font-bold tracking-tighter">
                                Critical Action: Irreversible Data Loss
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl text-center">
                            <div className="text-4xl font-black text-blue-700 mb-1">{metrics.length}</div>
                            <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">Monitored Pathogens</div>
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

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Database Ingestion Metrics</h2>

                    {/* Search, filter and sort controls */}
                    {!loading && metrics.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-5 items-center">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search pathogens..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            {/* Family filter */}
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <select
                                    value={filterFamily}
                                    onChange={e => setFilterFamily(e.target.value)}
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="ALL">All Families</option>
                                    {[...new Set(metrics.map(m => m.family).filter(Boolean))].sort().map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>
                            {/* Type filter */}
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">All Types</option>
                                <option value="viral">🦠 Viral</option>
                                <option value="bacterial">🧫 Bacterial</option>
                                <option value="parasitic">🪱 Parasitic</option>
                                <option value="fungal">🍄 Fungal</option>
                                <option value="other">Other</option>
                            </select>
                            {/* Country filter */}
                            <select
                                value={filterCountry}
                                onChange={e => setFilterCountry(e.target.value)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">All Countries</option>
                                <option value="USA">🇺🇸 USA</option>
                                <option value="UK">🇬🇧 UK</option>
                                <option value="Germany">🇩🇪 Germany</option>
                                <option value="Japan">🇯🇵 Japan</option>
                            </select>

                            {/* Result count */}
                            <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">
                                {filteredAndSorted.length} of {metrics.length} pathogens
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
                                        <th className="px-4 py-3 font-semibold rounded-tl-lg w-[28%]">Pathogen</th>
                                        <th className="px-4 py-3 font-semibold w-[22%]">Family / Type</th>
                                        <th className="px-4 py-3 font-semibold w-[12%]">Synthesis</th>
                                        <th className="px-4 py-3 font-semibold text-right w-[15%]">
                                            <button onClick={() => handleSort('vaccineTrialsCount')}
                                                className="flex items-center gap-1 ml-auto hover:text-blue-700 transition">
                                                Vaccine Trials
                                                {sortCol === 'vaccineTrialsCount'
                                                    ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                                    : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-right w-[15%]">
                                            <button onClick={() => handleSort('totalArticles')}
                                                className="flex items-center gap-1 ml-auto hover:text-blue-700 transition">
                                                WHO/CDC
                                                {sortCol === 'epiCount'
                                                    ? sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                                                    : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-right rounded-tr-lg w-[8%]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {filteredAndSorted.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-slate-400">No pathogens match your filters.</td></tr>
                                    ) : filteredAndSorted.map((m) => {
                                        const ptype = getPathogenType(m.family);
                                        return (
                                            <tr key={m.id} className="hover:bg-slate-50 transition">
                                                {/* Pathogen name + badge */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <Link
                                                            href={`/admin/pathogen/${m.id}`}
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
                                                {/* Family + Type stacked */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase leading-tight w-fit max-w-full truncate" title={m.family}>
                                                            {m.family || '—'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold w-fit ${ptype === 'VIRAL' ? 'bg-red-50 text-red-700' :
                                                            ptype === 'BACTERIAL' ? 'bg-amber-50 text-amber-700' :
                                                                ptype === 'PARASITIC' ? 'bg-green-50 text-green-700' :
                                                                    ptype === 'FUNGAL' ? 'bg-orange-50 text-orange-700' :
                                                                        'bg-slate-100 text-slate-500'}`}>
                                                            {ptype === 'VIRAL' ? '🦠 Viral' :
                                                                ptype === 'BACTERIAL' ? '🧫 Bacterial' :
                                                                    ptype === 'PARASITIC' ? '🪱 Parasitic' :
                                                                        ptype === 'FUNGAL' ? '🍄 Fungal' : 'Other'}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* Synthesis */}
                                                <td className="px-4 py-3">
                                                    {m.synthesisArticleCount ? (
                                                        <span className="flex items-center gap-1 text-purple-700 text-xs font-semibold">
                                                            <Sparkles className="w-3 h-3 shrink-0" />
                                                            {m.synthesisArticleCount}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                {/* Vaccine Trials */}
                                                <td className="px-4 py-3 font-bold text-slate-800 text-right tabular-nums">
                                                    {(filterCountry === 'ALL' ? m.vaccineTrialsCount : (m.vaccineTrialsBreakdown[filterCountry] || 0)) > 0 ? (
                                                        <span className="inline-flex items-center justify-center bg-teal-50 text-teal-700 px-2.5 py-1 rounded-md text-xs font-bold w-fit ml-auto">
                                                            <FlaskConical className="w-3 h-3 mr-1" />
                                                            {filterCountry === 'ALL' ? m.vaccineTrialsCount : (m.vaccineTrialsBreakdown[filterCountry] || 0)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                {/* Articles count */}
                                                <td className="px-4 py-3 font-semibold text-slate-500 text-right tabular-nums">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-blue-700 text-xs font-bold">{m.epiCount || 0} metrics</span>
                                                        <span className="text-orange-600 text-[10px]">{m.alertCount || 0} alerts</span>
                                                    </div>
                                                </td>
                                                {/* Icon-only action buttons */}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Link
                                                            href={`/admin/pathogen/${m.id}`}
                                                            title="View detailed articles and trials"
                                                            className="w-7 h-7 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </Link>
                                                        <button
                                                            onClick={() => handleSynthesize(m.id)}
                                                            disabled={synthesizing || refreshing || m.totalArticles === 0}
                                                            title="Synthesize knowledge nucleus"
                                                            className="w-7 h-7 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md transition disabled:opacity-30"
                                                        >
                                                            <Brain className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(m.id, m.name)}
                                                            disabled={synthesizing || refreshing}
                                                            title="Delete this pathogen and all its data"
                                                            className="w-7 h-7 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-md transition disabled:opacity-30"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
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

                {pathogenToDelete && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Confirm Deletion</h3>
                            <p className="text-slate-600 mb-6">
                                Are you sure you want to delete "{pathogenToDelete.name}" and all its associated articles and reports? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setPathogenToDelete(null)}
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
                                    <p className="text-red-100 font-medium">This will permanently delete the entire knowledge base.</p>
                                </div>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <p className="text-slate-600 text-sm leading-relaxed">
                                        You are about to delete all <strong>Pathogens, Articles, Clinical Trials, Health Metrics, and Conversations</strong>. This process is irreversible.
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
