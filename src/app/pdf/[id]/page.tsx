'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'next/navigation';

export default function PdfReport() {
    const params = useParams();
    const id = params.id as string;
    const [report, setReport] = useState<any>(null);

    useEffect(() => {
        fetch(`/api/report/${id}`)
            .then(res => res.json())
            .then(data => {
                setReport(data);
                setTimeout(() => window.print(), 1000);
            })
            .catch(err => console.error(err));
    }, [id]);

    if (!report) return <div className="p-10 font-mono text-gray-500">Loading document for PDF generation...</div>;

    return (
        <div className="p-10 bg-white text-black max-w-4xl mx-auto print:p-0 print:m-0 print:max-w-none">
            <div className="border-b-4 border-blue-900 pb-6 mb-8 mt-4">
                <h1 className="text-4xl font-extrabold text-blue-900">Pathogen 360: Market Insights</h1>
                <h2 className="text-2xl font-bold text-gray-700 mt-2">{report.pathogen.name}</h2>
                <p className="text-sm text-gray-500 mt-2">Generated on: {new Date(report.createdAt).toLocaleDateString()}</p>
            </div>

            <div className="space-y-8">
                <section>
                    <h3 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-blue-700 mb-4">Epidemiology & Burden</h3>
                    <div className="prose max-w-none"><ReactMarkdown>{report.epidemiology || 'No data generated.'}</ReactMarkdown></div>
                </section>

                <section>
                    <h3 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-blue-700 mb-4">Target Population Size</h3>
                    <div className="prose max-w-none"><ReactMarkdown>{report.populationSize || 'No data generated.'}</ReactMarkdown></div>
                </section>

                <section>
                    <h3 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-blue-700 mb-4">Current Vaccine Landscape</h3>
                    <div className="prose max-w-none"><ReactMarkdown>{report.vaccineLandscape || 'No data generated.'}</ReactMarkdown></div>
                </section>

                <section>
                    <h3 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-blue-700 mb-4">Market Potential</h3>
                    <div className="prose max-w-none"><ReactMarkdown>{report.marketPotential || 'No data generated.'}</ReactMarkdown></div>
                </section>

                <section>
                    <h3 className="text-xl font-bold bg-gray-100 p-2 border-l-4 border-blue-700 mb-4">Investment Gaps & Opportunities</h3>
                    <div className="prose max-w-none"><ReactMarkdown>{report.investmentGaps || 'No data generated.'}</ReactMarkdown></div>
                </section>
            </div>
        </div>
    );
}
