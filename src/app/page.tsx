'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
    Search, 
    Filter, 
    ChevronRight, 
    ChevronDown,
    FlaskConical, 
    FileText, 
    Activity,
    AlertCircle,
    ArrowRight,
    Bell,
    Bug,
    Calendar,
    Dna,
    Globe,
    Info,
    Microscope,
    ShieldAlert,
    Sparkles,
    Thermometer
} from 'lucide-react';
import { getPathogenType, getPathogenTypeLabel } from '@/lib/taxonomy';

interface Pathogen {
    id: string;
    name: string;
    family?: string;
    taxonomy?: string;
    updatedAt: string;
    _count: {
        articles: number;
        clinicalTrials: number;
        epidemiologyMetrics: number;
        surveillanceAlerts: number;
    }
}

// Custom SVG Icons for Pathogen Families
const PathogenIcon = ({ family, className }: { family?: string, className?: string }) => {
    const f = family?.toLowerCase() || '';
    
    if (f.includes('viridae') || f.includes('virus')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <circle cx="12" cy="12" r="6" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                <path d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0" />
            </svg>
        );
    }
    
    if (f.includes('bacteria') || f.includes('coccus') || f.includes('bacillus')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
                <path d="M7 12c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5z" opacity="0.3" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
                <path d="M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41M18.36 18.36l-1.41-1.41M7.05 7.05l-1.41-1.41" />
            </svg>
        );
    }

    if (f.includes('fungi') || f.includes('mycete')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 3.12 1.59 5.87 4 7.5V21h10v-1.5c2.41-1.63 4-4.38 4-7.5 0-4.97-4.03-9-9-9z" />
                <path d="M9 21v-4a3 3 0 0 1 6 0v4" />
            </svg>
        );
    }

    return <Dna className={className} />;
};

export default function PathogenLibraryPage() {
    const [pathogens, setPathogens] = useState<Pathogen[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFamily, setSelectedFamily] = useState('ALL');
    const [selectedType, setSelectedType] = useState('ALL');

    useEffect(() => {
        fetch('/api/pathogens/synthesized')
            .then(res => res.json())
            .then(data => {
                setPathogens(data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const families = useMemo(() => {
        const set = new Set<string>();
        pathogens.forEach(p => {
            if (p.family) set.add(p.family);
        });
        return Array.from(set).sort();
    }, [pathogens]);

    const filteredPathogens = useMemo(() => {
        return pathogens.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (p.family?.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesFamily = selectedFamily === 'ALL' || p.family === selectedFamily;
            
            const type = getPathogenType(p.family);
            const matchesType = selectedType === 'ALL' || type === selectedType;
            
            return matchesSearch && matchesFamily && matchesType;
        });
    }, [pathogens, searchTerm, selectedFamily, selectedType]);

    const getGradient = (id: string) => {
        const colors = [
            'from-blue-500/20 to-indigo-600/20',
            'from-purple-500/20 to-pink-600/20',
            'from-emerald-500/20 to-teal-600/20',
            'from-orange-500/20 to-red-600/20',
            'from-cyan-500/20 to-blue-600/20',
            'from-rose-500/20 to-purple-600/20'
        ];
        const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        return colors[index];
    };

    const getAccentColor = (id: string) => {
        const colors = ['text-blue-500', 'text-purple-500', 'text-emerald-500', 'text-orange-500', 'text-cyan-500', 'text-rose-500'];
        const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        return colors[index];
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-8 md:p-12 selection:bg-blue-500/20">
            <div className="max-w-7xl mx-auto space-y-12">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-blue-600 font-bold tracking-widest uppercase text-xs">
                            <Sparkles className="w-4 h-4 animate-pulse" />
                            <span>Knowledge Nucleus</span>
                        </div>
                        <h1 className="text-6xl font-black tracking-tightest text-slate-900 leading-none">
                            Pathogen <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Library</span>
                        </h1>
                        <p className="text-slate-500 max-w-xl text-lg font-medium leading-relaxed">
                            Discover high-fidelity intelligence on global pathogens, synthesized from real-world clinical and genomic data.
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition" />
                            <input 
                                type="text"
                                placeholder="Search library..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-6 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition w-full sm:w-72 text-slate-700 shadow-sm font-bold"
                            />
                        </div>
                        <div className="relative group">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="bg-white border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-10 text-sm outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition w-full cursor-pointer text-slate-700 shadow-sm font-bold"
                            >
                                <option value="ALL">All Types</option>
                                <option value="VIRAL">🦠 Viral</option>
                                <option value="BACTERIAL">🧫 Bacterial</option>
                                <option value="FUNGAL">🍄 Fungal</option>
                                <option value="PARASITIC">🪱 Parasitic</option>
                                <option value="OTHER">❓ Other</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition" />
                        </div>
                        <div className="relative group">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select 
                                value={selectedFamily}
                                onChange={(e) => setSelectedFamily(e.target.value)}
                                className="bg-white border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-10 text-sm outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition w-full cursor-pointer text-slate-700 shadow-sm font-bold"
                            >
                                <option value="ALL">All Families</option>
                                {families.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition" />
                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-pulse">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="aspect-[16/11] bg-slate-200 rounded-3xl"></div>
                        ))}
                    </div>
                ) : filteredPathogens.length === 0 ? (
                    <div className="py-32 text-center space-y-6 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-sm">
                        <div className="inline-flex p-6 bg-slate-50 rounded-full text-slate-300">
                            <Search className="w-12 h-12" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Expansion Needed</h3>
                            <p className="text-slate-500 text-sm font-bold max-w-sm mx-auto">No pathogens found matching your criteria. Use the Search interface to onboard new data.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
                        {filteredPathogens.map((pathogen) => (
                            <div key={pathogen.id} className="group relative">
                                {/* Card Wrapper */}
                                <div className="relative aspect-[16/11] rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] group-hover:border-blue-100 z-10">
                                    
                                    {/* Visual Background - Consistent Gradients */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(pathogen.id)} opacity-40 transition-opacity duration-700`}></div>
                                    
                                    {/* SVG Icon Background Element */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                                        <PathogenIcon family={pathogen.family} className="w-full h-full" />
                                    </div>

                                    {/* Content Overlay */}
                                    <div className="absolute inset-0 p-6 flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <div className={`p-2.5 rounded-2xl bg-white shadow-sm border border-slate-50 ${getAccentColor(pathogen.id)} transition-transform duration-500 group-hover:scale-110`}>
                                                <PathogenIcon family={pathogen.family} className="w-5 h-5" />
                                            </div>
                                            <div className="flex gap-1">
                                                <span className="px-2.5 py-1 bg-white/60 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 border border-white/50">
                                                    {new Date(pathogen.updatedAt).getFullYear()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {pathogen.family || 'Taxonomic Unit'}
                                                </span>
                                            </div>
                                            <h2 className="text-xl font-black leading-tight tracking-tightest text-slate-900 group-hover:text-blue-600 transition-colors">
                                                {pathogen.name}
                                            </h2>
                                            
                                            {/* Hover Revealed Stats */}
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-1 group-hover:translate-y-0">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    <span className="truncate">{pathogen._count.articles} PubMed</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                    <span className="truncate">{pathogen._count.clinicalTrials} Trials</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                    <span className="truncate">{pathogen._count.epidemiologyMetrics} Metrics</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                                    <span className="truncate">{pathogen._count.surveillanceAlerts} Alerts</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invisible full-card link */}
                                    <Link 
                                        href={`/admin/pathogen/${pathogen.id}`}
                                        className="absolute inset-0 z-20 cursor-pointer"
                                        aria-label={`View details for ${pathogen.name}`}
                                    />
                                </div>
                                
                                {/* Label Link */}
                                <div className="mt-5 px-2 flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Synthesized Report
                                    </div>
                                    <div className="text-blue-600 group-hover:translate-x-1 transition-transform">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                .tracking-tightest {
                    letter-spacing: -0.05em;
                }
                .rounded-2.5xl {
                    border-radius: 1.25rem;
                }
            `}</style>
        </div>
    );
}
