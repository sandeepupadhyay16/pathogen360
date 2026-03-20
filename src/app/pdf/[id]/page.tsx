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
                <h1 className="text-4xl font-extrabold text-blue-900">Medical 360: Knowledge Nucleus</h1>
                <h2 className="text-2xl font-bold text-gray-700 mt-2">{report.name}</h2>
                <p className="text-sm text-gray-500 mt-2">Generated on: {report.synthesisUpdatedAt ? new Date(report.synthesisUpdatedAt).toLocaleDateString() : new Date(report.createdAt).toLocaleDateString()}</p>
            </div>

            <div className="space-y-8">
                <section>
                    <div className="prose max-w-none"><ReactMarkdown>{report.synthesizedContext || 'Knowledge Nucleus data not available. Please run synthesis.'}</ReactMarkdown></div>
                </section>
            </div>
        </div>
    );
}
