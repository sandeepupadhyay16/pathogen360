'use client';

import React, { useState, useMemo, useEffect } from 'react';
import CitationContent from '@/components/CitationContent';
import { 
    BookOpen, 
    FlaskConical, 
    Stethoscope, 
    Sparkles, 
    Download, 
    Search,
    ChevronLeft,
    Database,
    FileText,
    ExternalLink,
    Calendar,
    Globe,
    BrainCircuit,
    CheckCircle2,
    Loader2,
    RefreshCw,
    X as CloseIcon,
    AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface ReportClientProps {
    report: any;
    sources: any[];
}

export default function ReportClient({ report, sources }: ReportClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const medicalTerm = report; // Alias for code clarity with existing useEffects

    const [activeTab, setActiveTab] = useState<'nucleus' | 'pubmed' | 'trials'>('nucleus');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
    const [answeringIds, setAnsweringIds] = useState<Set<string>>(new Set());

    const filteredArticles = useMemo(() => {
        return report.articles?.filter((a: any) => 
            !searchTerm || 
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.authors?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.abstractText?.toLowerCase().includes(searchTerm.toLowerCase())
        ) || [];
    }, [report.articles, searchTerm]);

    const filteredTrials = useMemo(() => {
        return report.clinicalTrials?.filter((t: any) => 
            !searchTerm || 
            t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.nctId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.sponsor?.toLowerCase().includes(searchTerm.toLowerCase())
        ) || [];
    }, [report.clinicalTrials, searchTerm]);

    const downloadPdf = () => {
        window.open(`/admin/medical-term/${report.id}/nucleus-pdf`, '_blank');
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'nucleus' || tab === 'pubmed' || tab === 'trials') {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    // Sync answering state when medicalTerm data updates from server
    useEffect(() => {
        console.log('[ReportClient] logicalQuestions updated or medicalTerm changed. Checking for answered questions.');
        if (medicalTerm.logicalQuestions) {
            setAnsweringIds(prev => {
                const next = new Set(prev);
                let foundAny = false;
                medicalTerm.logicalQuestions.forEach((q: any) => {
                    if (q.answered && next.has(q.id)) {
                        console.log(`[ReportClient] Question ${q.id} is now answered. Removing from answeringIds.`);
                        next.delete(q.id);
                        foundAny = true;
                    }
                });
                return foundAny ? next : prev;
            });
        }
    }, [medicalTerm.logicalQuestions]);

    // Global listener for background task completion
    useEffect(() => {
        console.log('[ReportClient] Registering intelligence-ready event listener.');
        const handleReady = (e: any) => {
            console.log('[ReportClient] Received intelligence-ready event:', e.detail);
            if (e.detail?.medicalTermId === medicalTerm.id) {
                console.log('[ReportClient] Event matches current term. Triggering router.refresh().');
                // If operation failed, clear the spinny for that specific question if possible
                if (e.detail.status === 'FAILED') {
                    console.log('[ReportClient] Operation failed. Clearning all loaders for this term.');
                    setAnsweringIds(new Set());
                }
                router.refresh();
            }
        };

        window.addEventListener('medical360:intelligence-ready' as any, handleReady);
        return () => window.removeEventListener('medical360:intelligence-ready' as any, handleReady);
    }, [medicalTerm.id, router]);

    const handleQuestionClick = async (question: any) => {
        if (question.answered) {
            setSelectedQuestion(question);
            return;
        }

        if (answeringIds.has(question.id)) return;

        setAnsweringIds(prev => new Set(prev).add(question.id));
        try {
            const res = await fetch(`/api/admin/medical-term/${report.id}/answer-question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId: question.id })
            });
            if (!res.ok) throw new Error('Failed to initiate answering');
            
            // The notification system will handle the finished state
            // But we can show a temporary "Started" toast or just let the button pulse
        } catch (err) {
            console.error('Error triggering answer:', err);
            setAnsweringIds(prev => {
                const next = new Set(prev);
                next.delete(question.id);
                return next;
            });
        }
    };

    const recomputeAnswer = async (questionId: string) => {
        setAnsweringIds(prev => new Set(prev).add(questionId));
        setSelectedQuestion(null);
        try {
            await fetch(`/api/admin/medical-term/${report.id}/answer-question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId, forceRecompute: true })
            });
        } catch (err) {
            console.error('Error recomputing:', err);
            setAnsweringIds(prev => {
                const next = new Set(prev);
                next.delete(questionId);
                return next;
            });
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header Section */}
                <div className="flex flex-col gap-6">
                    <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition w-fit group">
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
                        <span className="text-sm font-bold">Back to Medical Library</span>
                    </Link>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] md:text-xs uppercase tracking-widest">
                                <Sparkles className="w-3 h-3" />
                                Research Intelligence Report
                            </div>
                            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">{report.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-slate-400 text-[10px] md:text-xs font-medium">
                                <span>Report ID: {report.id.substring(0, 8).toUpperCase()}</span>
                                <span className="hidden md:inline">•</span>
                                <span>Generated: {report.synthesisUpdatedAt ? new Date(report.synthesisUpdatedAt).toLocaleDateString() : 'N/A'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:flex gap-3 md:gap-4">
                            <div className="bg-white px-4 md:px-6 py-3 rounded-xl border border-slate-200 shadow-sm text-center min-w-[80px] md:min-w-[100px]">
                                <span className="block text-xl md:text-2xl font-black text-slate-800">{report.articles?.length || 0}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Articles</span>
                            </div>
                            <div className="bg-white px-4 md:px-6 py-3 rounded-xl border border-slate-200 shadow-sm text-center min-w-[80px] md:min-w-[100px]">
                                <span className="block text-xl md:text-2xl font-black text-slate-800">{report.clinicalTrials?.length || 0}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trials</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                    {/* Professional Tabs */}
                    <div className="flex border-b border-slate-100 bg-slate-50/50 overflow-x-auto no-scrollbar scroll-smooth">
                        <button
                            onClick={() => setActiveTab('nucleus')}
                            className={`px-4 md:px-8 py-4 md:py-5 text-xs md:text-sm font-black transition flex items-center gap-2 border-b-2 flex-shrink-0 ${activeTab === 'nucleus' ? 'text-purple-600 border-purple-600 bg-white' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                        >
                            <Sparkles className="w-4 h-4" />
                            Knowledge Nucleus
                        </button>
                        <button
                            onClick={() => setActiveTab('pubmed')}
                            className={`px-4 md:px-8 py-4 md:py-5 text-xs md:text-sm font-black transition flex items-center gap-2 border-b-2 flex-shrink-0 ${activeTab === 'pubmed' ? 'text-blue-600 border-blue-600 bg-white' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                        >
                            <FileText className="w-4 h-4" />
                            PubMed Research
                        </button>
                        <button
                            onClick={() => setActiveTab('trials')}
                            className={`px-4 md:px-8 py-4 md:py-5 text-xs md:text-sm font-black transition flex items-center gap-2 border-b-2 flex-shrink-0 ${activeTab === 'trials' ? 'text-teal-600 border-teal-600 bg-white' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                        >
                            <FlaskConical className="w-4 h-4" />
                            Clinical Trials
                        </button>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Control Bar */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={activeTab === 'nucleus' ? "Search intelligence narrative..." : "Search results..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                />
                            </div>
                            {activeTab === 'nucleus' && (
                                <button
                                    onClick={downloadPdf}
                                    className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition shadow-lg shadow-purple-200 font-black text-xs uppercase tracking-widest whitespace-nowrap"
                                >
                                    <Download className="w-4 h-4" />
                                    Download PDF
                                </button>
                            )}
                        </div>

                        {/* Rendering Section */}
                        <div className="min-h-[500px]">
                            {activeTab === 'nucleus' && (
                                <div className="bg-slate-50 rounded-3xl p-10 shadow-inner border border-slate-100">
                                    {/* Investigative Focus Section */}
                                    {report.logicalQuestions && report.logicalQuestions.length > 0 && (
                                        <div className="mb-10 bg-white/50 border border-slate-200 rounded-2xl p-6 backdrop-blur-sm">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="p-2 bg-indigo-100 rounded-lg">
                                                    <BrainCircuit className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Investigative Focus</h3>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Core inquiries addressed in this synthesis</p>
                                                </div>
                                            </div>
                                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                 {report.logicalQuestions.map((q: any, idx: number) => {
                                                     const isAnswering = answeringIds.has(q.id);
                                                     const isStale = q.answered && report.synthesisUpdatedAt && (
                        new Date(report.synthesisUpdatedAt).getTime() - new Date(q.updatedAt).getTime() > 60000
                    );
                                                     
                                                     return (
                                                         <button 
                                                            key={q.id} 
                                                            onClick={() => handleQuestionClick(q)}
                                                            disabled={isAnswering}
                                                            className={`flex gap-3 text-xs text-left p-3 rounded-xl border transition-all shadow-sm items-center relative group ${
                                                                q.answered 
                                                                    ? 'bg-blue-50 border-blue-100 text-blue-900 hover:bg-blue-100 hover:border-blue-200' 
                                                                    : 'bg-white/80 border-slate-100 text-slate-600 hover:bg-white hover:border-indigo-200'
                                                            } ${isAnswering ? 'animate-pulse' : ''}`}
                                                         >
                                                             <span className={`text-[9px] font-black ${q.answered ? 'text-blue-400' : 'text-indigo-400'}`}>0{idx + 1}</span>
                                                             <span className="font-medium leading-tight flex-1">{q.question}</span>
                                                             
                                                             {q.answered && !isAnswering && (
                                                                 <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
                                                             )}
                                                             {isAnswering && (
                                                                 <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />
                                                             )}
                                                             {isStale && (
                                                                 <div className="absolute -top-1 -right-1" title="Potentially stale answer">
                                                                     <AlertCircle className="w-3 h-3 text-orange-500 fill-white" />
                                                                 </div>
                                                             )}
                                                         </button>
                                                     );
                                                 })}
                                             </div>
                                        </div>
                                    )}

                                    <CitationContent
                                        content={report.synthesizedContext || 'Knowledge Nucleus data not available.'}
                                        sources={sources}
                                        className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-lg"
                                    />
                                </div>
                            )}

                            {activeTab === 'pubmed' && (
                                <div className="space-y-6">
                                    {filteredArticles.map((a: any) => (
                                        <div key={a.id} className="group bg-white p-6 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-xl transition-all">
                                            <div className="flex justify-between gap-6">
                                                <div className="space-y-3">
                                                    <a
                                                        href={`https://pubmed.ncbi.nlm.nih.gov/${a.pubmedId}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xl font-bold text-slate-900 hover:text-blue-600 transition flex items-center gap-2 leading-tight"
                                                    >
                                                        {a.title}
                                                        <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                                    </a>
                                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 font-medium">
                                                        <span className="text-slate-800">{a.authors || 'Unknown Authors'}</span>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4" />
                                                            {a.publicationDate ? new Date(a.publicationDate).toLocaleDateString() : 'N/A'}
                                                        </div>
                                                        <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black tracking-widest">PMID: {a.pubmedId}</span>
                                                    </div>
                                                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                                                        {a.abstractText || 'No abstract available.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredArticles.length === 0 && (
                                        <div className="py-20 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-3xl">
                                            No articles match your search criteria.
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'trials' && (
                                <div className="space-y-6">
                                    {filteredTrials.map((t: any) => (
                                        <div key={t.id} className="group bg-white p-6 rounded-2xl border border-slate-100 hover:border-teal-200 hover:shadow-xl transition-all">
                                            <div className="flex justify-between items-start gap-6">
                                                <div className="space-y-4 flex-1">
                                                    <a
                                                        href={`https://clinicaltrials.gov/study/${t.nctId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xl font-bold text-slate-900 hover:text-teal-600 transition flex items-center gap-2 leading-tight"
                                                    >
                                                        {t.title}
                                                        <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                                    </a>
                                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                                                        <div className="flex gap-2">
                                                            <span className="bg-teal-50 text-teal-700 font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border border-teal-100">
                                                                {t.phase || 'N/A'}
                                                            </span>
                                                            <span className={`font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border ${
                                                                (t.overallStatus || t.status)?.toLowerCase().includes('recruiting') ? 'bg-green-50 text-green-700 border-green-100' :
                                                                (t.overallStatus || t.status)?.toLowerCase().includes('completed') ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                'bg-slate-50 text-slate-600 border-slate-100'
                                                            }`}>
                                                                {t.overallStatus || t.status || 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 font-medium">
                                                            <Globe className="w-4 h-4" />
                                                            <span className="max-w-[200px] truncate">{t.sponsor || 'Unknown Sponsor'}</span>
                                                        </div>
                                                        <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black tracking-widest">{t.nctId}</span>
                                                    </div>
                                                    <div className="bg-slate-50/50 p-4 rounded-xl">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Intervention Landscape</span>
                                                        <p className="text-slate-600 text-sm leading-relaxed">
                                                            {t.interventionDetails || 'No detailed intervention data available for this trial.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredTrials.length === 0 && (
                                        <div className="py-20 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-3xl">
                                            No clinical trials match your search criteria.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Technical Footer */}
                <div className="pt-8 text-center text-[10px] text-slate-400 uppercase tracking-widest font-black flex justify-between items-center opacity-50">
                    <p>© {new Date().getFullYear()} Medical 360 Biomedical Synthesis Engine</p>
                    <div className="flex gap-6">
                        <span>High Fidelity Intelligence</span>
                        <span>Clinical Grade Narrative</span>
                    </div>
                </div>
            </div>

            {/* Answer Modal */}
            {selectedQuestion && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
                                    <BrainCircuit className="w-4 h-4" />
                                    Investigative Intelligence
                                </div>
                                <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
                                    {selectedQuestion.question}
                                </h2>
                                <div className="flex items-center gap-3">
                                    <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                        Nucleus Verified
                                    </span>
                                    {report.synthesisUpdatedAt && new Date(report.synthesisUpdatedAt) > new Date(selectedQuestion.updatedAt) && (
                                        <span className="flex items-center gap-1.5 bg-orange-50 text-orange-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-orange-100">
                                            <AlertCircle className="w-3 h-3" />
                                            Potentially Stale
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedQuestion(null)}
                                className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400 hover:text-slate-600"
                                title="Close"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="prose prose-slate max-w-none">
                                <CitationContent 
                                    content={selectedQuestion.answer || 'Answering service encountered an issue. Please try regenerating.'}
                                    sources={sources}
                                    className="text-slate-700 leading-relaxed"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                Intelligence generated on {new Date(selectedQuestion.updatedAt).toLocaleString()}
                            </div>
                            <button
                                onClick={() => recomputeAnswer(selectedQuestion.id)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition font-black text-[10px] uppercase tracking-widest shadow-sm"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Regenerate Answer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
