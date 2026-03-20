'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CitationContentProps {
    content: string;
    sources?: any[];
    className?: string;
}

/**
 * Builds a lookup map from refIndex => source for quick citation resolution.
 */
function buildRefMap(sources?: any[]): Map<number, any> {
    const map = new Map<number, any>();
    if (sources) {
        for (const s of sources) {
            if (s.refIndex) map.set(s.refIndex, s);
        }
    }
    return map;
}

/**
 * Renders a superscript citation like [1] or [1,3,5] as clickable links.
 */
function RenderingCitation({ refText, refMap, keyPrefix }: { refText: string, refMap: Map<number, any>, keyPrefix: string }) {
    const nums = refText.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));

    return (
        <sup key={keyPrefix} className="inline-block align-baseline relative top-[-0.5em] text-[10px] leading-none px-0.5">
            {'['}
            {nums.map((num, i) => {
                const source = refMap.get(num);
                let href = '#';
                let colorClass = 'text-blue-600 hover:text-blue-800';

                if (source) {
                    if (source.type === 'article') {
                        href = `https://pubmed.ncbi.nlm.nih.gov/${source.id}/`;
                        colorClass = 'text-purple-600 hover:text-purple-800';
                    } else if (source.type === 'clinical_trial') {
                        href = `https://clinicaltrials.gov/study/${source.id}`;
                        colorClass = 'text-teal-600 hover:text-teal-800';
                    } else if (source.type === 'report' || source.type === 'strategic_report') {
                        href = `/report/${source.id}`;
                        colorClass = 'text-blue-600 hover:text-blue-800';
                    } else if (source.type === 'trials_summary' || source.type === 'registry_data') {
                        const medicalTermName = source.title.replace('Clinical Trial Summary: ', '');
                        href = `/search?q=${encodeURIComponent(medicalTermName)}`;
                        colorClass = 'text-blue-500 hover:text-blue-700';
                    } else if (source.type === 'alert' || source.type === 'surveillance_alert') {
                        href = source.id; // Alert ID is the URL
                        colorClass = 'text-orange-600 hover:text-orange-800';
                    } else if (source.type === 'metric' || source.type === 'gho_metric') {
                        href = 'https://www.who.int/data/gho';
                        colorClass = 'text-emerald-600 hover:text-emerald-800';
                    }
                }

                return (
                    <React.Fragment key={`${keyPrefix}-${num}`}>
                        {i > 0 && <span className="text-gray-400">,</span>}
                        <span className="relative group inline-block">
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${colorClass} font-bold hover:underline cursor-pointer`}
                                onClick={(e) => {
                                    if (href === '#' || href === '') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                }}
                            >
                                {num}
                            </a>
                            {source && (
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-3 bg-white border border-gray-200 shadow-xl rounded-lg z-[100] text-xs text-left normal-case tracking-normal font-normal pointer-events-auto">
                                    <span className="block font-bold text-gray-900 mb-1 leading-snug">{source.title}</span>
                                    {source.authors && <span className="block text-gray-500 mb-1 truncate">Authors: {source.authors}</span>}
                                    {source.id && <span className="block text-gray-400 mb-1">ID: {source.id}</span>}
                                    {source.date && <span className="block text-gray-400">Date: {new Date(source.date).toLocaleDateString()}</span>}
                                    {href && href !== '#' && !href.startsWith('javascript') && (
                                        <span className="block mt-2 text-[10px] text-blue-500 font-medium lowercase italic">Click to view source →</span>
                                    )}
                                </span>
                            )}
                        </span>
                    </React.Fragment>
                );
            })}
            {']'}
        </sup>
    );
}

export default function CitationContent({ content, sources, className = "" }: CitationContentProps) {
    if (!content) return null;

    const refMap = buildRefMap(sources);

    // Pre-process content to handle various citation formats and convert them into 
    // markdown links with a hash-based URI that ReactMarkdown won't sanitize.
    const processedContent = useMemo(() => {
        let text = content;

        // Pattern for [1], [2,3], 【1】 etc. - handles spaces like [1, 2]
        const numberedPattern = /[\[【](\d+(?:\s*,\s*\d+)*)[\]】]/g;
        text = text.replace(numberedPattern, (match, p1) => {
            const cleanNums = p1.split(',').map((s: string) => s.trim()).join(',');
            return `[${p1}](#cite-num-${cleanNums})`;
        });

        // Pattern for [KN], 【KN】
        const knPattern = /[\[【]\s*KN\s*[\]】]/gi;
        text = text.replace(knPattern, '[KN](#cite-kn-KN)');

        // Pattern for [Knowledge Nucleus]
        const knLongPattern = /[\[【](Knowledge Nucleus|Knowledge)[\]】]/gi;
        text = text.replace(knLongPattern, '[KN](#cite-kn-KN)');

        // Pattern for [PMID: 123], [NCT: 123]
        const bareIdPattern = /[\[【](PMID|NCT)\s*[:\s]\s*([a-zA-Z0-9]+)[\]】]/gu;
        text = text.replace(bareIdPattern, '[$1](#cite-id-$1-$2)');

        // Pattern for [Article: ID], [Trial: ID], [Report: ID]
        const legacyPattern = /[\[【](Article|Report|Trial): ([a-zA-Z0-9-]+)[\]】]/gi;
        text = text.replace(legacyPattern, '[$2](#cite-legacy-$1-$2)');

        return text;
    }, [content]);

    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Use the 'a' component to intercept our custom '#cite-' links
                    a: ({ node, href, children, ...props }) => {
                        const h = href || '';
                        if (h.startsWith('#cite-num-')) {
                            const num = h.replace('#cite-num-', '');
                            return <RenderingCitation refText={num} refMap={refMap} keyPrefix={`num-${num}`} />;
                        }
                        if (h.startsWith('#cite-kn-')) {
                            return (
                                <sup className="inline-block align-baseline relative top-[-0.5em] text-[10px] leading-none px-0.5">
                                    <a href="/admin" target="_blank" className="text-gray-500 hover:text-gray-700 font-bold underline decoration-dotted">
                                        KN
                                    </a>
                                </sup>
                            );
                        }
                        if (h.startsWith('#cite-id-')) {
                            const parts = h.split('-');
                            const type = parts[2];
                            const id = parts[3];
                            const targetHref = type.toUpperCase() === 'PMID'
                                ? `https://pubmed.ncbi.nlm.nih.gov/${id}/`
                                : `https://clinicaltrials.gov/study/${id}`;
                            const colorClass = type.toUpperCase() === 'PMID' ? 'text-purple-600' : 'text-teal-600';
                            return (
                                <sup className="inline-block align-baseline relative top-[-0.5em] text-[10px] leading-none px-0.5">
                                    <a href={targetHref} target="_blank" rel="noopener noreferrer" className={`${colorClass} font-bold underline decoration-dotted`}>
                                        {type.toUpperCase()}
                                    </a>
                                </sup>
                            );
                        }
                        if (h.startsWith('#cite-legacy-')) {
                            const parts = h.split('-');
                            const type = parts[2];
                            const id = parts[3];
                            const source = sources?.find(s => s.id === id);
                            const refIdx = source?.refIndex;

                            let targetHref = '';
                            let colorClass = '';

                            if (type.toLowerCase() === 'article') {
                                targetHref = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
                                colorClass = 'text-purple-600 hover:text-purple-800';
                            } else if (type.toLowerCase() === 'report') {
                                targetHref = `/admin/reports/`;
                                colorClass = 'text-blue-600 hover:text-blue-800';
                            } else if (type.toLowerCase() === 'trial') {
                                targetHref = `https://clinicaltrials.gov/study/${id}`;
                                colorClass = 'text-teal-600 hover:text-teal-800';
                            }

                            return (
                                <sup className="inline-block align-baseline relative top-[-0.5em] text-[10px] leading-none px-0.5 group">
                                    <a
                                        href={targetHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`${colorClass} font-bold underline decoration-dotted`}
                                    >
                                        {refIdx || id}
                                    </a>
                                    {source && (
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-3 bg-white border border-gray-200 shadow-xl rounded-lg z-50 text-xs text-left normal-case tracking-normal font-normal">
                                            <span className="block font-bold text-gray-900 mb-1 leading-snug">{source.title}</span>
                                            {source.authors && <span className="block text-gray-500 mb-1 truncate">Authors: {source.authors}</span>}
                                            {source.date && <span className="block text-gray-400">Date: {new Date(source.date).toLocaleDateString()}</span>}
                                            <span className="block mt-2 text-[10px] text-blue-500 font-medium">Click to view source →</span>
                                        </span>
                                    )}
                                </sup>
                            );
                        }
                        
                        // Default link behavior
                        return (
                            <a 
                                href={href === '#' ? 'javascript:void(0)' : href} 
                                {...props} 
                                target={href === '#' ? undefined : "_blank"} 
                                rel={href === '#' ? undefined : "noopener noreferrer"} 
                                className="text-blue-600 hover:underline"
                                onClick={(e) => {
                                    if (href === '#' || href === '') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                }}
                            >
                                {children}
                            </a>
                        );
                    },
                    // Handle tables specifically for responsive scrolling
                    table: ({ node, ...props }) => (
                        <div className="my-6 overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm custom-scrollbar">
                            <table {...props} className="min-w-full divide-y divide-slate-200 text-sm" />
                        </div>
                    ),
                    thead: ({ node, ...props }) => <thead {...props} className="bg-slate-50" />,
                    th: ({ node, ...props }) => <th {...props} className="min-w-[120px] px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200" />,
                    td: ({ node, ...props }) => <td {...props} className="min-w-[120px] px-4 py-3 text-slate-700 border-b border-slate-100 align-top" />,
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
}
