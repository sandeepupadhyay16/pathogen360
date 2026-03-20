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
    Download,
    Database,
    Layers,
    BrainCircuit,
    CheckCircle2,
    CircleDashed
} from 'lucide-react';
import CitationContent from '@/components/CitationContent';
import { buildMedicalTermContext } from '@/lib/context';

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

interface LogicalQuestion {
    id: string;
    question: string;
    category?: string;
    answered: boolean;
    answer?: string;
}

interface MedicalTerm {
    id: string;
    name: string;
    category?: string;
    synthesizedContext?: string;
    articles: Article[];
    clinicalTrials: ClinicalTrial[];
    epidemiologyMetrics: EpiMetric[];
    surveillanceAlerts: any[];
    knowledgeChunks: KnowledgeChunk[];
    logicalQuestions: LogicalQuestion[];
}

export default function MedicalTermDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [medicalTerm, setMedicalTerm] = useState<MedicalTerm | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'nucleus' | 'inquiry' | 'chunks' | 'articles' | 'trials'>('nucleus');

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState('ALL');
    const [selectedCountry, setSelectedCountry] = useState('ALL');
    const [selectedPhase, setSelectedPhase] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch(`/api/admin/medical-term/${id}/details`);
                if (!res.ok) throw new Error('Failed to fetch medical term details');
                const data = await res.json();
                setMedicalTerm(data);
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
        if (!medicalTerm) return [];
        const articleYears = medicalTerm.articles
            .map(a => a.publicationDate ? new Date(a.publicationDate).getFullYear().toString() : null);

        const epiYears = medicalTerm.epidemiologyMetrics
            .map(m => m.year.toString());

        const years = [...articleYears, ...epiYears]
            .filter((y): y is string => !!y);

        return Array.from(new Set(years)).sort((a, b) => b.localeCompare(a));
    }, [medicalTerm]);

    const availableCountries = useMemo(() => {
        if (!medicalTerm) return [];
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
        medicalTerm.articles.forEach(a => {
            if (a.countryAffiliations) {
                const parts = a.countryAffiliations.split(/[,;]/);
                parts.forEach(p => {
                    const norm = normalizeCountry(p);
                    if (norm) countriesSet.add(norm);
                });
            }
        });

        // From trials
        medicalTerm.clinicalTrials.forEach(t => {
            if (t.locations) {
                const parts = t.locations.split(/[,;]/);
                parts.forEach(p => {
                    const norm = normalizeCountry(p);
                    if (norm) countriesSet.add(norm);
                });
            }
        });

        // From epi metrics
        medicalTerm.epidemiologyMetrics.forEach(m => {
            const norm = normalizeCountry(m.location);
            if (norm) countriesSet.add(norm);
        });

        return Array.from(countriesSet).sort();
    }, [medicalTerm]);

    const availablePhases = useMemo(() => {
        if (!medicalTerm) return [];
        const phases = medicalTerm.clinicalTrials
            .map(t => t.phase)
            .filter((p): p is string => !!p);
        return Array.from(new Set(phases)).sort();
    }, [medicalTerm]);

    const availableStatuses = useMemo(() => {
        if (!medicalTerm) return [];
        const statuses = medicalTerm.clinicalTrials
            .map(t => t.overallStatus || t.status)
            .filter((s): s is string => !!s);
        return Array.from(new Set(statuses)).sort();
    }, [medicalTerm]);

    const contextData = useMemo(() => {
        if (!medicalTerm) return { sources: [] };
        // We pass clinicalTrials twice because the interface expects the full object
        // and buildMedicalTermContext expects it too.
        return buildMedicalTermContext({
            ...medicalTerm,
            clinicalTrials: medicalTerm.clinicalTrials || []
        });
    }, [medicalTerm]);

    // Filtering logic
    const filteredArticles = useMemo(() => {
        if (!medicalTerm) return [];
        return medicalTerm.articles.filter(a => {
            const matchesSearch = !searchTerm ||
                a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.authors?.toLowerCase().includes(searchTerm.toLowerCase()));

            const year = a.publicationDate ? new Date(a.publicationDate).getFullYear().toString() : null;
            const matchesYear = selectedYear === 'ALL' || year === selectedYear;

            const matchesCountry = selectedCountry === 'ALL' ||
                (a.countryAffiliations?.toLowerCase().includes(selectedCountry.toLowerCase()));

            return matchesSearch && matchesYear && matchesCountry;
        });
    }, [medicalTerm, searchTerm, selectedYear, selectedCountry]);

    const filteredTrials = useMemo(() => {
        if (!medicalTerm) return [];
        return medicalTerm.clinicalTrials.filter(t => {
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
    }, [medicalTerm, searchTerm, selectedPhase, selectedStatus, selectedCountry]);

    const filteredEpi = useMemo(() => {
        if (!medicalTerm) return [];
        return medicalTerm.epidemiologyMetrics.filter(m => {
            const matchesSearch = !searchTerm ||
                m.indicator.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesCountry = selectedCountry === 'ALL' ||
                m.location.toLowerCase().includes(selectedCountry.toLowerCase());

            const matchesYear = selectedYear === 'ALL' || m.year.toString() === selectedYear;

            return matchesSearch && matchesCountry && matchesYear;
        });
    }, [medicalTerm, searchTerm, selectedCountry, selectedYear]);

    const filteredAlerts = useMemo(() => {
        if (!medicalTerm) return [];
        return medicalTerm.surveillanceAlerts.filter(a => {
            const matchesSearch = !searchTerm ||
                a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.description?.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesSearch;
        });
    }, [medicalTerm, searchTerm]);

    const filteredChunks = useMemo(() => {
        if (!medicalTerm) return [];
        return medicalTerm.knowledgeChunks.filter(c => {
            const matchesSearch = !searchTerm ||
                c.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.sourceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.sourceType.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesSearch;
        });
    }, [medicalTerm, searchTerm]);

    const downloadPdf = () => {
        if (!id) return;
        window.open(`/admin/medical-term/${id}/nucleus-pdf`, '_blank');
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

    if (error || !medicalTerm) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 flex flex-col items-center gap-4 max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <h2 className="text-2xl font-bold text-slate-800">Error Loading Term</h2>
                    <p className="text-slate-600">{error || 'Medical term not found'}</p>
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
                                    {medicalTerm.category || 'Unknown Category'}
                                </span>
                            </div>
                            <h1 className="text-4xl font-extrabold text-slate-800">{medicalTerm.name}</h1>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <span className="block text-2xl font-black text-slate-800">{medicalTerm.articles.length}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Articles</span>
                            </div>
                            <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <span className="block text-2xl font-black text-slate-800">{medicalTerm.clinicalTrials.length}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trials</span>
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
                            onClick={() => setActiveTab('inquiry')}
                            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'inquiry' ? 'text-amber-600 bg-amber-50/50 border-b-2 border-amber-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <BrainCircuit className="w-4 h-4" />
                                Logical Inquiry
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('chunks')}
                            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'chunks' ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Database className="w-4 h-4" />
                                Knowledge Base
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
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Filters Row */}
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="relative flex-1 min-w-[300px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    title="Search within results"
                                    placeholder={
                                    activeTab === 'nucleus' ? "Search intelligence..." :
                                        activeTab === 'chunks' ? "Search raw knowledge chunks..." :
                                            activeTab === 'articles' ? "Search by title or author..." :
                                                activeTab === 'trials' ? "Search by title or NCT ID..." :
                                                    activeTab === 'epi' ? "Search by indicator or region..." :
                                                        activeTab === 'inquiry' ? "Search investigative inquiries..." :
                                                            "Search alerts..."
                                    }
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                />
                            </div>

                            { (activeTab === 'articles' || activeTab === 'trials' || activeTab === 'epi') && (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-slate-400" />
                                        <select
                                            value={selectedCountry}
                                            title="Filter by region"
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
                                                title="Filter by year"
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
                                                    title="Filter by phase"
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
                                                    title="Filter by status"
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
                            {activeTab === 'nucleus' && medicalTerm.synthesizedContext && (
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
                                !medicalTerm.synthesizedContext ? (
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
                                                content={medicalTerm.synthesizedContext}
                                                sources={contextData.sources}
                                                className="prose prose-slate max-w-none text-slate-700 leading-relaxed citation-nucleus"
                                            />
                                        </div>
                                    </div>
                                )
                            ) : activeTab === 'inquiry' ? (
                                (medicalTerm.logicalQuestions || []).length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center gap-4">
                                        <BrainCircuit className="w-10 h-10 text-slate-300" />
                                        <div className="space-y-1">
                                            <p className="text-slate-500 font-bold">No Logical Inquiry Generated</p>
                                            <p className="text-slate-400 text-xs">Run 'Ingest' or 'Update' to generate investigative questions for this term.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-inner">
                                            <div className="flex items-center gap-3 mb-6">
                                                <BrainCircuit className="w-6 h-6 text-amber-600" />
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-800">Investigative Inquiry Strategy</h3>
                                                    <p className="text-xs text-slate-500">The following questions guide our search strategy and ensuring the synthesis addresses unmet needs.</p>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {medicalTerm.logicalQuestions.map((q, idx) => (
                                                    <div key={q.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3 group hover:border-amber-400 transition">
                                                        <div className="mt-1">
                                                            {q.answered ? (
                                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                            ) : (
                                                                <CircleDashed className="w-4 h-4 text-amber-300 group-hover:animate-spin" />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase text-amber-600 tracking-tighter bg-amber-50 px-1.5 py-0.5 rounded">
                                                                    {q.category || 'Focus'}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400">Q{idx + 1}</span>
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-700 leading-snug">{q.question}</p>
                                                            {q.answer && (
                                                                <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                                                    {q.answer}
                                                                </div>
                                                            )}
                                                            <p className="text-[10px] text-slate-400 font-medium">Status: {q.answered ? 'Addressed' : 'Under Investigation'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : activeTab === 'chunks' ? (
                                filteredChunks.length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center gap-4">
                                        <Database className="w-10 h-10 text-slate-300" />
                                        <div className="space-y-1">
                                            <p className="text-slate-500 font-bold">No Knowledge Chunks</p>
                                            <p className="text-slate-400 text-xs">No raw source fragments are indexed for this term.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 flex gap-3 text-slate-700">
                                            <Info className="w-5 h-5 text-yellow-600 shrink-0" />
                                            <div className="text-xs">
                                                <p className="font-bold mb-1">Source Transparency Lineage</p>
                                                <p>These are the raw text segments retrieved from external APIs and stored as vector chunks. The "Knowledge Nucleus" is synthesized from these fragments.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {filteredChunks.map(c => (
                                                <div key={c.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${c.sourceType === 'ARTICLE' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'
                                                                }`}>
                                                                {c.sourceType}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-slate-500">{c.sourceId}</span>
                                                        </div>
                                                        <a
                                                            href={c.sourceType === 'ARTICLE' ? `https://pubmed.ncbi.nlm.nih.gov/${c.sourceId}/` : `https://clinicaltrials.gov/study/${c.sourceId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition flex items-center gap-1"
                                                        >
                                                            View Source <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                    <div className="p-4">
                                                        <p className="text-sm text-slate-600 font-serif leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-row-resize">
                                                            {c.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
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
