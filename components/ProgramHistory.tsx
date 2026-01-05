import React, { useState, useMemo } from 'react';
import { ProgramRecord, Session } from '../types';
import { ChevronDown, ChevronRight, Calendar, Zap, Pencil, Trash2, Check, X, BarChart2 } from 'lucide-react';
import { getWeekNumber, getMaxProgramWeek, isDateInProgramRangeStr } from '../utils/chartUtils';

interface ProgramHistoryProps {
    programs: ProgramRecord[];
    sessions: Session[];
    onEditSession?: (session: Session) => void;
    onDeleteSession?: (sessionId: string) => void;
    onRenameProgram?: (programId: string, newName: string) => void;
    onDeleteProgram?: (programId: string) => void;
    onViewChart?: (session: Session) => void;
}

interface WeekGroup {
    weekNum: number;
    sessions: Session[];
}

interface ProgramGroup {
    program: ProgramRecord;
    weeks: WeekGroup[];
    totalSessions: number;
}

const ProgramHistory: React.FC<ProgramHistoryProps> = ({
    programs,
    sessions,
    onEditSession,
    onDeleteSession,
    onRenameProgram,
    onDeleteProgram,
    onViewChart
}) => {
    const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
    const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const toggleProgram = (id: string) => {
        if (editingProgramId) return; // Don't toggle while editing
        setExpandedProgramId(expandedProgramId === id ? null : id);
    };

    const toggleWeek = (weekKey: string) => {
        setExpandedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(weekKey)) {
                next.delete(weekKey);
            } else {
                next.add(weekKey);
            }
            return next;
        });
    };

    const startEditing = (program: ProgramRecord, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProgramId(program.id);
        setEditName(program.name);
    };

    const saveEdit = (programId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (editName.trim() && onRenameProgram) {
            onRenameProgram(programId, editName.trim());
        }
        setEditingProgramId(null);
        setEditName('');
    };

    const cancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProgramId(null);
        setEditName('');
    };

    const handleDeleteProgram = (programId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDeleteProgram && window.confirm('Delete this program and all its sessions? This cannot be undone.')) {
            onDeleteProgram(programId);
        }
    };

    const handleEditSession = (session: Session, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEditSession) {
            onEditSession(session);
        }
    };

    const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDeleteSession) {
            onDeleteSession(sessionId);
        }
    };

    const handleViewChart = (session: Session, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onViewChart && session.chartData) {
            onViewChart(session);
        }
    };

    // Group sessions by program, then by week
    const programGroups: ProgramGroup[] = useMemo(() => {
        // Sort programs by start date descending (most recent first)
        const sortedPrograms = [...programs].sort(
            (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );

        return sortedPrograms.map(program => {
            // Get sessions for this program
            const programSessions = sessions.filter(s => {
                if (s.programId) {
                    return s.programId === program.id;
                }
                // Fallback: use string-based date range check (timezone-agnostic)
                return isDateInProgramRangeStr(s.date, program);
            });

            // Group by week number - use actual max week for this program
            const maxWeek = getMaxProgramWeek(program);
            const weekMap = new Map<number, Session[]>();
            programSessions.forEach(session => {
                const weekNum = getWeekNumber(session.date, program.startDate);
                if (weekNum > 0 && weekNum <= maxWeek) {
                    if (!weekMap.has(weekNum)) {
                        weekMap.set(weekNum, []);
                    }
                    weekMap.get(weekNum)!.push(session);
                }
            });

            const weeks: WeekGroup[] = Array.from(weekMap.entries())
                .map(([weekNum, weekSessions]) => ({
                    weekNum,
                    sessions: weekSessions.sort((a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                }))
                .sort((a, b) => b.weekNum - a.weekNum);

            return {
                program,
                weeks,
                totalSessions: programSessions.length
            };
        });
    }, [programs, sessions]);

    if (programGroups.length === 0) {
        return (
            <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">No programs found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-16">
            {programGroups.map(({ program, weeks, totalSessions }) => {
                const isExpanded = expandedProgramId === program.id;
                const isEditing = editingProgramId === program.id;

                return (
                    <div key={program.id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">

                        {/* Program Header */}
                        <div
                            onClick={() => toggleProgram(program.id)}
                            className="flex items-center justify-between p-4 md:p-6 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                                <div
                                    className={`p-2 md:p-3 rounded-xl shrink-0 ${program.status === 'active' ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'}`}
                                    style={program.status === 'active' ? { backgroundColor: 'var(--accent)' } : {}}
                                >
                                    <Calendar size={18} />
                                </div>
                                <div className="text-left min-w-0 flex-1">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="flex-1 min-w-0 px-2 py-1 text-lg font-bold bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500"
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveEdit(program.id, e as any);
                                                    if (e.key === 'Escape') cancelEdit(e as any);
                                                }}
                                            />
                                            <button onClick={e => saveEdit(program.id, e)} className="shrink-0 p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                                                <Check size={18} />
                                            </button>
                                            <button onClick={cancelEdit} className="shrink-0 p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="font-bold text-base md:text-lg text-neutral-900 dark:text-white truncate">{program.name}</h3>
                                            <p className="text-xs md:text-sm text-neutral-500 truncate">
                                                {program.startDate} • {program.status} • {totalSessions} session{totalSessions !== 1 ? 's' : ''}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Always visible action buttons */}
                            {!isEditing && (
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        onClick={e => startEditing(program, e)}
                                        className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                                        title="Rename program"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={e => handleDeleteProgram(program.id, e)}
                                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete program"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    {isExpanded ? <ChevronDown size={20} className="text-neutral-400 ml-1" /> : <ChevronRight size={20} className="text-neutral-400 ml-1" />}
                                </div>
                            )}
                        </div>

                        {/* Program Content (Weeks) */}
                        {isExpanded && (
                            <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-black/20">
                                {weeks.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-neutral-400 italic">
                                        No sessions recorded for this program.
                                    </div>
                                ) : (
                                    weeks.map(({ weekNum, sessions: weekSessions }) => {
                                        const weekKey = `${program.id}-w${weekNum}`;
                                        const isWeekExpanded = expandedWeeks.has(weekKey);
                                        const avgPower = Math.round(
                                            weekSessions.reduce((sum, s) => sum + s.power, 0) / weekSessions.length
                                        );
                                        const avgRpe = (
                                            weekSessions.reduce((sum, s) => sum + s.rpe, 0) / weekSessions.length
                                        ).toFixed(1);

                                        const planWeek = program.plan.find(w => w.week === weekNum);
                                        const phaseName = planWeek?.phaseName || `Week ${weekNum}`;

                                        return (
                                            <div key={weekKey} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                                                <button
                                                    onClick={() => toggleWeek(weekKey)}
                                                    className="w-full flex items-center justify-between p-4 pl-6 md:pl-16 hover:bg-white dark:hover:bg-neutral-900/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 md:gap-4">
                                                        <span className="font-mono text-xs md:text-sm font-bold text-neutral-400 w-14 md:w-16">WEEK {weekNum}</span>
                                                        <div className="flex flex-col items-start">
                                                            <span className="text-sm font-bold text-neutral-900 dark:text-white">{phaseName}</span>
                                                            <span className="text-xs text-neutral-500">{weekSessions.length} session{weekSessions.length !== 1 ? 's' : ''}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 md:gap-4">
                                                        <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-neutral-500">
                                                            <span className="flex items-center gap-1">
                                                                <Zap size={12} />
                                                                {avgPower}W
                                                            </span>
                                                            <span>RPE {avgRpe}</span>
                                                        </div>
                                                        {isWeekExpanded ? <ChevronDown size={16} className="text-neutral-400" /> : <ChevronRight size={16} className="text-neutral-400" />}
                                                    </div>
                                                </button>

                                                {/* Week Content (Sessions) */}
                                                {isWeekExpanded && (
                                                    <div className="bg-white dark:bg-neutral-900 p-3 md:p-4 pl-8 md:pl-20 space-y-2">
                                                        {weekSessions.map(session => (
                                                            <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                                                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 shrink-0"></div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-sm font-mono text-neutral-600 dark:text-neutral-300">{session.date}</span>
                                                                        <div className="flex gap-2 text-xs font-mono">
                                                                            <span className="font-bold text-neutral-900 dark:text-white">{session.power}W</span>
                                                                            <span className="text-neutral-500">RPE {session.rpe}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Always visible session actions */}
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {session.chartData && onViewChart && (
                                                                        <button
                                                                            onClick={e => handleViewChart(session, e)}
                                                                            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                                                                            title="View session chart"
                                                                        >
                                                                            <BarChart2 size={14} />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={e => handleEditSession(session, e)}
                                                                        className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                                                                        title="Edit session"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={e => handleDeleteSession(session.id, e)}
                                                                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                                        title="Delete session"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ProgramHistory;

