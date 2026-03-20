'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CitationContent from '@/components/CitationContent';
import { Sparkles, Activity } from 'lucide-react';

export default function NucleusPdfPage() {
    const params = useParams();
    const id = params.id as string;
    const [medicalTerm, setMedicalTerm] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch(`/api/admin/medical-terms/${id}/details`);
                if (!res.ok) throw new Error('Failed to fetch medical term details');
                const data = await res.json();
                setMedicalTerm(data);

                // Trigger print after content is rendered
                if (data.synthesizedContext) {
                    setTimeout(() => {
                        window.print();
                        // Optional: close window after print
                        // window.close(); 
                    }, 1500);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchDetails();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-20">
                <div className="flex flex-col items-center gap-4">
                    <Activity className="w-12 h-12 text-blue-600 animate-pulse" />
                    <p className="text-slate-500 font-medium font-sans">Preparing Intelligence Report...</p>
                </div>
            </div>
        );
    }

    if (!medicalTerm || !medicalTerm.synthesizedContext) {
        return <div className="p-20 text-slate-500 font-sans italic text-center">No intelligence synthesis available for this medical term.</div>;
    }

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans print:p-0">
            {/* Main Print Wrapper */}
            <div className="max-w-5xl mx-auto p-12 print:max-w-none print:p-[1.5cm_2cm_2.5cm_2cm] print:m-0">
                {/* Professional Header */}
                <div className="border-b-4 border-slate-900 pb-8 mb-10 flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest mb-2">
                            <Sparkles className="w-3 h-3" />
                            Medical 360 Intelligence
                        </div>
                        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">{medicalTerm.name}</h1>
                        <p className="text-lg text-slate-500 mt-2 font-medium">Knowledge Nucleus: Consolidated Biomedical Overview</p>
                    </div>
                    <div className="text-right text-xs text-slate-400 font-mono">
                        <p>Report ID: {medicalTerm.id.substring(0, 8).toUpperCase()}</p>
                        <p>Issued: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="prose prose-slate max-w-none prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2 mb-12 print:prose-p:leading-relaxed print:prose-td:text-xs">
                    <CitationContent
                        content={medicalTerm.synthesizedContext}
                        sources={[]}
                        className="citation-nucleus-print text-slate-800 leading-relaxed"
                    />
                </div>

                {/* Investigative Focus Section in PDF */}
                {medicalTerm.logicalQuestions && medicalTerm.logicalQuestions.filter((q: any) => q.answered).length > 0 && (
                    <div className="mt-12 pt-12 border-t-2 border-slate-100 break-before-page">
                        <div className="flex items-center gap-3 mb-8">
                            <Activity className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Investigative Focus & Deep Dives</h2>
                        </div>
                        
                        <div className="space-y-10">
                            {medicalTerm.logicalQuestions.filter((q: any) => q.answered).map((q: any, idx: number) => (
                                <div key={q.id} className="space-y-4">
                                    <div className="flex gap-4 items-start">
                                        <span className="text-sm font-black text-indigo-400 bg-indigo-50 px-2 py-1 rounded">Q{idx + 1}</span>
                                        <h3 className="text-lg font-bold text-slate-900 leading-tight pt-0.5">{q.question}</h3>
                                    </div>
                                    <div className="pl-12 border-l-2 border-slate-50">
                                        <CitationContent 
                                            content={q.answer}
                                            sources={[]}
                                            className="text-sm text-slate-700 leading-relaxed italic"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>

            {/* Fixed Footer for Print */}
            <div className="mt-16 pt-8 border-t border-slate-100 text-[10px] text-slate-400 text-center flex justify-between items-center 
                print:fixed print:bottom-8 print:left-[2cm] print:right-[2cm] print:mt-0 print:pt-4 print:bg-white print:border-t print:border-slate-200">
                <p>&copy; {new Date().getFullYear()} Medical 360 Biomedical Synthesis Engine</p>
                <div className="flex items-center gap-4">
                    <p className="font-bold uppercase tracking-tighter">Confidential Intelligence Report</p>
                    <p className="print:block hidden">Page <span className="print-page-number"></span></p>
                </div>
            </div>

            {/* Print specific styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        margin: 0;
                        size: auto;
                    }
                    body {
                        background-color: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    a {
                        text-decoration: underline !important;
                        color: #4f46e5 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    /* Simple page numbering reset */
                    body {
                        counter-reset: page;
                    }
                    /* Page numbering */
                    .print-page-number::after {
                        counter-increment: page;
                        content: counter(page);
                    }
                }
            `}} />
        </div>
    );
}
