# CardioKinetic Program Template Documentation

This guide explains how to create, customize, and share program templates for CardioKinetic.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Template Structure](#template-structure)
3. [Week Configuration](#week-configuration)
4. [Week Definitions](#week-definitions)
5. [Session Types](#session-types)
6. [Block-Based Programs](#block-based-programs)
7. [Fatigue Modifiers](#fatigue-modifiers)
8. [Suggested Modifiers](#suggested-modifiers)
9. [Fatigue & Readiness Science](#fatigue--readiness-science)
10. [Complete Examples](#complete-examples)
11. [Import & Export](#import--export)
12. [Quick Reference](#quick-reference)

---

## Quick Start

Copy this minimal template and modify it:

```json
{
  "templateVersion": "1.0",
  "id": "my-program",
  "name": "My Program",
  "description": "A simple 4-6 week program.",
  
  "weekConfig": {
    "type": "variable",
    "range": { "min": 4, "max": 6, "step": 1 }
  },
  
  "defaultSessionStyle": "interval",
  "progressionMode": "power",
  "defaultSessionDurationMinutes": 15,
  
  "weeks": [
    {
      "position": "first",
      "phaseName": "Foundation",
      "focus": "Volume",
      "description": "Build your base",
      "powerMultiplier": 1.0,
      "workRestRatio": "1:2",
      "targetRPE": 6
    },
    {
      "position": "last",
      "phaseName": "Peak",
      "focus": "Intensity",
      "description": "Maximum output",
      "powerMultiplier": 1.15,
      "workRestRatio": "2:1",
      "targetRPE": 8
    }
  ]
}
```

**Key concepts:**
- Templates are JSON files defining training programs
- `weekConfig` controls program length (fixed or variable)
- `weeks` array defines keyframe weeks; intermediate weeks are interpolated
- Use `"first"`, `"last"`, or percentages like `"50%"` for flexible positioning

---

## Template Structure

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `templateVersion` | `"1.0"` | Schema version |
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `description` | string | Full program description |
| `weekConfig` | object | Week length configuration |
| `defaultSessionStyle` | `"interval"` \| `"steady-state"` \| `"custom"` | Default training style |
| `progressionMode` | `"power"` \| `"duration"` \| `"double"` | How the program progresses |
| `defaultSessionDurationMinutes` | number | Default session length |
| `weeks` | array | Week definitions (empty `[]` for block-based) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `author` | string | Template creator |
| `tags` | string[] | Categorization (e.g., `["hiit", "advanced"]`) |
| `fatigueModifiers` | array | Dynamic training adjustments |
| `structureType` | `"week-based"` \| `"block-based"` | Template structure type |
| `programBlocks` | array | Block definitions (block-based only) |
| `fixedFirstWeek` | object | Fixed first week (block-based only) |
| `fixedLastWeek` | object | Fixed last week (block-based only) |

### Progression Modes

| Mode | Description |
|------|-------------|
| `"power"` | Power increases week-over-week, duration constant |
| `"duration"` | Duration increases week-over-week, power constant |
| `"double"` | Both power and duration progress independently |

---

## Week Configuration

### Fixed-Length Programs

```json
{
  "weekConfig": {
    "type": "fixed",
    "fixed": 8
  }
}
```

### Variable-Length Programs

```json
{
  "weekConfig": {
    "type": "variable",
    "range": { "min": 4, "max": 12, "step": 2 }
  }
}
```

This allows 4, 6, 8, 10, or 12 week programs.

### Custom Duration Lists

Override range with specific options:

```json
{
  "weekConfig": {
    "type": "variable",
    "customDurations": [8, 10, 12, 14]
  }
}
```

---

## Week Definitions

The `weeks` array defines keyframe weeks. For variable-length programs, intermediate weeks are interpolated.

### Position Values

| Value | Meaning |
|-------|---------|
| `1`, `2`, `3`... | Absolute week number |
| `"first"` | Always week 1 |
| `"last"` | Always final week |
| `"50%"` | Halfway through program |
| `"25%"`, `"75%"` | Quarter/three-quarter positions |

> [!TIP]
> Use relative positions for variable-length programs. Absolute positions work best for fixed-length programs.

### Interpolation

Weeks between defined positions are automatically interpolated. Numerical values (`powerMultiplier`, `targetRPE`) blend linearly between keyframes.

**Example:** A template with weeks at `"first"`, `"50%"`, and `"last"`:
- **6-week program**: Weeks 1, 3-4, 6
- **12-week program**: Weeks 1, 6-7, 12

### Week Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `position` | number \| string | Yes | Week position |
| `phaseName` | string | Yes | Phase name (e.g., "Build", "Peak") |
| `focus` | string | Yes | `"Density"` \| `"Intensity"` \| `"Volume"` \| `"Recovery"` |
| `description` | string | Yes | Coach's advice text |
| `powerMultiplier` | number | Yes | Power multiplier (1.0 = 100%) |
| `workRestRatio` | string | Yes | e.g., `"1:2"`, `"2:1"`, `"steady"` |
| `targetRPE` | number | Yes | Target RPE (1-10) |

### Optional Week Fields

| Field | Type | Description |
|-------|------|-------------|
| `sessionStyle` | string | Override default session style |
| `durationMinutes` | number \| string | Override duration (or percentage like `"110%"`) |
| `cycles` | number | Number of work/rest cycles (intervals) |
| `workDurationSeconds` | number | Work duration per cycle |
| `restDurationSeconds` | number | Rest duration per cycle |
| `blocks` | array | Training blocks (custom sessions) |

### Training Focus Values

| Value | Description |
|-------|-------------|
| `"Volume"` | Total work duration, aerobic capacity |
| `"Density"` | Work-to-rest ratio progression |
| `"Intensity"` | Power output, maximum effort |
| `"Recovery"` | Active recovery, adaptation |

---

## Session Types

### Interval Sessions

Alternate between work and rest phases.

**Method 1: Work:Rest Ratio**
```json
{
  "sessionStyle": "interval",
  "durationMinutes": 15,
  "workRestRatio": "2:1"
}
```

**Method 2: Explicit Cycles (Recommended)**
```json
{
  "sessionStyle": "interval",
  "cycles": 10,
  "workDurationSeconds": 40,
  "restDurationSeconds": 20
}
```

Duration is calculated automatically: `(cycles × (work + rest)) / 60` minutes.

### Steady-State Sessions

Continuous effort without rest intervals:

```json
{
  "sessionStyle": "steady-state",
  "durationMinutes": 30,
  "workRestRatio": "steady"
}
```

### Custom Sessions

Combine multiple blocks in a single session:

```json
{
  "sessionStyle": "custom",
  "blocks": [
    {
      "type": "steady-state",
      "durationExpression": 3,
      "powerExpression": 0.6
    },
    {
      "type": "interval",
      "powerExpression": 1.0,
      "cycles": 8,
      "workDurationSeconds": 30,
      "restDurationSeconds": 15
    },
    {
      "type": "steady-state",
      "durationExpression": 2,
      "powerExpression": 0.5
    }
  ]
}
```

#### Block Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"steady-state"` \| `"interval"` | Block type |
| `durationExpression` | number \| string | Duration in minutes (or expression) |
| `powerExpression` | number \| string | Power multiplier (or expression) |
| `cycles` | number | Work/rest cycles (interval only) |
| `workDurationSeconds` | number | Work duration (interval only) |
| `restDurationSeconds` | number | Rest duration (interval only) |

Expressions support: numbers (`5`), percentages (`"80%"`), or formulas (`"duration * 0.25"`).

---

## Block-Based Programs

Block-based programs define reusable training blocks that repeat to fill the program duration.

### When to Use Blocks

- Repeating training cycles (e.g., 4-week build + 2-week deload)
- Power accumulation relative to block boundaries
- Precise control over block chaining

### Structure Setup

```json
{
  "structureType": "block-based",
  "programBlocks": [...],
  "fixedFirstWeek": {...},
  "fixedLastWeek": {...},
  "weeks": []
}
```

> [!IMPORTANT]
> Block-based templates require `weeks: []`. Weeks are generated dynamically from blocks.

### ProgramBlock Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `weekCount` | number | Yes | Weeks in this block |
| `powerReference` | string | Yes | Power calculation mode |
| `powerProgression` | number[] | Yes | Power multiplier per week |
| `followedBy` | string | No | Next block ID |
| `focus` | string | Yes | Training focus |
| `phaseName` | string | Yes | Phase name |
| `description` | string | Yes | Description (supports `{weekInBlock}` placeholder) |
| `workRestRatio` | string | Yes | Work:rest ratio |
| `targetRPE` | number \| number[] | Yes | RPE for all weeks or per-week |
| `weekSessions` | object[] | No | Per-week session customization |

### Power Reference Modes

| Mode | Description |
|------|-------------|
| `"base"` | `multiplier × basePower` (absolute) |
| `"previous"` | `multiplier × previous week's power` |
| `"block_start"` | `multiplier × power before block started` |

### Block Chaining

Use `followedBy` to create repeating cycles:

```json
{
  "programBlocks": [
    {
      "id": "builder",
      "weekCount": 4,
      "followedBy": "deload",
      "powerProgression": [1.1, 1.2, 1.3, 1.4],
      ...
    },
    {
      "id": "deload",
      "weekCount": 2,
      "followedBy": "builder",
      "powerProgression": [0.8, 0.8],
      ...
    }
  ]
}
```

This creates: Builder → Deload → Builder → Deload...

---

## Fatigue Modifiers

Fatigue modifiers automatically adjust training based on athlete state. They create intelligent, responsive programs.

### How Modifiers Work

1. Each session, the app calculates **fatigue** and **readiness** scores
2. Each modifier's **condition** is evaluated
3. If multiple match, only the **highest priority** (lowest number) triggers
4. The matching modifier's **adjustments** are applied

> [!IMPORTANT]
> Only **one** modifier triggers per session—the highest priority matching modifier wins.

### Modifier Structure

```json
{
  "fatigueModifiers": [
    {
      "condition": { "fatigue": ">70", "readiness": "<40", "logic": "and" },
      "adjustments": {
        "powerMultiplier": 0.85,
        "rpeAdjust": -1,
        "restMultiplier": 1.5,
        "message": "High fatigue detected. Reducing intensity."
      },
      "priority": 1
    }
  ]
}
```

### Conditions

#### Flexible Conditions (Recommended)

```json
{
  "condition": {
    "fatigue": ">70",
    "readiness": "<40",
    "logic": "and"
  }
}
```

**Operators:** `>`, `<`, `>=`, `<=`

**Logic:** `"and"` (both must match) or `"or"` (either matches)

#### Preset Conditions

| Condition | Trigger |
|-----------|---------|
| `"low_fatigue"` | Fatigue < 30% |
| `"moderate_fatigue"` | Fatigue 30-60% |
| `"high_fatigue"` | Fatigue 60-80% |
| `"very_high_fatigue"` | Fatigue > 80% |
| `"fresh"` | Readiness > 65% |
| `"recovered"` | Readiness 50-65% |
| `"tired"` | Readiness 35-50% |
| `"overreached"` | Readiness < 35% |

### Adjustments

| Field | Effect |
|-------|--------|
| `powerMultiplier` | Multiply target power (e.g., `0.9` = 90%) |
| `rpeAdjust` | Add/subtract RPE (e.g., `-1`) |
| `restMultiplier` | Multiply rest duration between intervals (e.g., `1.5` = 50% more) |
| `durationMultiplier` | Multiply session duration for steady-state sessions |
| `volumeMultiplier` | Multiply volume (cycles for intervals, duration for steady-state) |
| `message` | Coach's advice message |

#### Session-Type Behavior

Different adjustments affect session types differently:

| Adjustment | Interval Sessions | Steady-State Sessions | Custom Sessions |
|------------|-------------------|----------------------|-----------------|
| `restMultiplier` | Extends rest between work periods | No effect | Affects interval blocks only |
| `durationMultiplier` | No effect | Shortens/extends session | Affects steady-state blocks only |
| `volumeMultiplier` | Adjusts cycle count (rounded) | Adjusts duration directly | Cycles rounded, durations precise |

### Priority System

Lower numbers = higher priority.

| Priority | Use Case |
|----------|----------|
| 0 | Critical safety (overreached) |
| 1-9 | Very high fatigue emergencies |
| 10-19 | High fatigue |
| 20-29 | Moderate fatigue |
| 30-39 | Tired / general fatigue |
| 40+ | Fresh / boost modifiers |

If not specified, priority defaults to `0`. Same-priority modifiers use array order.

### Filter Fields

Restrict when modifiers apply:

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string \| string[] | Training focus (e.g., `"Intensity"`, `["Volume", "Density"]`) |
| `phaseName` | string \| string[] | Phase name (e.g., `"Build Phase"`) |
| `weekPosition` | string \| string[] | Program position |
| `cyclePhase` | string \| string[] | Auto-detected fatigue trajectory phase |
| `sessionType` | string \| string[] | Session type (`"interval"`, `"steady-state"`, `"custom"`) |

> [!NOTE]
> When multiple filters are specified, **all** must match.

#### Week Position Values

| Value | Description |
|-------|-------------|
| `"first"` | First week only |
| `"last"` | Last week only |
| `"early"` | First 33% of program |
| `"mid"` | Middle 33% |
| `"late"` | Last 33% |
| `"50%"` | Exact percentage (±0.5 week) |
| `">50%"` | After 50% |
| `"<33%"` | Before 33% |
| `">5"` | After week 5 |

#### Cycle Phase Values

Cycle phases are auto-detected from fatigue trajectory:

| Value | Description |
|-------|-------------|
| `"ascending"` | Fatigue rising (build phase) |
| `"peak"` | Fatigue at local maximum |
| `"descending"` | Fatigue falling (recovery) |
| `"trough"` | Fatigue at local minimum |

---

## Suggested Modifiers

The **Suggest Modifiers** button in the program editor generates intelligent modifiers using Monte Carlo simulation.

### How It Works

1. **Simulation**: Runs 100,000 randomized program executions
   - Varies session count (2-4 per week)
   - Varies session days randomly
   - Adds ±5% power variance and ±0.5 RPE variance

2. **Analysis**: Calculates per-week percentiles
   - P15, P30, P50, P70, P85 for fatigue and readiness
   - Applies signal smoothing and derivative analysis

3. **Cycle Detection**: Identifies training phases
   - Uses fatigue velocity (rate of change) and acceleration
   - Considers power trajectory from template
   - Respects Recovery focus as forced trough

4. **Modifier Generation**: Creates two-tier modifiers
   - **Standard tier** (P30/P70): Moderate interventions
   - **Extreme tier** (P15/P85): Stronger interventions

### Algorithm Details

**Adaptive Window Sizing:**
```
localWindow = max(2, min(N-1, floor(N × 0.20)))   // ~20% of program
mesoWindow  = max(3, min(N, floor(N × 0.40)))     // ~40% of program
```

**Cycle Phase Classification:**
1. Coach-declared `focus: "Recovery"` → Always `"trough"`
2. Power trajectory (rising/falling) → Primary signal
3. Fatigue velocity/acceleration → Tiebreaker

**Session-Type Awareness:**
The algorithm detects session types in your program and generates appropriate modifiers:
- **Interval sessions**: Uses `restMultiplier` for fatigue recovery
- **Steady-state sessions**: Uses `durationMultiplier` to shorten sessions
- **Custom sessions**: Generates both types as needed

### Generated Modifier Types

1. **Per-cycle-phase modifiers**: Tailored to ascending, peak, descending, trough
2. **Per-phase-name modifiers**: For block-based programs (e.g., "Build Phase")
3. **Combined condition modifiers**: High fatigue + low readiness
4. **Overload protection**: Critical safety nets (priority 1-4)
5. **Session-type specific**: `restMultiplier` for intervals, `durationMultiplier` for steady-state

---

## Fatigue & Readiness Science

CardioKinetic uses evidence-based algorithms grounded in sports science research.

### Training Load Model

Based on the **Fitness-Fatigue (Banister) Impulse-Response** model:
- **Fitness** (CTL): Builds slowly, decays slowly (42-day time constant)
- **Fatigue** (ATL): Builds quickly, decays quickly (7-day time constant)

Performance readiness = balance between fitness and fatigue.

### Key Metrics

| Metric | Full Name | Description |
|--------|-----------|-------------|
| **ATL** | Acute Training Load | 7-day EWMA (short-term fatigue) |
| **CTL** | Chronic Training Load | 42-day EWMA (long-term fitness) |
| **ACWR** | Acute:Chronic Workload Ratio | ATL/CTL (>1.5 = injury risk) |
| **TSB** | Training Stress Balance | CTL - ATL (positive = fresh) |

### Daily Load Calculation

```
Load = RPE^1.5 × Duration^0.75 × PowerRatio^0.5 × 0.3
```

### Fatigue Score (ACWR Sigmoid)

The fatigue score uses **Acute:Chronic Workload Ratio (ACWR)**, a widely researched metric:

**Scientific Basis:**
- **ACWR 0.8-1.3**: Optimal training zone with lowest injury risk
- **ACWR > 1.3**: Elevated injury risk (caution zone)
- **ACWR > 1.5**: Significantly elevated injury risk

The sigmoid function places 50% fatigue at ACWR = 1.15, appropriately in the optimal zone.

**Score Table:**

| ACWR | Score | Interpretation |
|------|-------|----------------|
| < 0.9 | < 20 | Fully Recovered |
| 0.9-1.15 | 20-50 | Functional Fatigue |
| 1.15-1.35 | 50-75 | Elevated Load |
| 1.35-1.5 | 75-85 | Overreaching |
| > 1.5 | > 85 | High Risk |

> [!NOTE]
> New users start with a minimum CTL baseline of 15 to prevent misleading ACWR scores.

### Readiness Score (Asymmetric Gaussian)

The readiness score uses **Training Stress Balance (TSB = CTL - ATL)**, with an **asymmetric** penalty curve:

**Scientific Basis:**
- **TSB +15 to +25**: Peak performance range (optimal for race day)
- **TSB -10 to -30**: Normal training accumulation
- **TSB < -30**: Risk of non-functional overreaching

**Asymmetric Design:**
- **Overtraining side (TSB < 20)**: Steeper penalty—injury risk is serious
- **Detraining side (TSB > 20)**: Gentler penalty—fitness loss is gradual

**Score Table:**

| TSB | Score | Interpretation |
|-----|-------|----------------|
| +20 | **100** | Peak Performance |
| +50 | ~61 | Too Rested (detraining risk) |
| 0 | ~67 | Functional Training State |
| -30 | ~30 | Deep Fatigue (overtraining risk) |

> [!TIP]
> The asymmetric curve recognizes that overtraining is more dangerous than undertraining.

### Initial State

| Metric | Initial Value | Starting Readiness |
|--------|---------------|-------------------|
| ATL | 9 | ~75% |
| CTL | 10 | |

### Research References

1. Gabbett, T.J. (2016). The training—injury prevention paradox. *British Journal of Sports Medicine*.
2. Friel, J. (2009). *The Cyclist's Training Bible*. VeloPress.
3. Banister, E.W. (1991). Modeling elite athletic performance. In *Physiological Testing of the High-Performance Athlete*.
4. Foster, C. (1998). Monitoring training in athletes with reference to overtraining syndrome. *Medicine & Science in Sports & Exercise*.


---

## Complete Examples

### Example 1: Variable-Length HIIT

```json
{
  "templateVersion": "1.0",
  "id": "progressive-hiit",
  "name": "Progressive HIIT",
  "description": "4-8 week HIIT program with density progression.",
  
  "weekConfig": { "type": "variable", "range": { "min": 4, "max": 8, "step": 2 } },
  "defaultSessionStyle": "interval",
  "progressionMode": "power",
  "defaultSessionDurationMinutes": 15,
  
  "weeks": [
    { "position": "first", "phaseName": "Base", "focus": "Volume", "description": "Build capacity", "powerMultiplier": 1.0, "workRestRatio": "1:2", "targetRPE": 6 },
    { "position": "50%", "phaseName": "Build", "focus": "Density", "description": "Increase density", "powerMultiplier": 1.05, "workRestRatio": "1:1", "targetRPE": 7 },
    { "position": "last", "phaseName": "Peak", "focus": "Intensity", "description": "Maximum output", "powerMultiplier": 1.15, "workRestRatio": "2:1", "targetRPE": 8 }
  ],
  
  "fatigueModifiers": [
    { "condition": "overreached", "priority": 0, "adjustments": { "powerMultiplier": 0.75, "volumeMultiplier": 0.5, "message": "Overreaching. Major reduction." } },
    { "condition": "high_fatigue", "phase": "Intensity", "priority": 10, "adjustments": { "powerMultiplier": 0.90, "restMultiplier": 1.3, "message": "High fatigue. Reducing power, extending rest." } },
    { "condition": "fresh", "weekPosition": "late", "priority": 40, "adjustments": { "powerMultiplier": 1.05, "message": "Well recovered. Small boost." } }
  ]
}
```

### Example 2: Block-Based Periodization

```json
{
  "templateVersion": "1.0",
  "id": "builder-deload",
  "name": "Builder/Deload Periodization",
  "description": "4-week builder + 2-week deload cycles.",
  
  "structureType": "block-based",
  "weekConfig": { "type": "variable", "customDurations": [8, 14, 20] },
  "defaultSessionStyle": "interval",
  "progressionMode": "power",
  "defaultSessionDurationMinutes": 15,
  
  "fixedFirstWeek": {
    "position": "first", "phaseName": "Intro", "focus": "Volume",
    "description": "Establish baseline", "powerMultiplier": 1.0,
    "workRestRatio": "1:2", "targetRPE": 5,
    "cycles": 10, "workDurationSeconds": 30, "restDurationSeconds": 60
  },
  
  "fixedLastWeek": {
    "position": "last", "phaseName": "Conclusion", "focus": "Recovery",
    "description": "Final adaptation", "powerMultiplier": 1.0,
    "workRestRatio": "1:2", "targetRPE": 5
  },
  
  "programBlocks": [
    {
      "id": "builder", "name": "Builder", "weekCount": 4,
      "powerReference": "block_start", "powerProgression": [1.1, 1.2, 1.3, 1.4],
      "followedBy": "deload", "focus": "Intensity", "phaseName": "Build Phase",
      "description": "Week {weekInBlock}/4", "workRestRatio": "2:1", "targetRPE": [7, 7, 8, 8]
    },
    {
      "id": "deload", "name": "Deload", "weekCount": 2,
      "powerReference": "block_start", "powerProgression": [0.8, 0.8],
      "followedBy": "builder", "focus": "Recovery", "phaseName": "Deload Phase",
      "description": "Recovery {weekInBlock}/2", "workRestRatio": "1:2", "targetRPE": 5
    }
  ],
  
  "weeks": [],
  
  "fatigueModifiers": [
    { "condition": "overreached", "priority": 0, "adjustments": { "powerMultiplier": 0.70, "message": "Emergency recovery." } },
    { "condition": "high_fatigue", "phaseName": "Build Phase", "priority": 10, "adjustments": { "powerMultiplier": 0.85, "message": "High fatigue during build." } }
  ]
}
```

### Example 3: Custom Session Template

```json
{
  "templateVersion": "1.0",
  "id": "warmup-intervals-cooldown",
  "name": "Structured Session",
  "description": "Warmup, intervals, cooldown in one session.",
  
  "weekConfig": { "type": "fixed", "fixed": 4 },
  "defaultSessionStyle": "custom",
  "progressionMode": "power",
  "defaultSessionDurationMinutes": 20,
  
  "weeks": [
    {
      "position": "first", "phaseName": "Foundation", "focus": "Volume",
      "description": "Learn the structure", "powerMultiplier": 1.0,
      "workRestRatio": "1:1", "targetRPE": 6,
      "blocks": [
        { "type": "steady-state", "durationExpression": 3, "powerExpression": 0.6 },
        { "type": "interval", "powerExpression": 1.0, "cycles": 6, "workDurationSeconds": 30, "restDurationSeconds": 30 },
        { "type": "steady-state", "durationExpression": 2, "powerExpression": 0.5 }
      ]
    },
    {
      "position": "last", "phaseName": "Peak", "focus": "Intensity",
      "description": "Maximum effort", "powerMultiplier": 1.15,
      "workRestRatio": "2:1", "targetRPE": 8,
      "blocks": [
        { "type": "steady-state", "durationExpression": 3, "powerExpression": 0.6 },
        { "type": "interval", "powerExpression": 1.0, "cycles": 10, "workDurationSeconds": 40, "restDurationSeconds": 20 },
        { "type": "steady-state", "durationExpression": 2, "powerExpression": 0.5 }
      ]
    }
  ]
}
```

---

## Import & Export

### Exporting

1. Go to **Settings** tab
2. Click **Export as Template**
3. Save the `.json` file

### Importing

1. Go to **Settings** tab
2. Click **Import Template**
3. Select your `.json` file
4. Review validation results
5. Template appears in your preset list

Templates are plain JSON—share via email, file services, or GitHub.

---

## Quick Reference

### Required Template Fields

| Field | Example |
|-------|---------|
| `templateVersion` | `"1.0"` |
| `id` | `"my-program"` |
| `name` | `"My Program"` |
| `description` | `"Description..."` |
| `weekConfig` | `{ "type": "fixed", "fixed": 8 }` |
| `defaultSessionStyle` | `"interval"` |
| `progressionMode` | `"power"` |
| `defaultSessionDurationMinutes` | `15` |
| `weeks` | `[...]` |

### Required Week Fields

| Field | Example |
|-------|---------|
| `position` | `"first"` \| `"50%"` \| `1` |
| `phaseName` | `"Build"` |
| `focus` | `"Intensity"` |
| `description` | `"Week description"` |
| `powerMultiplier` | `1.0` |
| `workRestRatio` | `"1:2"` |
| `targetRPE` | `7` |

### Common Patterns

```json
// Variable program
"weekConfig": { "type": "variable", "range": { "min": 4, "max": 12, "step": 2 } }

// Fixed program
"weekConfig": { "type": "fixed", "fixed": 8 }

// Explicit intervals
"cycles": 10, "workDurationSeconds": 40, "restDurationSeconds": 20

// Safety modifier
{ "condition": { "fatigue": ">80", "logic": "and" }, "priority": 0, "adjustments": { "powerMultiplier": 0.75 } }

// Filtered modifier
{ "condition": "tired", "weekPosition": "late", "phase": "Intensity", "sessionType": "interval", "adjustments": {...} }
```

### Troubleshooting

| Error | Fix |
|-------|-----|
| `templateVersion: Must be "1.0"` | Set `"templateVersion": "1.0"` |
| `id: Required string field` | Add unique `"id"` |
| `weeks: Must be non-empty array` | Add weeks or use `[]` for block-based |
| `powerMultiplier: Must be positive` | Use values > 0 |

---

*Template Documentation v1.2 — CardioKinetic*
