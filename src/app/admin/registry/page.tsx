'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Database, Plus, Trash2, Play, RefreshCw, Search, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RegistryData {
    medicalTerms: string[];
    defaultScanDepth: number;
}

interface JobStatus {
    running: boolean;
    progress: number;
    log: string[];
    completed: number;
    skipped: number;
    failed: number;
    totalArticles: number;
    total: number;
    startedAt: string | null;
    finishedAt: string | null;
}

export default function MedicalTermRegistryPage() {
    const [registry, setRegistry] = useState<RegistryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [newMedicalTerm, setNewMedicalTerm] = useState('');
    const [search, setSearch] = useState('');
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const fetchRegistry = async () => {
        try {
            const res = await fetch('/api/admin/registry');
            const data = await res.json();
            setRegistry(data);
        } catch {
            setStatusMsg({ type: 'error', text: 'Failed to load registry.' });
        } finally {
            setLoading(false);
        }
    };

    const pollStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/bulk-ingest');
            const data: JobStatus = await res.json();
            setJobStatus(data);

            if (!data.running && pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
                if (data.finishedAt) {
                    setStatusMsg({ type: 'success', text: `Ingestion complete. ${data.completed - data.skipped - data.failed} ingested, ${data.skipped} skipped, ${data.failed} failed. ${data.totalArticles} articles saved.` });
                }
            }
        } catch { /* ignore */ }
    }, []);

    // Check for an already-running job on mount
    useEffect(() => {
        fetchRegistry();
        pollStatus().then(() => {
            // If there's a running job, start polling
            if (jobStatus?.running) {
                startPolling();
            }
        });
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Also check on mount if already running
    useEffect(() => {
        if (jobStatus?.running && !pollingRef.current) {
            startPolling();
        }
    }, [jobStatus?.running]);

    const startPolling = () => {
        if (pollingRef.current) return;
        pollingRef.current = setInterval(pollStatus, 2000);
    };

    const handleAdd = async () => {
        if (!newMedicalTerm.trim()) return;
        const names = newMedicalTerm.split(',').map(n => n.trim()).filter(Boolean);
        try {
            const res = await fetch('/api/admin/registry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medicalTerms: names })
            });
            const data = await res.json();
            setStatusMsg({ type: 'success', text: data.message });
            setNewMedicalTerm('');
            fetchRegistry();
        } catch {
            setStatusMsg({ type: 'error', text: 'Failed to add medical term.' });
        }
    };

    const handleRemove = async (name: string) => {
        try {
            const res = await fetch('/api/admin/registry', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medicalTerm: name })
            });
            if (res.ok) {
                setStatusMsg({ type: 'info', text: `Removed "${name}" from registry.` });
                fetchRegistry();
            }
        } catch {
            setStatusMsg({ type: 'error', text: 'Failed to remove medical term.' });
        }
    };

    const handleBulkIngest = async (force = false) => {
        setStatusMsg({ type: 'info', text: force ? 'Starting force re-ingestion...' : 'Starting knowledge base rebuild (resumable)...' });
        setJobStatus(null);

        try {
            const res = await fetch('/api/admin/bulk-ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force })
            });

            const data = await res.json();

            if (res.status === 409) {
                setStatusMsg({ type: 'error', text: 'Ingestion already in progress.' });
                startPolling();
                return;
            }

            setStatusMsg({ type: 'info', text: data.message });
            // Start polling for status
            startPolling();
        } catch {
            setStatusMsg({ type: 'error', text: 'Failed to start ingestion.' });
        }
    };

    const handlePurge = async () => {
        if (!confirm('EXTREME WARNING: This will DELETE all articles, clinical trials, reports, and knowledge base chunks. This action CANNOT be undone. Are you sure?')) return;

        setStatusMsg({ type: 'info', text: 'Purging entire knowledge base...' });
        try {
            const res = await fetch('/api/admin/purge', { method: 'POST' });
            if (res.ok) {
                setStatusMsg({ type: 'success', text: 'Knowledge base purged successfully. System is now empty.' });
                // We don't clear registry state here as registry is file-based
            } else {
                const data = await res.json();
                setStatusMsg({ type: 'error', text: data.error || 'Purge failed.' });
            }
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Purge request failed.' });
        }
    };

    const isRunning = jobStatus?.running;

    const filtered = registry?.medicalTerms.filter(
        p => p.toLowerCase().includes(search.toLowerCase())
    ) || [];

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <header className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 rounded-lg">
                            <Database className="w-8 h-8 text-emerald-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-800">Medical Term Registry</h1>
                            <p className="text-slate-500 text-sm mt-1">
                                Master list of {registry?.medicalTerms.length || 0} terms • Persists independent of database
                            </p>
                        </div>
                    </div>
                    <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" /> Back to Admin
                    </Link>
                </header>

                {/* Status Message */}
                {statusMsg && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        statusMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                        {statusMsg.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
                        {statusMsg.text}
                    </div>
                )}

                {/* Bulk Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <h2 className="text-lg font-bold text-slate-800">Knowledge Base Actions</h2>
                    <p className="text-sm text-slate-500">
                        Rebuild the entire knowledge base from the registry below. Runs in background — you can navigate away safely.
                        Resumable — already-ingested medical terms are skipped automatically.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleBulkIngest(false)}
                            disabled={!!isRunning}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition disabled:bg-emerald-300 flex items-center gap-2 text-sm"
                        >
                            <Play className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
                            {isRunning ? 'Ingesting...' : 'Rebuild Knowledge Base'}
                        </button>
                        <button
                            onClick={() => handleBulkIngest(true)}
                            disabled={!!isRunning}
                            className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold transition disabled:bg-slate-400 flex items-center gap-2 text-sm"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Force Re-ingest All
                        </button>
                        <button
                            onClick={handlePurge}
                            disabled={!!isRunning}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-6 py-3 rounded-xl font-bold transition disabled:opacity-30 flex items-center gap-2 text-sm ml-auto"
                        >
                            <Trash2 className="w-5 h-5" />
                            Purge Data
                        </button>
                    </div>

                    {/* Progress */}
                    {jobStatus && (jobStatus.running || jobStatus.finishedAt) && (
                        <div className="space-y-2">
                            <div className="w-full bg-slate-200 rounded-full h-3">
                                <div
                                    className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${jobStatus.progress}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>{jobStatus.progress}% complete • {jobStatus.completed}/{jobStatus.total} medical terms</span>
                                <span>
                                    {jobStatus.totalArticles} articles saved
                                    {jobStatus.skipped > 0 && ` • ${jobStatus.skipped} skipped`}
                                    {jobStatus.failed > 0 && ` • ${jobStatus.failed} failed`}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Status Log */}
                    {jobStatus && jobStatus.log.length > 0 && (
                        <div className="bg-slate-900 text-green-400 p-4 rounded-xl max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                            {jobStatus.log.map((msg, i) => (
                                <div key={i} className="leading-relaxed">{msg}</div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add Medical Term */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-3">Add to Registry</h2>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newMedicalTerm}
                            onChange={e => setNewMedicalTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder="Enter medical term name (comma-separated for multiple)"
                            className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        />
                        <button
                            onClick={handleAdd}
                            disabled={!newMedicalTerm.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition disabled:bg-blue-300 flex items-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                </div>

                {/* Registry List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">
                            Registered Medical Terms ({registry?.medicalTerms.length || 0})
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Filter..."
                                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-64"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {filtered.map((name, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 rounded-lg px-4 py-2.5 group transition"
                            >
                                <span className="text-sm text-slate-700 font-medium truncate mr-2">{name}</span>
                                <button
                                    onClick={() => handleRemove(name)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition p-1"
                                    title="Remove from registry"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {filtered.length === 0 && search && (
                        <p className="text-center text-slate-400 text-sm py-8">No medical terms match &quot;{search}&quot;</p>
                    )}
                </div>
            </div>
        </div>
    );
}
