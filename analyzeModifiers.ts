/**
 * PROPER Modifier Trigger Analysis
 * 
 * Focus on REAL contradictions:
 * - Same week detected as different phases (ascending vs descending)
 * - Same week detected as different positions (early vs late)
 */

import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('analysis_deterministic.json', 'utf8'));

console.log('='.repeat(80));
console.log('PROPER PHASE CONTRADICTION ANALYSIS');
console.log('='.repeat(80));

interface Contradiction {
    program: string;
    week: number;
    type: string;
    modifiers: string[];
}

const phaseContradictions: Contradiction[] = [];
const positionContradictions: Contradiction[] = [];

for (const program of data) {
    for (const week of program.weeklyStats) {
        const messages = Object.keys(week.modifierTriggerCounts);
        const counts = week.modifierTriggerCounts;

        // 1. Check for PHASE contradictions: ascending vs descending, peak vs trough
        const ascendingMods = messages.filter(m =>
            m.includes('ascending') && !m.includes('early') && !m.includes('late'));
        const descendingMods = messages.filter(m => m.includes('descending'));
        const peakMods = messages.filter(m => m.includes('peak'));
        const troughMods = messages.filter(m => m.includes('trough') || m.includes('recovery'));

        if (ascendingMods.length > 0 && descendingMods.length > 0) {
            phaseContradictions.push({
                program: program.programConfig.name,
                week: week.weekNumber,
                type: 'ascending + descending',
                modifiers: [...ascendingMods.slice(0, 2), ...descendingMods.slice(0, 2)]
            });
        }

        if (peakMods.length > 0 && troughMods.length > 0) {
            phaseContradictions.push({
                program: program.programConfig.name,
                week: week.weekNumber,
                type: 'peak + trough',
                modifiers: [...peakMods.slice(0, 2), ...troughMods.slice(0, 2)]
            });
        }

        // 2. Check for POSITION contradictions: early vs late in same phase
        const earlyMods = messages.filter(m => m.includes('early ascending') || m.includes('Early ascending'));
        const lateMods = messages.filter(m => m.includes('late ascending') || m.includes('Late ascending'));

        if (earlyMods.length > 0 && lateMods.length > 0) {
            positionContradictions.push({
                program: program.programConfig.name,
                week: week.weekNumber,
                type: 'early + late ascending',
                modifiers: [...earlyMods.slice(0, 2), ...lateMods.slice(0, 2)]
            });
        }
    }
}

console.log('\n## PHASE CONTRADICTIONS (ascending vs descending, peak vs trough)\n');
if (phaseContradictions.length === 0) {
    console.log('✅ No phase contradictions found!');
} else {
    console.log(`🔴 Found ${phaseContradictions.length} phase contradictions:\n`);
    const byType = new Map<string, Contradiction[]>();
    for (const c of phaseContradictions) {
        const key = c.type;
        if (!byType.has(key)) byType.set(key, []);
        byType.get(key)!.push(c);
    }
    for (const [type, items] of byType) {
        console.log(`\n### ${type.toUpperCase()} (${items.length} cases)\n`);
        items.slice(0, 5).forEach(c => {
            console.log(`  ${c.program} Week ${c.week}:`);
            c.modifiers.forEach(m => console.log(`    - ${m.substring(0, 60)}`));
        });
        if (items.length > 5) console.log(`  ... and ${items.length - 5} more`);
    }
}

console.log('\n\n## POSITION CONTRADICTIONS (early vs late in same week)\n');
if (positionContradictions.length === 0) {
    console.log('✅ No position contradictions found!');
} else {
    console.log(`🔴 Found ${positionContradictions.length} position contradictions:\n`);
    positionContradictions.slice(0, 10).forEach(c => {
        console.log(`  ${c.program} Week ${c.week}:`);
        c.modifiers.forEach(m => console.log(`    - ${m.substring(0, 60)}`));
    });
    if (positionContradictions.length > 10) {
        console.log(`  ... and ${positionContradictions.length - 10} more`);
    }
}

// 3. Check detected phase counts per week for consistency
console.log('\n\n## PHASE DETECTION DISTRIBUTION (detectedPhaseCounts)\n');
console.log('Weeks where multiple phases were detected across iterations:\n');

let multiPhaseWeeks = 0;
let dominantPhaseIssues = 0;

for (const program of data) {
    for (const week of program.weeklyStats) {
        const phases = week.detectedPhaseCounts;
        const entries = Object.entries(phases);
        if (entries.length > 1) {
            multiPhaseWeeks++;
            const total = entries.reduce((s, [, c]) => s + (c as number), 0);
            const dominant = entries.reduce((a, b) => (b[1] as number) > (a[1] as number) ? b : a);
            const dominantPct = ((dominant[1] as number) / total * 100);

            // Flag if no clear dominant phase (< 70%)
            if (dominantPct < 70) {
                dominantPhaseIssues++;
                if (dominantPhaseIssues <= 10) {
                    console.log(`  ${program.programConfig.name} W${week.weekNumber} (${week.phaseName}):`);
                    console.log(`    Phases: ${JSON.stringify(phases)}`);
                    console.log(`    Dominant: ${dominant[0]} at ${dominantPct.toFixed(0)}% - UNCLEAR`);
                }
            }
        }
    }
}

console.log(`\nTotal weeks with multi-phase detection: ${multiPhaseWeeks}`);
console.log(`Weeks with unclear dominant phase (<70%): ${dominantPhaseIssues}`);

console.log('\n\nAnalysis complete.');

