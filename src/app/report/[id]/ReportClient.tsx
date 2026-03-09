'use client';

import React from 'react';
import CitationContent from '@/components/CitationContent';

interface ReportClientProps {
    report: any;
    sources: any[];
}

export default function ReportClient({ report, sources }: ReportClientProps) {
    return (
        <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50 text-gray-900">
            <div className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-10 border border-gray-100">
                <div className="border-b pb-6 mb-8 text-center">
                    <h1 className="text-4xl font-extrabold text-blue-900 mb-2">Market Potential Report</h1>
                    <h2 className="text-2xl text-gray-500 font-semibold">{report.pathogen.name}</h2>
                    <div className="text-sm text-gray-400 mt-2">Generated: {new Date(report.createdAt).toLocaleDateString()}</div>
                </div>

                <section className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-3 mb-4">1. Pathogen Taxonomy & Biology</h3>
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 italic text-sm text-gray-600 mb-4">
                        Note: This section summarizes core taxonomic data.
                    </div>
                    <CitationContent
                        content={report.pathogen.taxonomy || report.pathogen.biology || 'Data not available.'}
                        sources={sources}
                        className="text-gray-700 leading-relaxed bg-white p-6 rounded-lg border border-gray-100 shadow-sm"
                    />
                </section>

                <section className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-3 mb-4">2. Epidemiology in Target Countries</h3>
                    <CitationContent
                        content={report.epidemiology || 'Data not available.'}
                        sources={sources}
                        className="text-gray-700 leading-relaxed bg-gray-50 p-6 rounded-lg border border-gray-100"
                    />
                </section>

                <section className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-3 mb-4">3. Target Population Size & Demographics</h3>
                    <CitationContent
                        content={report.populationSize || 'Data not available.'}
                        sources={sources}
                        className="text-gray-700 leading-relaxed bg-gray-50 p-6 rounded-lg border border-gray-100"
                    />
                </section>

                <section className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-3 mb-4">4. Current Vaccine Landscape (Approved & Pipeline)</h3>
                    <CitationContent
                        content={report.vaccineLandscape || 'Data not available.'}
                        sources={sources}
                        className="text-gray-700 leading-relaxed bg-gray-50 p-6 rounded-lg border border-gray-100"
                    />
                </section>

                <section className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 border-l-4 border-emerald-500 pl-3 mb-4">5. Market Potential Estimate & Investment Gaps</h3>
                    <CitationContent
                        content={report.marketPotential || 'Data not available.'}
                        sources={sources}
                        className="text-gray-700 leading-relaxed bg-emerald-50 p-6 rounded-lg border border-emerald-100 shadow-inner"
                    />
                </section>

                <div className="mt-12 text-center">
                    <a href="/admin" className="inline-block px-6 py-3 bg-blue-100 text-blue-800 font-semibold rounded-lg hover:bg-blue-200 transition-colors">
                        &larr; Back to Admin Dashboard
                    </a>
                </div>
            </div>
        </main>
    );
}
