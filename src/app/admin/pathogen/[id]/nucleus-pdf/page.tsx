'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CitationContent from '@/components/CitationContent';
import { Sparkles, Activity } from 'lucide-react';

export default function NucleusPdfPage() {
    const params = useParams();
    const id = params.id as string;
    const [pathogen, setPathogen] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch(`/api/admin/pathogens/${id}/details`);
                if (!res.ok) throw new Error('Failed to fetch pathogen details');
                const data = await res.json();
                setPathogen(data);

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

    if (!pathogen || !pathogen.synthesizedContext) {
        return <div className="p-20 text-slate-500 font-sans italic text-center">No intelligence synthesis available for this pathogen.</div>;
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
                            Pathogen360 Intelligence
                        </div>
                        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">{pathogen.name}</h1>
                        <p className="text-lg text-slate-500 mt-2 font-medium">Knowledge Nucleus: Consolidated Biomedical Overview</p>
                    </div>
                    <div className="text-right text-xs text-slate-400 font-mono">
                        <p>Report ID: {pathogen.id.substring(0, 8).toUpperCase()}</p>
                        <p>Issued: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                </div>

                {/* Content Area */}
                <div className="prose prose-slate max-w-none prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2 mb-12 print:prose-p:leading-relaxed print:prose-td:text-xs">
                    <CitationContent
                        content={pathogen.synthesizedContext}
                        sources={[]}
                        className="citation-nucleus-print text-slate-800 leading-relaxed"
                    />
                </div>

                {/* Supporting Data Sections (Print Friendly) */}
                <div className="space-y-12">
                    {pathogen.epidemiologyMetrics.length > 0 && (
                        <section className="print:break-inside-avoid">
                            <h2 className="text-2xl font-bold text-slate-900 border-b-2 border-slate-200 pb-2 mb-6">Supporting WHO Epidemiology Data</h2>
                            <table className="w-full text-left border-collapse border border-slate-200">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                                        <th className="border border-slate-200 p-3">Indicator</th>
                                        <th className="border border-slate-200 p-3">Location</th>
                                        <th className="border border-slate-200 p-3">Year</th>
                                        <th className="border border-slate-200 p-3 text-right">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pathogen.epidemiologyMetrics.slice(0, 10).map((m: any) => (
                                        <tr key={m.id} className="text-sm">
                                            <td className="border border-slate-200 p-3 font-medium text-slate-800">{m.indicator}</td>
                                            <td className="border border-slate-200 p-3 text-slate-600">{m.location}</td>
                                            <td className="border border-slate-200 p-3 text-slate-500">{m.year}</td>
                                            <td className="border border-slate-200 p-3 text-right font-bold text-blue-700">{m.value.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{m.unit}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    )}

                    {pathogen.surveillanceAlerts.length > 0 && (
                        <section className="print:break-before-page">
                            <h2 className="text-2xl font-bold text-slate-900 border-b-2 border-slate-200 pb-2 mb-6">Recent CDC Surveillance Alerts</h2>
                            <div className="space-y-6">
                                {pathogen.surveillanceAlerts.slice(0, 8).map((a: any) => (
                                    <div key={a.id} className="border-l-4 border-orange-500 pl-6 py-1 print:break-inside-avoid">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-slate-900">{a.title}</h3>
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">{new Date(a.publishedAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed">{a.description}</p>
                                        <div className="text-[10px] font-bold text-orange-600 uppercase mt-2">Source: {a.source} {a.severity && `• Severity: ${a.severity}`}</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {/* Fixed Footer for Print */}
            <div className="mt-16 pt-8 border-t border-slate-100 text-[10px] text-slate-400 text-center flex justify-between items-center 
                print:fixed print:bottom-8 print:left-[2cm] print:right-[2cm] print:mt-0 print:pt-4 print:bg-white print:border-t print:border-slate-200">
                <p>&copy; {new Date().getFullYear()} Pathogen360 Biomedical Synthesis Engine</p>
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
