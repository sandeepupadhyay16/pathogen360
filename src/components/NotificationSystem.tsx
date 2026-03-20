'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, ArrowRight, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotificationSystem() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [seenOps, setSeenOps] = useState<Set<string>>(new Set());
    const [sessionStartTime] = useState<number>(Date.now());
    const [isInitialized, setIsInitialized] = useState(false);

    // Load seen operations from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('medical360_seen_ops');
        if (saved) {
            try {
                setSeenOps(new Set(JSON.parse(saved)));
            } catch (e) {
                console.error('Failed to parse seen_ops', e);
            }
        }
        setIsInitialized(true);
    }, []);

    // Save seen operations to localStorage
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('medical360_seen_ops', JSON.stringify(Array.from(seenOps)));
        }
    }, [seenOps, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;

        const pollOperations = async () => {
            try {
                // Fetch latest 20 operations to have a better window
                const res = await fetch('/api/admin/operations?limit=20');
                if (!res.ok) return;
                
                const data = await res.json();
                const ops = Array.isArray(data) ? data : (data.operations || []);
                
                const newNotifications: any[] = [];
                const updatedSeenOps = new Set(seenOps);
                let changed = false;

                const ONE_HOUR_MS = 60 * 60 * 1000;
                const now = Date.now();

                ops.forEach((op: any) => {
                    const completedAt = op.completedAt ? new Date(op.completedAt).getTime() : 0;
                    
                    // Logic: 
                    // 1. Must be terminal (COMPLETED/FAILED)
                    // 2. Must NOT have been seen before
                    // 3. Must be recent (last 1 hour)
                    // 4. Must be after session start (or recent enough that it's clearly relevant)
                    
                    const isTerminal = op.status === 'COMPLETED' || op.status === 'FAILED';
                    const isRecent = completedAt > (now - ONE_HOUR_MS);
                    const isNewToSession = completedAt > sessionStartTime;

                    if (isTerminal && !seenOps.has(op.id)) {
                        // Mark as seen immediately to avoid double-processing
                        updatedSeenOps.add(op.id);
                        changed = true;

                        // Only show UI notification for relevant subset
                        // (completed during session OR very recently, e.g. last 5 mins)
                        const isHighlyRelevant = completedAt > (now - 5 * 60 * 1000);

                        if ((op.type === 'ANSWER_QUESTION' || op.type === 'ONBOARD') && op.status === 'COMPLETED' && (isNewToSession || isHighlyRelevant)) {
                            console.log(`[NotificationSystem] New relevant operation: ${op.id} (${op.type})`);
                            newNotifications.push({
                                id: op.id,
                                type: op.type,
                                target: op.target,
                                medicalTermId: op.metadata?.medicalTermId,
                                timestamp: op.completedAt
                            });
                        }

                        // Always fire the event for terminal states to update UI badges/loaders
                        // even if we don't show a toast notification
                        window.dispatchEvent(new CustomEvent('medical360:intelligence-ready', { 
                            detail: { 
                                operationId: op.id, 
                                type: op.type,
                                status: op.status,
                                medicalTermId: (op.metadata as any)?.medicalTermId 
                            } 
                        }));
                    }
                });

                if (changed) {
                    // Limit initial burst: if more than 3, just show the most recent 3
                    const addedNotifications = newNotifications.slice(-3);
                    if (addedNotifications.length > 0) {
                        setNotifications(prev => [...prev.slice(-2), ...addedNotifications]);
                    }
                    setSeenOps(updatedSeenOps);
                }
            } catch (err) {
                // Silently fail polling
            }
        };

        const interval = setInterval(pollOperations, 5000); 
        pollOperations(); // Run immediately on mount/init
        return () => clearInterval(interval);
    }, [seenOps, isInitialized, sessionStartTime]);

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    if (notifications.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-4 max-w-md w-full pointer-events-none">
            {notifications.map((n) => (
                <div 
                    key={n.id}
                    className="pointer-events-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 flex gap-4 animate-in slide-in-from-right-10 duration-500"
                >
                    <div className="bg-indigo-100 p-2 rounded-xl h-fit">
                        <BrainCircuit className="w-5 h-5 text-indigo-600" />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Intelligence Ready</span>
                            <button onClick={() => removeNotification(n.id)} className="text-slate-400 hover:text-slate-600 transition" title="Dismiss">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-2">
                            {n.type === 'ONBOARD' ? `Medical Term fully onboarded: ${n.target}` : `Answer for: ${n.target}`}
                        </p>
                        <Link 
                            href={`/report/${n.medicalTermId}?tab=nucleus`}
                            onClick={() => {
                                removeNotification(n.id);
                                router.refresh();
                            }}
                            className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 transition uppercase tracking-widest pt-2"
                        >
                            View in Knowledge Nucleus
                            <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
}
