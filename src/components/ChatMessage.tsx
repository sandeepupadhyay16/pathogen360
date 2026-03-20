'use client';

import React, { useState } from 'react';
import { FileText, Download, CheckCircle2, Sparkles, ChevronDown } from 'lucide-react';
import { downloadReportAsPdf } from '@/lib/pdf';
import CitationContent from './CitationContent';
import DiagnosticFlowchart from './DiagnosticFlowchart';

export interface Message {
    id?: string;
    role: 'user' | 'ai';
    content?: string;
    text?: string;
    pdfReportId?: string;
    sources?: any[];
    visuals?: any;
    unrecognizedMedicalTerm?: string;
    reasoning?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    diagnostic?: Record<string, any>;
    routingPath?: Array<{
        stepId: string;
        label: string;
        status: 'success' | 'warning' | 'error' | 'info';
        value: string;
        details?: string;
        metadata?: Record<string, any>;
        durationMs?: number;
    }>;
    matchedMedicalTerm?: string;
    unrecognizedMedicalTerm?: string;
}

interface ChatMessageProps {
    message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
    const isUser = message.role === 'user';
    const content = message.content || message.text || '';
    const [downloading, setDownloading] = React.useState(false);
    const [downloaded, setDownloaded] = React.useState(false);
    const [showReasoning, setShowReasoning] = React.useState(false);
    const [showDiagnostic, setShowDiagnostic] = useState(false);

    const diagnosticOpen = message.routingPath ? message.routingPath.length > 0 : false;

    const handleDownload = async () => {
        if (!message.pdfReportId) return;
        setDownloading(true);
        try {
            await downloadReportAsPdf(message.pdfReportId);
            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 3000);
        } catch (err) {
            console.error(err);
            alert('Error downloading PDF.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-8 w-full`}>
            <div
                className={`${isUser ? 'max-w-[85%]' : 'max-w-[95%] w-full'} rounded-2xl shadow-sm transition-all duration-300 ${isUser
                    ? 'bg-blue-600 text-white rounded-br-none px-5 py-3'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none p-1 xl:p-1.5'
                    }`}
            >
                {!isUser && (
                    <div className="bg-white rounded-[14px] p-5 md:p-7 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] ring-1 ring-gray-100">
                        {message.reasoning && (
                            <div className="mb-6">
                                <button
                                    onClick={() => setShowReasoning(!showReasoning)}
                                    className="text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1.5 group"
                                >
                                    <Sparkles size={12} className={showReasoning ? 'text-blue-500' : ''} />
                                    {showReasoning ? 'Hide Synthesis Reasoning' : 'Show Synthesis Reasoning'}
                                </button>
                                {showReasoning && (
                                    <div className="mt-3 p-4 bg-gray-50/50 rounded-xl text-xs italic text-gray-600 border-l-3 border-blue-200 leading-relaxed shadow-inner">
                                        {message.reasoning}
                                    </div>
                                )}
                            </div>
                        )}

                        {message.pdfReportId && (
                            <div className="flex flex-col gap-3 mb-6">
                                <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50">
                                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
                                        <FileText size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-extrabold text-blue-900 truncate">Market Potential Report</p>
                                        <p className="text-[11px] text-blue-600/70 font-bold uppercase tracking-wider">Portable Document Format (PDF)</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDownload}
                                    disabled={downloading}
                                    className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black transition-all duration-300 shadow-md transform
                                        ${downloaded ? 'bg-green-600 text-white scale-[1.02]' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 hover:shadow-lg hover:shadow-blue-200'} disabled:opacity-50`}
                                >
                                    {downloading ? (
                                        <>
                                            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Generating Report...</span>
                                        </>
                                    ) : downloaded ? (
                                        <><CheckCircle2 size={20} /><span>Download Ready</span></>
                                    ) : (
                                        <><Download size={20} /><span>Download Full Analysis Report</span></>
                                    )}
                                </button>
                            </div>
                        )}

                        <div className={`prose prose-slate max-w-none transition-opacity duration-500 ${message.pdfReportId ? 'mt-4 pt-4 border-t border-gray-50' : ''}`}>
                            <CitationContent
                                content={content}
                                sources={message.sources}
                                className="text-[15px] leading-[1.7] text-gray-700 font-medium tracking-tight"
                            />
                        </div>
                    </div>
                )}

                {isUser && (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{content}</p>
                )}
            </div>

            {!isUser && message.usage && (
                <div className="mt-1 px-2 text-[9px] text-gray-400 font-medium uppercase tracking-tight flex gap-2">
                    <span>Context: {message.usage.total_tokens?.toLocaleString() || 0} tokens</span>
                    <span className="text-gray-200">|</span>
                    <span>Limit: 128k</span>
                </div>
            )}

            {!isUser && message.routingPath && <div className="mt-3" />}
            {!isUser && diagnosticOpen && (
                <div className="mt-2 ml-0 mr-auto">
                    <button
                        onClick={() => setShowDiagnostic(!showDiagnostic)}
                        className="text-xs flex items-center gap-1 text-blue-500 hover:text-blue-600 font-medium transition mb-2 group"
                    >
                        <ChevronDown size={14} className={`transition-transform ${showDiagnostic ? 'rotate-180' : ''}`} />
                        View Diagnostic Flow ({message.routingPath?.length || 0} steps)
                    </button>
                    {showDiagnostic && (
                        <div className="animate-in slide-in-from-top-1 fade-in duration-200">
                            <DiagnosticFlowchart
                                medicalTermResolution={message.diagnostic?.medicalTermResolution || {}}
                                routeSelection={message.diagnostic?.routeSelection || {}}
                                contextAssembly={message.diagnostic?.contextAssembly || {}}
                                cacheCheck={message.diagnostic?.cacheCheck || {}}
                                tokenUsage={message.diagnostic?.tokenUsage || undefined}
                                routingPath={message.routingPath}
                                className=""
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChatMessage;
