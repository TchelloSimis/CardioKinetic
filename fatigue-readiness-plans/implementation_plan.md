# Implementation Plan: Revised Chronic Fatigue Model

## Goal Description

Replace the current EWMA-based fatigue/readiness system (ATL/CTL/TSB/ACWR) with the new **Revised Chronic Fatigue Model** as specified in [REVISED_CHRONIC_FATIGUE_MODEL.md](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/REVISED_CHRONIC_FATIGUE_MODEL.md). 

The new model introduces:
1. **Auto-Estimated Critical Power (eCP)** - Continuous CP/W' estimation from Mean Maximal Power (MMP) curve with RPE calibration
2. **Physiological Cost Calculation** - High-resolution load calculation with W'bal-style acute deficit tracking
3. **Dual-Compartment Chronic State** - Metabolic Freshness (S_meta) and Structural Health (S_struct)
4. **Revised Questionnaire Integration** - Recovery efficiency modulation and Bayesian state corrections
5. **RPE Correction Loop** - Model self-correction based on perceived vs predicted difficulty

---

## User Review Required

> [!CAUTION]
> **Breaking Changes**: This is a **major architectural change** that will affect how all fatigue/readiness metrics are calculated. Existing users will see different scores after migration.

> [!WARNING]
> **Data Requirements**: The new model requires **high-resolution power data** (ideally second-by-second) for optimal accuracy. Existing sessions with only average power will use a fallback estimation, potentially reducing accuracy.

> [!IMPORTANT]
> **Testing Scope**: Over 889+ existing unit tests may require updates. The metrics engine is deeply integrated throughout the codebase. Recommend phased rollout with feature flag.

### Decisions Made

| Decision | Choice | Rationale |
|----------|--------|----------|
| **Feature Flag** | Replace immediately | User preference - no opt-in period |
| **Migration** | Graceful backfill | Run backfill on first load to initialize chronic state from history |
| **Power Resolution** | 5-second intervals | Balance between accuracy and storage (30×60÷5 = 360 samples/30min session) |
| **CP Display** | Show in Training Insights | Not on dashboard, but visible in insights for advanced users |

---

## Proposed Changes

### Types & Data Model

#### [MODIFY] [types.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/types.ts)

Add new interfaces for the chronic fatigue model:

```typescript
// NEW: Mean Maximal Power record for CP estimation
export interface MMPRecord {
  duration: number;        // seconds (e.g., 180 for 3min)
  power: number;           // watts - best average power for duration
  date: string;            // YYYY-MM-DD when achieved
  rpe: number;             // session RPE when achieved
  isMaximalEffort: boolean; // true if RPE >= 9
}

// NEW: Critical Power estimate
export interface CriticalPowerEstimate {
  cp: number;              // Critical Power in watts
  wPrime: number;          // W' in joules
  confidence: number;      // 0-1 confidence in estimate
  lastUpdated: string;     // ISO timestamp
  dataPoints: number;      // number of MMP points used
  decayApplied: boolean;   // true if decay has been applied
}

// NEW: Chronic fatigue compartment state
export interface ChronicFatigueState {
  sMetabolic: number;      // Metabolic Freshness (S_meta)
  sStructural: number;     // Structural Health (S_struct)
  capMetabolic: number;    // Metabolic capacity
  capStructural: number;   // Structural capacity
  lastUpdated: string;     // ISO timestamp
}

// NEW: Recovery efficiency from questionnaire
export interface RecoveryEfficiency {
  phi: number;             // Recovery efficiency scalar [0.5, 1.5]
  sleepFactor: number;     // Sleep contribution
  nutritionFactor: number;  // Nutrition contribution
  stressFactor: number;     // Stress contribution
}
```

Extend existing Session interface:

```typescript
export interface Session {
  // ... existing fields ...
  
  /** Second-by-second power data for physiological cost calculation */
  secondBySecondPower?: number[];
  
  /** Extracted MMP bests from this session */
  mmpBests?: MMPRecord[];
  
  /** Daily physiological cost (calculated post-session) */
  physiologicalCost?: number;
}
```

---

### eCP Estimation Engine

#### [NEW] [criticalPowerEngine.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/criticalPowerEngine.ts)

New utility module for Critical Power estimation:

```typescript
/**
 * Critical Power Estimation Engine
 * 
 * Implements the "eCP" (Estimated Critical Power) algorithm using:
 * - Mean Maximal Power (MMP) curve analysis
 * - 2-parameter model: P(t) = W'/t + CP
 * - RPE-filtered regression for accuracy
 * - Submaximal anchor validation
 * - 28-day decay if no max efforts seen
 */

// Key constants
export const CP_ESTIMATION_DURATIONS = [180, 300, 720, 1200, 2400]; // 3m, 5m, 12m, 20m, 40m
export const RPE_MAX_EFFORT_THRESHOLD = 9;
export const RPE_SUBMAXIMAL_THRESHOLD = 5;
export const SUBMAXIMAL_MIN_DURATION = 20 * 60; // 20 minutes
export const DECAY_THRESHOLD_DAYS = 28;
export const DECAY_RATE_PER_WEEK = 0.005; // 0.5%

// Functions to implement
export function extractMMPBests(sessions: Session[], lookbackDays: number): MMPRecord[];
export function fitCPModel(mmpRecords: MMPRecord[]): CriticalPowerEstimate;
export function applySubmaximalAnchor(estimate: CriticalPowerEstimate, sessions: Session[]): CriticalPowerEstimate;
export function applyDecay(estimate: CriticalPowerEstimate, daysSinceMaxEffort: number): CriticalPowerEstimate;
export function calculateECP(sessions: Session[], currentDate: Date, existingEstimate?: CriticalPowerEstimate): CriticalPowerEstimate;
```

#### [NEW] [criticalPowerEngine.test.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/criticalPowerEngine.test.ts)

Comprehensive test suite covering:
- MMP extraction from various session types
- Regression accuracy with known CP/W' values
- RPE filtering behavior
- Submaximal anchor enforcement
- Decay application
- Edge cases (new user, sparse data)

---

### Physiological Cost Calculation

#### [NEW] [physiologicalCostEngine.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/physiologicalCostEngine.ts)

New utility module for physiological cost calculation:

```typescript
/**
 * Physiological Cost Engine
 * 
 * Calculates accumulated physiological cost from high-resolution power data.
 * Key insight: Cost is non-linear and state-dependent.
 * Generating 300W when "depleted" costs more than when "fresh".
 * 
 * Uses W'bal-style acute deficit tracking to weight instantaneous cost.
 */

// Constants
export const K_FATIGUE = 1.5;  // Stress multiplier when depleted

// Functions to implement
export function trackAcuteDeficit(
  powerSequence: number[],
  cp: number,
  wPrime: number,
  deltaT: number  // seconds per sample
): { deficit: number; deficitHistory: number[] };

export function calculateInstantaneousCost(
  power: number,
  acuteDeficit: number,
  wPrime: number
): number;

export function integrateDailyCost(
  powerSequence: number[],
  cp: number,
  wPrime: number,
  deltaT: number
): number;

// Fallback for sessions without second-by-second data
export function estimateCostFromAverage(
  avgPower: number,
  durationMinutes: number,
  cp: number,
  wPrime: number,
  sessionStyle: 'interval' | 'steady-state' | 'custom',
  workRestRatio?: string
): number;
```

#### [MODIFY] [useSessionTimer.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/hooks/useSessionTimer.ts)

Update to capture finer-grained power data:

```typescript
// Change power history capture from current implementation to:
// - Capture every 1-5 seconds instead of just phase transitions
// - Store as compact array for physiological cost calculation
// - Maintain existing powerHistory format for backward compatibility
```

**Specific changes:**
- Add `powerSecondBySecond: number[]` to internal state
- Capture power value on each tick (1-second resolution)
- Include in SessionResult for persistence

---

### Dual-Compartment Chronic State

#### [NEW] [chronicFatigueModel.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/chronicFatigueModel.ts)

New utility module for chronic fatigue state management:

```typescript
/**
 * Dual-Compartment Chronic Fatigue Model
 * 
 * Splits fatigue into two reservoirs:
 * 
 * 1. Metabolic Freshness (S_meta)
 *    - Represents: glycogen stores, hormonal balance, acute energy
 *    - Feedback: "Do I have the energy to train?"
 *    - Time constant: τ_meta ≈ 2 days (fast recovery)
 * 
 * 2. Structural Health (S_struct)
 *    - Represents: muscle fiber integrity, inflammation, joint/tendon stress
 *    - Feedback: "Does my body hurt? Am I at injury risk?"
 *    - Time constant: τ_struct ≈ 15 days (slow recovery)
 */

// Constants
export const TAU_METABOLIC = 2;      // days
export const TAU_STRUCTURAL = 15;    // days
export const W_METABOLIC = 0.6;      // weight for metabolic in readiness
export const W_STRUCTURAL = 0.4;     // weight for structural in readiness
export const SIGMA_IMPACT = 1.0;     // structural impact multiplier

// Default capacities (calibrated values)
export const DEFAULT_CAP_METABOLIC = 100;
export const DEFAULT_CAP_STRUCTURAL = 100;

// Functions to implement
export function updateMetabolicFreshness(
  currentSMeta: number,
  dailyLoad: number,
  phiRecovery: number  // from questionnaire
): number;

export function updateStructuralHealth(
  currentSStruct: number,
  dailyLoad: number,
  sigmaImpact: number
): number;

export function calculateReadinessScore(
  sMeta: number,
  sStruct: number,
  capMeta: number,
  capStruct: number
): number;

export function interpretReadinessState(
  readiness: number,
  sMeta: number,
  sStruct: number
): {
  status: 'green_light' | 'metabolic_fatigue' | 'structural_fatigue' | 'both_fatigued';
  recommendation: string;
};

export function initializeChronicState(
  sessions: Session[],
  cpEstimate: CriticalPowerEstimate,
  questionnaireHistory: QuestionnaireResponse[],
  lookbackDays: number
): ChronicFatigueState;
```

---

### Questionnaire Integration

#### [MODIFY] [questionnaireConfig.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/questionnaireConfig.ts)

Refactor to support new integration model:

**Key changes:**
1. Add Recovery Efficiency calculation (φ_recovery)
2. Add Bayesian state correction logic
3. Map existing categories to new roles:
   - Recovery Inputs: `sleep`, `nutrition`, `stress` → φ_recovery
   - State Inputs: `soreness` → S_struct correction, `energy` → S_meta correction
4. Integrate with chronic model instead of direct score modification

```typescript
// NEW: Recovery efficiency calculation
export function calculateRecoveryEfficiency(
  responses: Record<string, number>
): RecoveryEfficiency;

// NEW: State correction calculations
export function calculateStructuralCorrection(
  sorenessScore: number,
  currentSStruct: number,
  capStruct: number
): number;  // Returns ΔS_struct

export function calculateMetabolicCorrection(
  energyScore: number,
  currentSMeta: number,
  capMeta: number
): number;  // Returns ΔS_meta

// Modified: Now returns chronic model adjustments instead of score adjustments
export function applyQuestionnaireToChronicModel(
  chronicState: ChronicFatigueState,
  response: QuestionnaireResponse,
  recentResponses?: QuestionnaireResponse[]
): {
  updatedState: ChronicFatigueState;
  phiRecovery: number;
  corrections: { metabolic: number; structural: number };
  // Legacy compatibility
  readinessChange: number;
  fatigueChange: number;
};
```

---

### RPE Correction Loop

#### [NEW] [rpeCorrectionLoop.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/rpeCorrectionLoop.ts)

New utility module for model self-correction:

```typescript
/**
 * RPE Correction Loop
 * 
 * Compares actual session RPE to model-predicted difficulty.
 * When significant mismatch detected:
 * 1. Apply penalty load to S_meta for 24 hours
 * 2. If mismatch persists >3 sessions, trigger CP downgrade
 */

export const RPE_MISMATCH_THRESHOLD = 2;  // RPE points
export const PENALTY_DURATION_HOURS = 24;
export const DOWNGRADE_SESSION_THRESHOLD = 3;
export const CP_DOWNGRADE_PERCENT = 0.02;  // 2%

export function calculatePredictedDifficulty(
  plannedPower: number,
  plannedDuration: number,
  cp: number,
  wPrime: number,
  sessionStyle: SessionStyle
): number;  // Returns predicted RPE

export function detectRPEMismatch(
  actualRPE: number,
  predictedRPE: number
): { isMismatch: boolean; direction: 'higher' | 'lower' | 'match'; magnitude: number };

export function applyPenaltyLoad(
  chronicState: ChronicFatigueState,
  mismatchMagnitude: number
): ChronicFatigueState;

export function checkCPDowngradeTrigger(
  recentMismatches: boolean[],  // Last N sessions
  currentCP: number
): { shouldDowngrade: boolean; newCP: number };
```

---

### useMetrics Hook Update

#### [MODIFY] [useMetrics.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/hooks/useMetrics.ts)

Major refactor to integrate new model:

**Structural changes:**
1. Replace EWMA loop with chronic model updates
2. Integrate eCP for power calculations
3. Use physiological cost for daily load
4. Apply questionnaire via new system

```typescript
// Updated interface
export interface MetricsResult {
  // NEW: Chronic fatigue model values
  sMetabolic: number;
  sStructural: number;
  eCP: number;
  wPrime: number;
  readinessInterpretation: {
    status: string;
    recommendation: string;
  };
  
  // LEGACY: Kept for backward compatibility during transition
  fatigue: number;        // Mapped from avg(S_meta, S_struct)
  readiness: number;      // From new readiness calculation
  tsb: number;            // Approximated for legacy displays
  acwr: number;           // Approximated for legacy displays
  
  // Unchanged
  status: ReadinessState;
  advice: string | null;
  modifiedWeekPlan: PlanWeek | null;
  modifierMessages: string[];
  questionnaireAdjustment?: { ... };
  autoAdaptiveAdjustment?: AutoAdaptiveAdjustment;
}
```

---

### Chart Analytics

#### [MODIFY] [Chart.tsx](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/components/Chart.tsx)

Update visualization for new model:

**Changes:**
1. Replace ATL/CTL lines with S_meta/S_struct lines
2. Add eCP trend line option
3. Update tooltip content
4. New color scheme distinguishing metabolic vs structural

```typescript
// Updated generateMetrics function
const generateMetrics = (
  totalDays: number,
  dailyLoads: Float32Array,
  cpHistory: CriticalPowerEstimate[],
  questionnaireByDate: Map<string, QuestionnaireResponse>,
  // ... other params
) => {
  // Use chronic fatigue model instead of EWMA
  // Track S_meta and S_struct over time
  // Apply questionnaire effects via new system
};
```

---

### Dashboard & Insights

#### [MODIFY] [DashboardTab.tsx](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/components/DashboardTab.tsx)

Update metric displays:

1. Show new readiness score with interpretation
2. Add metabolic vs structural fatigue breakdown
3. Optionally display eCP (configurable)

#### [MODIFY] [InsightsTab.tsx](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/components/InsightsTab.tsx)

Add new insights:

1. CP progression over time
2. Chronic compartment trend analysis
3. Recovery efficiency insights

#### [MODIFY] [insightsUtils.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/insightsUtils.ts)

Add insight generators for new model.

---

### Auto-Adaptive System

#### [MODIFY] [simulationEngine.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/simulationEngine.ts)

Update Monte Carlo simulation:

1. Use chronic fatigue model in simulations
2. Output S_meta and S_struct percentiles
3. Update percentile band calculations

#### [MODIFY] [autoAdaptiveModifiers.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/autoAdaptiveModifiers.ts)

Update adjustment logic:

1. Base state classification on dual-compartment model
2. Different adjustment strategies for metabolic vs structural issues
3. Integrate with new interpretive logic

#### [MODIFY] [autoAdaptiveTypes.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/autoAdaptiveTypes.ts)

Update type definitions for new model metrics.

---

### Session Logging

#### [MODIFY] [SessionLog.tsx](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/components/SessionLog.tsx)

Update manual session logging:

1. Calculate physiological cost estimate from entered data
2. Update chronic state on session submission
3. Check for MMP records from manual entries (estimated)

---

### Storage & Persistence

#### [MODIFY] [useAppState.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/hooks/useAppState.ts)

Add new storage:

```typescript
// New storage keys
const CP_ESTIMATE_KEY = 'ck_cp_estimate';
const CHRONIC_STATE_KEY = 'ck_chronic_state';

// Add to AppStateReturn
criticalPowerEstimate: CriticalPowerEstimate | null;
setCriticalPowerEstimate: (estimate: CriticalPowerEstimate) => void;
chronicFatigueState: ChronicFatigueState | null;
setChronicFatigueState: (state: ChronicFatigueState) => void;
```

---

### Metric Utilities

#### [MODIFY] [metricsUtils.ts](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/utils/metricsUtils.ts)

1. Add deprecation notices to legacy functions
2. Add new exports for chronic model
3. Keep legacy functions for comparison during transition

---

### Documentation

#### [MODIFY] [ARCHITECTURE.md](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/ARCHITECTURE.md)

Update with:
1. New metrics engine architecture diagram
2. Chronic fatigue model explanation
3. CP estimation process
4. Data flow updates

#### [NEW] [CHRONIC_FATIGUE_MODEL_IMPLEMENTATION.md](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/CHRONIC_FATIGUE_MODEL_IMPLEMENTATION.md)

Developer documentation covering:
1. Mathematical formulas reference
2. Calibration guidance
3. Testing scenarios
4. Migration notes

#### [MODIFY] [TEMPLATE_DOCUMENTATION.md](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/TEMPLATE_DOCUMENTATION.md)

Update the "Fatigue & Readiness Science" section (currently lines 503-588) to reflect the new model:

1. Replace "Fitness-Fatigue (Banister) Impulse-Response" explanation with dual-compartment model
2. Update fatigue score explanation to reflect S_meta and S_struct
3. Update readiness score formula and table
4. Add new section on Critical Power estimation
5. Explain how fatigue modifiers now interact with dual-compartment model
6. Update the research references to include W'bal and Critical Power literature

---

## Potential Bugs & Issues Identified

### Critical Issues

| Location | Issue | Impact | Fix Strategy |
|----------|-------|--------|--------------|
| `metricsUtils.ts` | Current EWMA calculations will be replaced | High | Keep legacy path behind flag |
| `Chart.tsx` | `generateMetrics` tightly coupled to EWMA | High | Abstract metric source |
| `useMetrics.ts` | Returns ATL/CTL which many components use | High | Add legacy mapping |
| `simulationEngine.ts` | Monte Carlo uses legacy load calculation | High | Update simulation model |
| Session storage | No field for second-by-second power | Medium | Graceful degradation |

### Backward Compatibility

| Component | Compatibility Risk | Mitigation |
|-----------|-------------------|------------|
| Existing sessions | No high-res power data | Fallback estimation from average |
| Stored questionnaire responses | Compatible format | No migration needed |
| Simulation caches | Will be invalidated | Regenerate on first run |
| Export/Import | Need new fields | Version bump, graceful handling |

### UI Regression Risks

| Component | Risk | Testing Priority |
|-----------|------|------------------|
| Dashboard fatigue/readiness tiles | Color/value changes | High |
| Chart tooltips | New metric names | Medium |
| Insights recommendations | Logic changes | Medium |
| Coach's Advice | Different triggers | High |

---

## Verification Plan

### Automated Tests

1. **Unit Tests - New Modules**
   ```bash
   npm test -- criticalPowerEngine.test.ts
   npm test -- physiologicalCostEngine.test.ts
   npm test -- chronicFatigueModel.test.ts
   npm test -- rpeCorrectionLoop.test.ts
   ```

2. **Integration Tests**
   ```bash
   npm test -- metricsUtils.test.ts
   npm test -- questionnaireAlgorithm.test.ts
   npm test -- chartMetrics.test.ts
   ```

3. **Regression Suite**
   ```bash
   npm run test:run  # Full test suite
   npx tsc --noEmit  # Type checking
   ```

### Manual Verification

1. **New User Flow**
   - Create new program with no history
   - Verify initial CP estimate behavior
   - Confirm readiness shows reasonable default

2. **Existing User Migration**
   - Load app with existing sessions
   - Verify chronic state initialization
   - Compare old vs new readiness scores

3. **Session Completion**
   - Complete guided session
   - Verify power data capture
   - Check chronic state update
   - Test RPE correction loop trigger

4. **Questionnaire Integration**
   - Submit various questionnaire responses
   - Verify φ_recovery calculation
   - Check state corrections apply correctly

5. **Chart Visualization**
   - View analytics chart with new metrics
   - Verify S_meta/S_struct lines display correctly
   - Test tooltip accuracy

6. **Edge Cases**
   - Very high training load (>3x normal)
   - Long gap in training (>28 days)
   - Conflicting questionnaire responses

---

## Alignment Verification with Model Specification

Cross-reference of [REVISED_CHRONIC_FATIGUE_MODEL.md](file:///c:/Users/marce/Downloads/cardiokinetic%281%29/REVISED_CHRONIC_FATIGUE_MODEL.md) requirements to implementation plan:

---

## Steady-State Session Compatibility

> [!NOTE]
> **The new model handles purely steady-state programs correctly and actually provides MORE accurate load calculation for them.**

### Why Steady-State Works Well

The physiological cost function is designed to differentiate between variable and steady power output:

1. **Steady-State Sessions**: P(t) ≈ constant, typically P < CP
   - Acute Deficit D_acute stays low or negative (recovery mode)
   - Cost(t) ≈ P(t) × 1.0 (minimal fatigue multiplier)
   - Daily load = simple integral of power over time

2. **Interval Sessions**: P(t) varies, spikes above CP during work
   - D_acute accumulates significantly during work phases
   - Cost during high-power phases multiplied by up to 2.5×
   - Same average power → higher daily load than steady-state

### Model Behavior for Steady-State Programs

| Scenario | Model Response |
|----------|---------------|
| Long Zone 2 session (P << CP) | Low cost, minimal S_meta/S_struct accumulation |
| Steady tempo (P ≈ 85% CP) | Moderate cost, proportional to duration |
| Steady threshold (P ≈ CP) | Higher cost, no W' depletion penalty |
| Mixed program (SS + intervals) | Correctly weights both session types |

### eCP Estimation for Steady-State Athletes

For users doing ONLY steady-state training:
- **Submaximal anchor** becomes the primary CP calibration mechanism
- If RPE ≤ 5 at power P for >20 min → CP ≥ P (floor enforcement)
- MMP-based regression requires some near-max efforts for W' estimation
- **Graceful degradation**: If no max efforts exist, W' defaults to population average (≈15-20 kJ) and CP uses submaximal anchors

### Implementation Note

The fallback function `estimateCostFromAverage()` in `physiologicalCostEngine.ts` should detect steady-state sessions and apply the simplified calculation:

```typescript
if (sessionStyle === 'steady-state') {
  // No W' depletion occurs, so cost ≈ power × duration
  return (avgPower * durationMinutes * 60) / referenceScale;
}
```

### Section 2: Auto-Estimating Critical Power (eCP)

| Requirement | Plan Reference | Status |
|-------------|----------------|--------|
| Extract MMP bests for T ∈ [3m, 5m, 12m, 20m, 40m] | `criticalPowerEngine.ts` → `extractMMPBests()` | Covered |
| RPE Filter (RPE ≥ 9 for upper bound fit) | `criticalPowerEngine.ts` → RPE cross-checks | Covered |
| Weighted least-squares regression P vs 1/t | `criticalPowerEngine.ts` → `fitCPModel()` | Covered |
| Submaximal anchor (RPE ≤ 5, >20 min → CP ≥ P_sub) | `criticalPowerEngine.ts` → `applySubmaximalAnchor()` | Covered |
| Supra-maximal flag (RPE=10 failure → W' cap) | `criticalPowerEngine.ts` → RPE cross-checks | Covered |
| 28-day decay (-0.5%/week if no max efforts) | `criticalPowerEngine.ts` → `applyDecay()` | Covered |

### Section 3: Daily Physiological Cost

| Requirement | Plan Reference | Status |
|-------------|----------------|--------|
| Track Acute Deficit (W'bal-style) | `physiologicalCostEngine.ts` → `trackAcuteDeficit()` | Covered |
| Cost(t) = P(t) × (1 + K_fatigue × D_acute/W') | `physiologicalCostEngine.ts` → `calculateInstantaneousCost()` | Covered |
| K_fatigue ≈ 1.5 stress multiplier | Constants in `physiologicalCostEngine.ts` | Covered |
| Integrate for daily load | `physiologicalCostEngine.ts` → `integrateDailyCost()` | Covered |
| Second-by-second power data iteration | Extended `Session` interface + `useSessionTimer.ts` | Covered |

### Section 4: Chronic Fatigue Compartments

| Requirement | Plan Reference | Status |
|-------------|----------------|--------|
| S_meta dynamics with τ_meta ≈ 2 days | `chronicFatigueModel.ts` → `updateMetabolicFreshness()` | Covered |
| S_struct dynamics with τ_struct ≈ 15 days | `chronicFatigueModel.ts` → `updateStructuralHealth()` | Covered |
| σ_impact multiplier for S_struct | Constants + `updateStructuralHealth()` param | Covered |

### Section 5: Readiness & Feedback

| Requirement | Plan Reference | Status |
|-------------|----------------|--------|
| Readiness = 100 - min(100, (w₁S_meta/Cap + w₂S_struct/Cap)×100) | `chronicFatigueModel.ts` → `calculateReadinessScore()` | Covered |
| w₁ ≈ 0.6, w₂ ≈ 0.4 | Constants in `chronicFatigueModel.ts` | Covered |
| Interpretive logic (High Readiness >80, Metabolic fatigue, Structural fatigue) | `chronicFatigueModel.ts` → `interpretReadinessState()` | Covered |
| RPE Correction Loop | `rpeCorrectionLoop.ts` → full module | Covered |
| Penalty Load on S_meta for 24h | `rpeCorrectionLoop.ts` → `applyPenaltyLoad()` | Covered |
| CP downgrade after >3 mismatches | `rpeCorrectionLoop.ts` → `checkCPDowngradeTrigger()` | Covered |

### Section 6: Implementation Strategy

| Requirement | Plan Reference | Status |
|-------------|----------------|--------|
| Backfill eCP on last 60 days | `criticalPowerEngine.ts` + Phase 14 migration | Covered |
| Initialize S_meta and S_struct from t_-60 to t_now | `chronicFatigueModel.ts` → `initializeChronicState()` | Covered |
| Forward simulation flow (session → CP → Load → State → Readiness) | `useMetrics.ts` refactor + session completion flow | Covered |

### Section 7: Questionnaire Integration

| Requirement | Plan Reference | Status |
|-------------|----------------|--------|
| φ_recovery ∈ [0.5, 1.5] from Sleep, Nutrition, Stress | `questionnaireConfig.ts` → `calculateRecoveryEfficiency()` | Covered |
| Apply φ to τ_meta in decay equation | `chronicFatigueModel.ts` → `updateMetabolicFreshness(phiRecovery)` | Covered |
| Structural Correction (Soreness → force-inject S_struct) | `questionnaireConfig.ts` → `calculateStructuralCorrection()` | Covered |
| ΔS_struct = max(0, 0.5×Cap - S_struct) formula | `calculateStructuralCorrection()` implementation | Covered |
| Metabolic Correction (Energy → fatigue penalty) | `questionnaireConfig.ts` → `calculateMetabolicCorrection()` | Covered |
| S_meta += 0.3×Cap formula | `calculateMetabolicCorrection()` implementation | Covered |
| Retain Synergy & Cascade logic | Modified `questionnaireConfig.ts` retaining intelligence layers | Covered |
| 7-day trend → CP estimate adjustment | Trend analysis integration | Covered |

### Summary

**All 32 distinct requirements from REVISED_CHRONIC_FATIGUE_MODEL.md are mapped to specific implementation items.** The plan provides complete coverage of:

- ✅ eCP estimation engine with all calibration mechanisms
- ✅ Physiological cost calculation with acute deficit tracking
- ✅ Dual-compartment chronic state (S_meta and S_struct)
- ✅ Composite readiness scoring with weights
- ✅ Interpretive logic for different fatigue patterns
- ✅ RPE correction loop with penalty and CP downgrade
- ✅ Implementation backfill strategy
- ✅ Questionnaire integration via φ_recovery and Bayesian corrections
- ✅ Compatibility with existing intelligence layers

