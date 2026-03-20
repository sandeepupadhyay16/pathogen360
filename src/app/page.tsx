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
    Thermometer,
    Pill,
    Stethoscope,
    Dna as MoleculeIcon,
    PenSquare,
    Trash2
} from 'lucide-react';

interface MedicalTerm {
    id: string;
    name: string;
    category?: string;
    updatedAt: string;
    _count: {
        articles: number;
        clinicalTrials: number;
    }
}

const MedicalIcon = ({ category, className }: { category?: string, className?: string }) => {
    const c = category?.toLowerCase() || '';
    
    if (c.includes('drug') || c.includes('medicine') || c.includes('pill')) {
        return <Pill className={className} />;
    }
    
    if (c.includes('disease') || c.includes('condition') || c.includes('virus') || c.includes('bacteria')) {
        return <Stethoscope className={className} />;
    }

    if (c.includes('molecule') || c.includes('compound') || c.includes('dna')) {
        return <MoleculeIcon className={className} />;
    }

    if (c.includes('procedure') || c.includes('surgery')) {
        return <Activity className={className} />;
    }

    return <FlaskConical className={className} />;
};

export default function MedicalLibraryPage() {
    const [terms, setTerms] = useState<MedicalTerm[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    
    // Edit state
    const [editingTermId, setEditingTermId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editCategory, setEditCategory] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch('/api/medical-terms/summaries')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch: ${res.statusText}`);
                }
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setTerms(data);
                } else if (data && data.error) {
                    throw new Error(data.error);
                } else {
                    setTerms([]);
                    console.warn('Expected array of terms, got:', data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError(err.message || 'An unexpected error occurred');
                setLoading(false);
            });
    }, []);

    const categories = useMemo(() => {
        const set = new Set<string>();
        terms.forEach(t => {
            if (t.category) set.add(t.category);
        });
        return Array.from(set).sort();
    }, [terms]);

    const filteredTerms = useMemo(() => {
        return terms.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (t.category?.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [terms, searchTerm, selectedCategory]);

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

    const handleDelete = async (e: React.MouseEvent, termId: string, termName: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${termName}"? This action cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/admin/medical-term/${termId}`, { method: 'DELETE' });
            if (res.ok) {
                setTerms(t => t.filter(x => x.id !== termId));
            }
        } catch (err) { console.error(err); }
    };

    const handleEdit = (e: React.MouseEvent, term: MedicalTerm) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingTermId(term.id);
        setEditName(term.name);
        setEditCategory(term.category || '');
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!editingTermId) return;
        try {
            const res = await fetch(`/api/admin/medical-term/${editingTermId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, category: editCategory })
            });
            if (res.ok) {
                setTerms(t => t.map(x => x.id === editingTermId ? { ...x, name: editName, category: editCategory } : x));
                setEditingTermId(null);
            }
        } catch (err) { console.error(err); }
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingTermId(null);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-8 md:p-12 selection:bg-blue-500/20">
            <div className="max-w-7xl mx-auto space-y-12">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-blue-600 font-bold tracking-widest uppercase text-xs">
                            <Sparkles className="w-4 h-4 animate-pulse" />
                            <span>Medical Intelligence Nucleus</span>
                        </div>
                        <h1 className="text-6xl font-black tracking-tightest text-slate-900 leading-none">
                            Medical <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">360</span>
                        </h1>
                        <p className="text-slate-500 max-w-xl text-lg font-medium leading-relaxed">
                            A general-purpose medical research tool. Access synthesized knowledge across any medical term, powered by PubMed and ClinicalTrials.gov.
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition" />
                            <input 
                                type="text"
                                placeholder="Search medical terms..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-6 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition w-full sm:w-72 text-slate-700 shadow-sm font-bold"
                            />
                        </div>
                        <div className="relative group">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={selectedCategory}
                                title="Filter by category"
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-white border-2 border-slate-100 rounded-2xl py-3 pl-12 pr-10 text-sm outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition w-full cursor-pointer text-slate-700 shadow-sm font-bold"
                            >
                                <option value="ALL">All Categories</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
                ) : error ? (
                    <div className="py-32 text-center space-y-6 bg-red-50 rounded-[3rem] border-2 border-dashed border-red-100 shadow-sm">
                        <div className="inline-flex p-6 bg-white rounded-full text-red-500 shadow-sm">
                            <AlertCircle className="w-12 h-12" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-red-800 tracking-tight">System Error</h3>
                            <p className="text-red-600/70 text-sm font-bold max-w-sm mx-auto">{error}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-full font-bold text-sm hover:bg-red-700 transition"
                            >
                                Retry Connection
                            </button>
                        </div>
                    </div>
                ) : filteredTerms.length === 0 ? (
                    <div className="py-32 text-center space-y-6 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 shadow-sm">
                        <div className="inline-flex p-6 bg-slate-50 rounded-full text-slate-300">
                            <Search className="w-12 h-12" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Expansion Needed</h3>
                            <p className="text-slate-500 text-sm font-bold max-w-sm mx-auto">No medical terms found matching your criteria. Use the Research interface to fetch new data.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
                        {filteredTerms.map((term) => (
                            <div key={term.id} className="group relative">
                                <div className="relative aspect-[16/11] rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 transition-all duration-700 hover:-translate-y-2 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] group-hover:border-blue-100 z-10">
                                    <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(term.id)} opacity-40 transition-opacity duration-700`}></div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                                        <MedicalIcon category={term.category} className="w-full h-full" />
                                    </div>
                                    <div className="absolute inset-0 p-6 flex flex-col justify-between">
                                        <div className="flex justify-between items-start">
                                            <div className={`p-2.5 rounded-2xl bg-white shadow-sm border border-slate-50 ${getAccentColor(term.id)} transition-transform duration-500 group-hover:scale-110`}>
                                                <MedicalIcon category={term.category} className="w-5 h-5" />
                                            </div>
                                            <div className="flex gap-1 z-30">
                                                <button onClick={(e) => handleEdit(e, term)} className="p-1.5 bg-white/60 backdrop-blur-md rounded-full text-slate-400 hover:text-blue-600 border border-white/50 transition opacity-0 group-hover:opacity-100" title="Edit Topic">
                                                    <PenSquare className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={(e) => handleDelete(e, term.id, term.name)} className="p-1.5 bg-white/60 backdrop-blur-md rounded-full text-slate-400 hover:text-red-600 border border-white/50 transition opacity-0 group-hover:opacity-100" title="Delete Topic">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="px-2.5 py-1 bg-white/60 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 border border-white/50">
                                                    {new Date(term.updatedAt).getFullYear()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 z-30 relative">
                                            {editingTermId === term.id ? (
                                                <div className="space-y-2 mb-2" onClick={e => e.stopPropagation()}>
                                                    <input 
                                                        value={editCategory} onChange={e => setEditCategory(e.target.value)}
                                                        className="w-full text-[10px] font-black uppercase tracking-widest text-slate-600 bg-slate-50 border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                                                        placeholder="Category"
                                                    />
                                                    <input 
                                                        value={editName} onChange={e => setEditName(e.target.value)}
                                                        className="w-full text-lg font-black leading-tight tracking-tight text-slate-900 border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                                                        placeholder="Topic Name"
                                                    />
                                                    <div className="flex gap-2 mt-2">
                                                        <button onClick={handleSave} className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">Save</button>
                                                        <button onClick={handleCancel} className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition">Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            {term.category || 'Medical Entity'}
                                                        </span>
                                                    </div>
                                                    <h2 className="text-xl font-black leading-tight tracking-tightest text-slate-900 group-hover:text-blue-600 transition-colors">
                                                        {term.name}
                                                    </h2>
                                                </>
                                            )}
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-1 group-hover:translate-y-0">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    <span className="truncate">{term._count.articles} PubMed Articles</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                    <span className="truncate">{term._count.clinicalTrials} Clinical Trials</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <Link 
                                        href={`/report/${term.id}`}
                                        className="absolute inset-0 z-20 cursor-pointer"
                                        aria-label={`View report for ${term.name}`}
                                    />
                                </div>
                                <div className="mt-5 px-2 flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Knowledge Nucleus
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
            `}</style>
        </div>
    );
}
