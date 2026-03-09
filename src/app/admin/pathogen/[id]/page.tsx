'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ChevronLeft,
    Search,
    Filter,
    Calendar,
    Globe,
    FlaskConical,
    FileText,
    ExternalLink,
    Activity,
    Info,
    AlertCircle,
    Bell,
    Sparkles,
    Download
} from 'lucide-react';
import CitationContent from '@/components/CitationContent';

interface Article {
    id: string;
    pubmedId: string;
    title: string;
    authors?: string;
    publicationDate?: string;
    countryAffiliations?: string;
}

interface ClinicalTrial {
    id: string;
    nctId: string;
    title: string;
    phase?: string;
    status?: string;
    overallStatus?: string;
    locations?: string;
    startDate?: string;
}

interface EpiMetric {
    id: string;
    source: string;
    indicator: string;
    value: number;
    unit?: string;
    year: number;
    location: string;
}

interface Alert {
    id: string;
    source: string;
    title: string;
    description?: string;
    url?: string;
    severity?: string;
    publishedAt: string;
}

interface Pathogen {
    id: string;
    name: string;
    family?: string;
    synthesizedContext?: string;
    articles: Article[];
    clinicalTrials: ClinicalTrial[];
    epidemiologyMetrics: EpiMetric[];
    surveillanceAlerts: Alert[];
}

export default function PathogenDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [pathogen, setPathogen] = useState<Pathogen | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'nucleus' | 'articles' | 'trials' | 'epi' | 'alerts'>('nucleus');

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState('ALL');
    const [selectedCountry, setSelectedCountry] = useState('ALL');
    const [selectedPhase, setSelectedPhase] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch(`/api/admin/pathogens/${id}/details`);
                if (!res.ok) throw new Error('Failed to fetch pathogen details');
                const data = await res.json();
                setPathogen(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchDetails();
    }, [id]);

    // Derived data for filters
    const availableYears = useMemo(() => {
        if (!pathogen) return [];
        const articleYears = pathogen.articles
            .map(a => a.publicationDate ? new Date(a.publicationDate).getFullYear().toString() : null);

        const epiYears = pathogen.epidemiologyMetrics
            .map(m => m.year.toString());

        const years = [...articleYears, ...epiYears]
            .filter((y): y is string => !!y);

        return Array.from(new Set(years)).sort((a, b) => b.localeCompare(a));
    }, [pathogen]);

    const availableCountries = useMemo(() => {
        if (!pathogen) return [];
        const countriesSet = new Set<string>();

        const normalizeCountry = (c: string) => {
            const name = c.trim();
            if (!name || name.length <= 2) return null;

            const mapping: Record<string, string> = {
                'USA': 'United States',
                'U.S.': 'United States',
                'U.S.A.': 'United States',
                'United States of America': 'United States',
                'UK': 'United Kingdom',
                'U.K.': 'United Kingdom',
                'Great Britain': 'United Kingdom',
                'UAE': 'United Arab Emirates',
                'U.A.E.': 'United Arab Emirates',
                'Russia': 'Russian Federation',
                'South Korea': 'Korea, Republic of',
                'North Korea': 'Korea, Democratic People\'s Republic of',
                'Vietnam': 'Viet Nam'
            };

            return mapping[name] || name;
        };

        // From articles
        pathogen.articles.forEach(a => {
            if (a.countryAffiliations) {
                const parts = a.countryAffiliations.split(/[,;]/);
                parts.forEach(p => {
                    const norm = normalizeCountry(p);
                    if (norm) countriesSet.add(norm);
                });
            }
        });

        // From trials
        pathogen.clinicalTrials.forEach(t => {
            if (t.locations) {
                const parts = t.locations.split(/[,;]/);
                parts.forEach(p => {
                    const norm = normalizeCountry(p);
                    if (norm) countriesSet.add(norm);
                });
            }
        });

        // From epi metrics
        pathogen.epidemiologyMetrics.forEach(m => {
            const norm = normalizeCountry(m.location);
            if (norm) countriesSet.add(norm);
        });

        return Array.from(countriesSet).sort();
    }, [pathogen]);

    const availablePhases = useMemo(() => {
        if (!pathogen) return [];
        const phases = pathogen.clinicalTrials
            .map(t => t.phase)
            .filter((p): p is string => !!p);
        return Array.from(new Set(phases)).sort();
    }, [pathogen]);

    const availableStatuses = useMemo(() => {
        if (!pathogen) return [];
        const statuses = pathogen.clinicalTrials
            .map(t => t.overallStatus || t.status)
            .filter((s): s is string => !!s);
        return Array.from(new Set(statuses)).sort();
    }, [pathogen]);

    // Filtering logic
    const filteredArticles = useMemo(() => {
        if (!pathogen) return [];
        return pathogen.articles.filter(a => {
            const matchesSearch = !searchTerm ||
                a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.authors?.toLowerCase().includes(searchTerm.toLowerCase()));

            const year = a.publicationDate ? new Date(a.publicationDate).getFullYear().toString() : null;
            const matchesYear = selectedYear === 'ALL' || year === selectedYear;

            const matchesCountry = selectedCountry === 'ALL' ||
                (a.countryAffiliations?.toLowerCase().includes(selectedCountry.toLowerCase()));

            return matchesSearch && matchesYear && matchesCountry;
        });
    }, [pathogen, searchTerm, selectedYear, selectedCountry]);

    const filteredTrials = useMemo(() => {
        if (!pathogen) return [];
        return pathogen.clinicalTrials.filter(t => {
            const matchesSearch = !searchTerm ||
                t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.nctId.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesPhase = selectedPhase === 'ALL' || t.phase === selectedPhase;

            const status = t.overallStatus || t.status;
            const matchesStatus = selectedStatus === 'ALL' || status === selectedStatus;

            const matchesCountry = selectedCountry === 'ALL' ||
                (t.locations?.toLowerCase().includes(selectedCountry.toLowerCase()));

            return matchesSearch && matchesPhase && matchesStatus && matchesCountry;
        });
    }, [pathogen, searchTerm, selectedPhase, selectedStatus, selectedCountry]);

    const filteredEpi = useMemo(() => {
        if (!pathogen) return [];
        return pathogen.epidemiologyMetrics.filter(m => {
            const matchesSearch = !searchTerm ||
                m.indicator.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesCountry = selectedCountry === 'ALL' ||
                m.location.toLowerCase().includes(selectedCountry.toLowerCase());

            const matchesYear = selectedYear === 'ALL' || m.year.toString() === selectedYear;

            return matchesSearch && matchesCountry && matchesYear;
        });
    }, [pathogen, searchTerm, selectedCountry, selectedYear]);

    const filteredAlerts = useMemo(() => {
        if (!pathogen) return [];
        return pathogen.surveillanceAlerts.filter(a => {
            const matchesSearch = !searchTerm ||
                a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.description?.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesSearch;
        });
    }, [pathogen, searchTerm]);

    const downloadPdf = () => {
        if (!id) return;
        window.open(`/admin/pathogen/${id}/nucleus-pdf`, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Activity className="w-12 h-12 text-blue-600 animate-pulse" />
                    <p className="text-slate-500 font-medium">Loading details...</p>
                </div>
            </div>
        );
    }

    if (error || !pathogen) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 flex flex-col items-center gap-4 max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <h2 className="text-2xl font-bold text-slate-800">Error Loading Pathogen</h2>
                    <p className="text-slate-600">{error || 'Pathogen not found'}</p>
                    <Link href="/admin" className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col gap-4">
                    <Link href="/admin" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition w-fit group">
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
                        <span>Back to Dashboard</span>
                    </Link>

                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                    {pathogen.family || 'Unknown Family'}
                                </span>
                            </div>
                            <h1 className="text-4xl font-extrabold text-slate-800">{pathogen.name}</h1>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <span className="block text-2xl font-black text-slate-800">{pathogen.articles.length}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Articles</span>
                            </div>
                            <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <span className="block text-2xl font-black text-slate-800">{pathogen.clinicalTrials.length}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trials</span>
                            </div>
                            <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <span className="block text-2xl font-black text-blue-700">{pathogen.epidemiologyMetrics.length}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metrics</span>
                            </div>
                            <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <span className="block text-2xl font-black text-orange-600">{pathogen.surveillanceAlerts.length}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alerts</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs & Controls */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('nucleus')}
                            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'nucleus' ? 'text-purple-600 bg-purple-50/50 border-b-2 border-purple-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                Knowledge Nucleus
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('articles')}
                            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'articles' ? 'text-blue-600 bg-blue-50/50 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <FileText className="w-4 h-4" />
                                PubMed Research
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('trials')}
                            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'trials' ? 'text-teal-600 bg-teal-50/50 border-b-2 border-teal-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <FlaskConical className="w-4 h-4" />
                                Clinical Trials
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('epi')}
                            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'epi' ? 'text-blue-700 bg-blue-50/50 border-b-2 border-blue-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Globe className="w-4 h-4" />
                                WHO Epidemiology
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('alerts')}
                            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'alerts' ? 'text-orange-600 bg-orange-50/50 border-b-2 border-orange-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Bell className="w-4 h-4" />
                                CDC Alerts
                            </div>
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Filters Row */}
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="relative flex-1 min-w-[300px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={
                                        activeTab === 'nucleus' ? "Search intelligence..." :
                                            activeTab === 'articles' ? "Search by title or author..." :
                                                activeTab === 'trials' ? "Search by title or NCT ID..." :
                                                    activeTab === 'epi' ? "Search by indicator or region..." :
                                                        "Search alerts..."
                                    }
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                />
                            </div>

                            {activeTab !== 'nucleus' && (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-slate-400" />
                                        <select
                                            value={selectedCountry}
                                            onChange={(e) => setSelectedCountry(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="ALL">All Regions</option>
                                            {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    {activeTab === 'articles' || activeTab === 'epi' ? (
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <select
                                                value={selectedYear}
                                                onChange={(e) => setSelectedYear(e.target.value)}
                                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="ALL">All Years</option>
                                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                    ) : activeTab === 'trials' ? (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <FlaskConical className="w-4 h-4 text-slate-400" />
                                                <select
                                                    value={selectedPhase}
                                                    onChange={(e) => setSelectedPhase(e.target.value)}
                                                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="ALL">All Phases</option>
                                                    {availablePhases.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-slate-400" />
                                                <select
                                                    value={selectedStatus}
                                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="ALL">All Statuses</option>
                                                    {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        {/* List Area */}
                        <div className="space-y-4">
                            {activeTab === 'nucleus' && pathogen.synthesizedContext && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={downloadPdf}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition shadow-sm font-bold text-xs"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download PDF
                                    </button>
                                </div>
                            )}
                            {activeTab === 'nucleus' ? (
                                !pathogen.synthesizedContext ? (
                                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center gap-4">
                                        <Sparkles className="w-10 h-10 text-slate-300" />
                                        <div className="space-y-1">
                                            <p className="text-slate-500 font-bold">No Synthesis Available</p>
                                            <p className="text-slate-400 text-xs">Run 'Synthesize' from the Admin Dashboard to generate the Knowledge Nucleus.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 shadow-inner min-h-[400px]">
                                            <CitationContent
                                                content={pathogen.synthesizedContext}
                                                sources={[]} // Bare citations map directly in CitationContent
                                                className="prose prose-slate max-w-none text-slate-700 leading-relaxed citation-nucleus"
                                            />
                                        </div>

                                        {/* Integrated Surveillance Section */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* WHO Epidemiology Summary */}
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                <div className="bg-blue-50/50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                                                    <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                                        <Globe className="w-4 h-4" />
                                                        Key Epidemiology Indicators (WHO)
                                                    </h3>
                                                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded uppercase">Latest Data</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {pathogen.epidemiologyMetrics.slice(0, 5).map(m => (
                                                        <div key={m.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition">
                                                            <div>
                                                                <div className="text-xs font-bold text-slate-800">{m.indicator}</div>
                                                                <div className="text-[10px] text-slate-500">{m.location} • {m.year}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm font-black text-blue-700">{m.value.toLocaleString()}</div>
                                                                <div className="text-[10px] text-slate-400 uppercase font-medium">{m.unit}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {pathogen.epidemiologyMetrics.length === 0 && (
                                                        <div className="p-8 text-center text-slate-400 text-xs italic">No WHO metrics available.</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* CDC Alerts Summary */}
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                <div className="bg-orange-50/50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                                                    <h3 className="text-sm font-bold text-orange-900 flex items-center gap-2">
                                                        <Bell className="w-4 h-4" />
                                                        Recent Surveillance Alerts (CDC)
                                                    </h3>
                                                    <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded uppercase">Active Alerts</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {pathogen.surveillanceAlerts.slice(0, 5).map(a => (
                                                        <div key={a.id} className="p-4 hover:bg-slate-50 transition">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                {a.severity && (
                                                                    <span className={`w-2 h-2 rounded-full ${a.severity === 'High' ? 'bg-red-500' : 'bg-orange-500'}`}></span>
                                                                )}
                                                                <div className="text-xs font-bold text-slate-800 line-clamp-1">{a.title}</div>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 flex justify-between items-center">
                                                                <span>{new Date(a.publishedAt).toLocaleDateString()}</span>
                                                                <span className="font-bold text-orange-600">Source: {a.source}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {pathogen.surveillanceAlerts.length === 0 && (
                                                        <div className="p-8 text-center text-slate-400 text-xs italic">No active CDC alerts.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : activeTab === 'articles' ? (
                                filteredArticles.length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-slate-400 font-medium">No articles found matching filters.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredArticles.map(a => (
                                            <div key={a.id} className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition">
                                                <div className="flex justify-between gap-4">
                                                    <div className="space-y-2">
                                                        <a
                                                            href={`https://pubmed.ncbi.nlm.nih.gov/${a.pubmedId}/`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-lg font-bold text-slate-800 hover:text-blue-600 transition flex items-center gap-2"
                                                        >
                                                            {a.title}
                                                            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
                                                        </a>
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                                                            <span className="font-medium text-slate-700">{a.authors || 'Unknown Authors'}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                {a.publicationDate ? new Date(a.publicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                            </div>
                                                            {a.countryAffiliations && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Globe className="w-3.5 h-3.5" />
                                                                    {a.countryAffiliations}
                                                                </div>
                                                            )}
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight">PMID: {a.pubmedId}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : activeTab === 'trials' ? (
                                filteredTrials.length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-slate-400 font-medium">No trials found matching filters.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredTrials.map(t => (
                                            <div key={t.id} className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md transition">
                                                <div className="flex justify-between gap-4">
                                                    <div className="space-y-3">
                                                        <a
                                                            href={`https://clinicaltrials.gov/study/${t.nctId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-lg font-bold text-slate-800 hover:text-teal-600 transition flex items-center gap-2"
                                                        >
                                                            {t.title}
                                                            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
                                                        </a>
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                                                            <div className="flex gap-2">
                                                                <span className="bg-teal-100 text-teal-700 font-bold text-[10px] uppercase px-2 py-0.5 rounded">
                                                                    {t.phase || 'N/A'}
                                                                </span>
                                                                <span className={`font-bold text-[10px] uppercase px-2 py-0.5 rounded ${(t.overallStatus || t.status)?.toLowerCase().includes('recruiting') ? 'bg-green-100 text-green-700' :
                                                                    (t.overallStatus || t.status)?.toLowerCase().includes('completed') ? 'bg-blue-100 text-blue-700' :
                                                                        'bg-slate-100 text-slate-600'
                                                                    }`}>
                                                                    {t.overallStatus || t.status || 'N/A'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                {t.startDate ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                                                            </div>
                                                            {t.locations && (
                                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                                    <Globe className="w-3.5 h-3.5" />
                                                                    <span className="max-w-[300px] truncate" title={t.locations}>{t.locations}</span>
                                                                </div>
                                                            )}
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight">{t.nctId}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : activeTab === 'epi' ? (
                                filteredEpi.length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-slate-400 font-medium">No WHO metrics found matching filters.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    <th className="px-6 py-3">Region / Country</th>
                                                    <th className="px-6 py-3">Indicator</th>
                                                    <th className="px-6 py-3">Value</th>
                                                    <th className="px-6 py-3">Year</th>
                                                    <th className="px-6 py-3 text-right">Source</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-sm">
                                                {filteredEpi.map(m => (
                                                    <tr key={m.id} className="hover:bg-slate-50/50 transition">
                                                        <td className="px-6 py-4 font-bold text-slate-800">{m.location}</td>
                                                        <td className="px-6 py-4 text-slate-600">{m.indicator}</td>
                                                        <td className="px-6 py-4 font-mono font-bold text-blue-700">
                                                            {m.value.toLocaleString()} <span className="text-[10px] text-slate-400 font-sans tracking-tight">{m.unit}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 font-medium">{m.year}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-black uppercase">{m.source}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            ) : (
                                filteredAlerts.length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-slate-400 font-medium">No surveillance alerts found matching filters.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredAlerts.map(a => (
                                            <div key={a.id} className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-orange-300 hover:shadow-md transition">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="text-lg font-bold text-slate-800">{a.title}</h3>
                                                            {a.severity && (
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${a.severity === 'High' ? 'bg-red-100 text-red-700' :
                                                                    a.severity === 'Medium' ? 'bg-orange-100 text-orange-700' :
                                                                        'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                    {a.severity} Severity
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-600 leading-relaxed">{a.description}</p>
                                                        <div className="flex items-center gap-4 pt-2">
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                {new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                            </div>
                                                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter">Source: {a.source}</span>
                                                            {a.url && (
                                                                <a
                                                                    href={a.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-orange-600 hover:text-orange-700 text-xs font-bold flex items-center gap-1.5 transition"
                                                                >
                                                                    View Original Alert <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Tip */}
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm italic">
                    <Info className="w-4 h-4" />
                    <span>External links will open in a new browser tab. Data is kept up-to-date via automated scheduled refreshes.</span>
                </div>
            </div>
        </div>
    );
}
