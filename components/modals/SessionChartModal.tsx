import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { Session } from '../../types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { interpolateRpeData, RpeChartDataPoint } from '../liveSessionUtils';

interface SessionChartModalProps {
    session: Session;
    isOpen: boolean;
    onClose: () => void;
    accentColor: string;
    accentAltColor: string;
    isDarkMode?: boolean;
}

/**
 * Modal for viewing historical session power & RPE charts
 */
const SessionChartModal: React.FC<SessionChartModalProps> = ({
    session,
    isOpen,
    onClose,
    accentColor,
    accentAltColor,
    isDarkMode = false,
}) => {
    // Generate chart data from stored session chartData
    const chartData = useMemo(() => {
        if (!session.chartData) return null;

        const { powerHistory, rpeHistory, targetRPE, initialTargetPower } = session.chartData;

        // Power data
        const powerData = powerHistory.map(p => ({
            time: Math.round(p.timeSeconds / 60 * 10) / 10,
            power: p.power,
        }));

        // Calculate session duration
        const durationSeconds = session.duration * 60;

        // Interpolate RPE data
        const rpeData = interpolateRpeData(rpeHistory, durationSeconds, targetRPE);

        return {
            powerData,
            rpeData,
            targetRpe: targetRPE,
            targetPower: initialTargetPower,
        };
    }, [session]);

    if (!isOpen || !chartData) return null;

    const { powerData, rpeData, targetRpe, targetPower } = chartData;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
            <div
                className={`w-full max-w-lg mx-4 rounded-2xl p-6 ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                            Session Chart
                        </h2>
                        <p className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            {session.date} • {session.duration}min • {session.power}W avg
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`}
                    >
                        <X size={20} className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'} />
                    </button>
                </div>

                {/* Chart */}
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart margin={{ top: 5, right: rpeData.length > 0 ? 30 : 10, left: 10, bottom: 5 }}>
                            <XAxis
                                dataKey="time"
                                type="number"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 10 }}
                                tickFormatter={(v) => `${v}m`}
                                domain={['dataMin', 'dataMax']}
                                allowDuplicatedCategory={false}
                            />
                            <YAxis
                                yAxisId="power"
                                orientation="left"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 9 }}
                                tickFormatter={(v) => `${v}W`}
                                width={35}
                            />
                            {rpeData.length > 0 && (
                                <YAxis
                                    yAxisId="rpe"
                                    orientation="right"
                                    domain={[1, 10]}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: `${accentAltColor}99`, fontSize: 9 }}
                                    tickFormatter={(v) => `${v}`}
                                    width={20}
                                    ticks={[1, 5, 10]}
                                />
                            )}
                            {/* Target power reference line */}
                            <ReferenceLine
                                yAxisId="power"
                                y={targetPower}
                                stroke={isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}
                                strokeWidth={1}
                                strokeDasharray="4 4"
                            />
                            {/* Target RPE reference line */}
                            {rpeData.length > 0 && (
                                <ReferenceLine
                                    yAxisId="rpe"
                                    y={targetRpe}
                                    stroke={`${accentAltColor}66`}
                                    strokeWidth={1}
                                    strokeDasharray="4 4"
                                />
                            )}
                            {/* Power line */}
                            <Line
                                yAxisId="power"
                                data={powerData}
                                type="stepAfter"
                                dataKey="power"
                                stroke={accentColor}
                                strokeWidth={2}
                                dot={false}
                                name="Power"
                            />
                            {/* RPE line */}
                            {rpeData.length > 0 && (
                                <Line
                                    yAxisId="rpe"
                                    data={rpeData}
                                    type="monotone"
                                    dataKey="rpe"
                                    stroke={accentAltColor}
                                    strokeWidth={2}
                                    dot={false}
                                    name="RPE"
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className={`flex justify-center gap-4 mt-4 text-[10px] ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    <span className="flex items-center gap-1">
                        <span className="w-4 h-0.5" style={{ backgroundColor: accentColor }}></span>
                        Power
                    </span>
                    {rpeData.length > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-0.5" style={{ backgroundColor: accentAltColor }}></span>
                            RPE
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SessionChartModal;
