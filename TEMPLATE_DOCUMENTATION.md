# CardioKinetic Program Template Documentation

This guide explains how to create, customize, and share program templates for CardioKinetic.

## Table of Contents

1. [Overview](#overview)
2. [Template Structure](#template-structure)
3. [Week Configuration](#week-configuration)
4. [Week Definitions](#week-definitions)
5. [Fatigue Modifiers](#fatigue-modifiers)
6. [Examples](#examples)
7. [Importing & Exporting](#importing--exporting)

---

## Overview

Program templates are JSON files that define complete training programs. They support:

- **Variable Length Programs**: Define programs that work at different week counts (e.g., 4-6 weeks)
- **Dynamic Adjustments**: Modify training based on athlete fatigue and readiness
- **Full Customization**: Control every aspect of training phases, intensity, and intervals

### File Format

Templates are saved as `.json` files with the following structure:

```json
{
  "templateVersion": "1.0",
  "id": "unique-id",
  "name": "Program Name",
  "description": "Full description...",
  "weekConfig": { ... },
  "defaultSessionStyle": "interval",
  "progressionMode": "power",
  "defaultSessionDurationMinutes": 15,
  "weeks": [ ... ],
  "fatigueModifiers": [ ... ]
}
```

---

## Template Structure

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `templateVersion` | `"1.0"` | Schema version (always "1.0") |
| `id` | string | Unique identifier for the template |
| `name` | string | Display name shown in the app |
| `description` | string | Full description (supports multiple paragraphs) |
| `weekConfig` | object | Week length configuration |
| `defaultSessionStyle` | `"interval"` \| `"steady-state"` \| `"custom"` | Default training style |
| `progressionMode` | `"power"` \| `"duration"` \| `"double"` | How the program progresses (see below) |
| `defaultSessionDurationMinutes` | number | Default session length |
| `weeks` | array | Week definitions |

### Progression Modes

| Mode | Description |
|------|-------------|
| `"power"` | Power increases week-over-week, duration stays constant |
| `"duration"` | Duration increases week-over-week, power stays constant |
| `"double"` | Both power AND duration progress independently per week (defined in each week definition) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `author` | string | Template creator name |
| `tags` | string[] | Categorization tags |
| `fatigueModifiers` | array | Dynamic modification rules |

---

## Week Configuration

The `weekConfig` object defines how many weeks the program can span.

### Fixed-Length Programs

Use `type: "fixed"` for programs that only work at one specific length:

```json
{
  "weekConfig": {
    "type": "fixed",
    "fixed": 8
  }
}
```

This creates an 8-week program only.

### Variable-Length Programs

Use `type: "variable"` for flexible programs:

```json
{
  "weekConfig": {
    "type": "variable",
    "range": {
      "min": 4,
      "max": 6,
      "step": 1
    }
  }
}
```

This allows 4, 5, or 6 week programs. The user selects their preferred length.

#### Range Examples

| min | max | step | Valid Options |
|-----|-----|------|---------------|
| 4 | 6 | 1 | 4, 5, 6 |
| 8 | 12 | 2 | 8, 10, 12 |
| 6 | 6 | 1 | 6 (effectively fixed) |
| 4 | 12 | 4 | 4, 8, 12 |

### Custom Duration Lists

For more control over which week counts are valid, use `customDurations`:

```json
{
  "weekConfig": {
    "type": "variable",
    "customDurations": [8, 10, 12, 14]
  }
}
```

This overrides `range` and allows only 8, 10, 12, or 14 week programs. This is especially useful for block-based programs where only certain durations fit the block structure properly.

---

## Block-Based Programs

Block-based programs offer an alternative to week-based definitions. Instead of defining individual weeks, you define reusable **blocks** that repeat to fill the program duration.

### When to Use Blocks

Use block-based structure when:
- You want repeating training cycles (e.g., 4-week build + 2-week deload)
- Power should accumulate relative to block boundaries (not just base power)
- You need precise control over how blocks chain together

### Structure Type

Set `structureType: "block-based"` to enable block mode:

```json
{
  "structureType": "block-based",
  "programBlocks": [...],
  "fixedFirstWeek": {...},
  "fixedLastWeek": {...}
}
```

### ProgramBlock Interface

Each block in `programBlocks` has these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (e.g., `"builder"`) |
| `name` | string | Yes | Display name (e.g., `"Builder"`) |
| `weekCount` | number | Yes | Fixed weeks in this block |
| `powerReference` | string | Yes | Power calculation mode (see below) |
| `powerProgression` | number[] | Yes | Multiplier for each week (length = weekCount) |
| `followedBy` | string | No | ID of the next block in chain |
| `focus` | string | Yes | Training focus (`"Intensity"`, `"Volume"`, etc.) |
| `phaseName` | string | Yes | Phase name shown in UI |
| `description` | string | Yes | Week description (can use `{weekInBlock}` placeholder) |
| `workRestRatio` | string | Yes | Work:rest ratio |
| `targetRPE` | number \| number[] | Yes | RPE for all weeks or per-week array |
| `sessionStyle` | string | No | Override session style for this block |
| `blocks` | TemplateBlock[] | No | For custom sessions within the block |

### Power Reference Modes

The `powerReference` field determines what the `powerProgression` multipliers are relative to:

| Mode | Description | Example |
|------|-------------|---------|
| `"base"` | Multiplier × basePower (absolute) | `1.2` = 120% of user's FTP |
| `"previous"` | Multiplier × previous week's power | `1.1` = 10% more than last week |
| `"block_start"` | Multiplier × power from week before block started | `1.2` = 20% above entering power |

#### Power Calculation Example

For a program with basePower = 100W:

```
Week 1 (Fixed First): 100W (powerMultiplier: 1.0 × basePower)
Week 2-5 (Builder, powerReference: "block_start"):
  - Week 2: 100W × 1.1 = 110W (block_start = Week 1 power)
  - Week 3: 100W × 1.2 = 120W
  - Week 4: 100W × 1.3 = 130W
  - Week 5: 100W × 1.4 = 140W
Week 6-7 (Deload, powerReference: "block_start"):
  - Week 6: 140W × 0.8 = 112W (block_start = Week 5 power)
  - Week 7: 140W × 0.8 = 112W
Week 8 (Fixed Last): 100W
```

### Fixed First/Last Weeks

You can define fixed weeks at the start and end that don't follow block logic:

```json
{
  "fixedFirstWeek": {
    "position": "first",
    "phaseName": "Introduction",
    "focus": "Volume",
    "description": "Baseline week",
    "powerMultiplier": 1.0,
    "workRestRatio": "1:2",
    "targetRPE": 5
  },
  "fixedLastWeek": {
    "position": "last",
    "phaseName": "Conclusion",
    "focus": "Recovery",
    "description": "Final adaptation week",
    "powerMultiplier": 1.0,
    "workRestRatio": "1:2",
    "targetRPE": 5
  }
}
```

### Block Chaining

Blocks use `followedBy` to create sequences:

```json
{
  "programBlocks": [
    {
      "id": "builder",
      "followedBy": "deload",
      ...
    },
    {
      "id": "deload",
      "followedBy": "builder",
      ...
    }
  ]
}
```

This creates a cycle: Builder → Deload → Builder → Deload...

### Complete Block-Based Example

```json
{
  "templateVersion": "1.0",
  "id": "builder-deload-blocks",
  "name": "Builder/Deload Periodization",
  "description": "4-week builder blocks followed by 2-week deloads",
  
  "structureType": "block-based",
  
  "weekConfig": {
    "type": "variable",
    "customDurations": [8, 14, 20, 26]
  },
  
  "defaultSessionStyle": "interval",
  "progressionMode": "power",
  "defaultSessionDurationMinutes": 15,
  
  "fixedFirstWeek": {
    "position": "first",
    "phaseName": "Introduction",
    "focus": "Volume",
    "description": "Establish baseline",
    "powerMultiplier": 1.0,
    "workRestRatio": "1:2",
    "targetRPE": 5
  },
  
  "fixedLastWeek": {
    "position": "last",
    "phaseName": "Conclusion",
    "focus": "Recovery",
    "description": "Final adaptation",
    "powerMultiplier": 1.0,
    "workRestRatio": "1:2",
    "targetRPE": 5
  },
  
  "programBlocks": [
    {
      "id": "builder",
      "name": "Builder",
      "weekCount": 4,
      "powerReference": "block_start",
      "powerProgression": [1.1, 1.2, 1.3, 1.4],
      "followedBy": "deload",
      "focus": "Intensity",
      "phaseName": "Build Phase",
      "description": "Progressive overload week {weekInBlock}/4",
      "workRestRatio": "2:1",
      "targetRPE": [7, 7, 8, 8]
    },
    {
      "id": "deload",
      "name": "Deload",
      "weekCount": 2,
      "powerReference": "block_start",
      "powerProgression": [0.8, 0.8],
      "followedBy": "builder",
      "focus": "Recovery",
      "phaseName": "Deload Phase",
      "description": "Recovery week {weekInBlock}/2",
      "workRestRatio": "1:2",
      "targetRPE": 5
    }
  ],
  
  "weeks": [],
  "fatigueModifiers": []
}
```

> [!NOTE]
> Block-based templates require an empty `weeks: []` array. The weeks are generated dynamically from the block definitions.

---

## Week Definitions

The `weeks` array contains objects that define each training week. For variable-length programs, weeks are **interpolated** to fit the selected length.

### Week Position

The `position` field determines where a week appears:

| Value | Meaning |
|-------|---------|
| `1`, `2`, `3`... | Absolute week number |
| `"first"` | Always the first week |
| `"last"` | Always the last week |
| `"50%"` | Halfway through the program |
| `"25%"`, `"75%"` | Quarter/three-quarter point |
| `"33.33%"` | Arbitrary precision percentages |

> [!TIP]
> Percentage positions support arbitrary decimal precision (e.g., `"33.33333%"` or `"66.6666%"`). This is useful for dividing programs into thirds or other precise fractions.

#### Interpolation

When the program length changes, weeks are interpolated between defined positions. Percentages represent "progress through the program" where `0%` equals week 1 and `100%` equals the last week.

**Formula**: `week = 1 + (percentage × (totalWeeks - 1))`

**Example**: A template with weeks at `"0%"`, `"33%"`, and `"66%"`

- **12-week program**: 0% → Week 1, 33% → Week 5, 66% → Week 8
- **9-week program**: 0% → Week 1, 33% → Week 4, 66% → Week 6

Numerical values like `powerMultiplier` and `targetRPE` are linearly interpolated between defined points.

### Week Fields

```json
{
  "position": "first",
  "phaseName": "Foundation",
  "focus": "Volume",
  "description": "Build aerobic base with moderate intensity",
  "powerMultiplier": 1.0,
  "workRestRatio": "1:2",
  "targetRPE": 6
}
```

| Field | Type | Description |
|-------|------|-------------|
| `position` | number \| string | Where this week appears (supports decimal percentages like `"33.33%"`) |
| `phaseName` | string | Phase name (e.g., "Foundation", "Build", "Peak") |
| `focus` | `"Density"` \| `"Intensity"` \| `"Volume"` \| `"Recovery"` | Training focus |
| `description` | string | Description shown in coach's advice |
| `powerMultiplier` | number | Multiplier for basePower (0.1-5.0, where 1.0 = 100%) |
| `workRestRatio` | string | Work-to-rest ratio (see table below) |
| `targetRPE` | number | Target RPE 1-10 |

### Training Focus Values

The `focus` field categorizes the primary training emphasis for each week. This helps the app display contextual coaching advice and allows fatigue modifiers to target specific phases.

| Value | Description | Typical Use |
|-------|-------------|-------------|
| `"Density"` | Emphasis on increasing work-to-rest ratio. Work intervals become longer or rest periods shorter. | Mid-program phases where you're building the capacity to sustain effort with less recovery. |
| `"Intensity"` | Emphasis on power output and maximum effort. Higher power multipliers and RPE targets. | Peak phases where you're pushing for top-end performance. |
| `"Volume"` | Emphasis on total work duration and aerobic capacity. Moderate intensity, longer sessions or more intervals. | Early program phases for building aerobic base, or steady-state endurance weeks. |
| `"Recovery"` | Emphasis on active recovery and adaptation. Lower intensity and reduced volume. | Deload weeks, taper phases, or after high-intensity blocks. |

> [!TIP]
> Use the `focus` field together with fatigue modifiers to create adaptive programs. For example, a modifier can apply extra recovery adjustments only during `"Intensity"` weeks when the athlete is tired.

### Work:Rest Ratio Values

| Value | Meaning | Use Case |
|-------|---------|----------|
| `"1:0"` or `"steady"` | **Steady State** - No rest intervals, continuous effort | Zone 2 endurance, aerobic base building |
| `"1:2"` | 1 part work, 2 parts rest | Recovery intervals, beginners |
| `"1:1"` | Equal work and rest | Standard intervals |
| `"2:1"` | 2 parts work, 1 part rest | High-density HIIT |
| `"1:6"` | 1 part work, 6 parts rest | Sprint intervals (SIT) |

### Optional Week Fields

| Field | Type | Description |
|-------|------|-------------|
| `sessionStyle` | `"interval"` \| `"steady-state"` \| `"custom"` | Override default session style |
| `durationMinutes` | number \| string | Override default duration. Can be absolute (e.g., `30`) or a percentage of the default (e.g., `"110%"` for 10% longer). Range: 5-180 min or 10-500%. |
| `cycles` | number | For interval sessions: number of work/rest cycles. When specified with `workDurationSeconds` and `restDurationSeconds`, duration is calculated automatically. |
| `workDurationSeconds` | number | For interval sessions: work duration per cycle in seconds |
| `restDurationSeconds` | number | For interval sessions: rest duration per cycle in seconds |
| `blocks` | array | For `"custom"` session style: array of training blocks (see below) |

### Custom Sessions (Blocks)

Custom sessions allow interweaving **steady-state** and **interval** training blocks in a single session. When `sessionStyle` is `"custom"`, you can define a `blocks` array.

#### TemplateBlock Structure

```json
{
  "blocks": [
    {
      "type": "steady-state",
      "durationExpression": 5,
      "powerExpression": 0.7
    },
    {
      "type": "interval",
      "durationExpression": 10,
      "powerExpression": 1.0,
      "workRestRatio": "2:1"
    },
    {
      "type": "steady-state",
      "durationExpression": 3,
      "powerExpression": 0.5
    }
  ]
}
```

#### Block Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"steady-state"` \| `"interval"` | Block type |
| `durationExpression` | number \| string | Block duration in minutes (or expression). For interval blocks with `cycles`, this is calculated automatically. |
| `powerExpression` | number \| string | Power multiplier (or expression) |
| `cycles` | number | **For interval blocks:** Number of work/rest cycles. When specified with `workDurationSeconds` and `restDurationSeconds`, duration is calculated automatically. |
| `workDurationSeconds` | number | For interval blocks: work duration per cycle in seconds |
| `restDurationSeconds` | number | For interval blocks: rest duration per cycle in seconds |
| `workRestRatio` | string | Legacy: work:rest ratio (e.g., `"2:1"`). Prefer using explicit `workDurationSeconds` and `restDurationSeconds`. |

> [!TIP]
> For interval blocks, the recommended approach is to specify `cycles`, `workDurationSeconds`, and `restDurationSeconds`. The block duration is then calculated automatically as: `(cycles × (work + rest)) / 60` minutes.

#### Expression Syntax

Both `durationExpression` and `powerExpression` support:

| Format | Example | Meaning |
|--------|---------|---------|
| Number | `5`, `0.8` | Absolute value (minutes or multiplier) |
| Percentage | `"80%"` | Percentage of base value |
| Multiplication | `"power * 0.8"` | Multiply base power by 0.8 |
| | `"duration * 0.25"` | 25% of session duration |

#### Custom Session Example

A warm-up → intervals → cooldown session:

```json
{
  "position": "50%",
  "phaseName": "Build",
  "focus": "Intensity",
  "description": "Mixed session with warm-up and cooldown",
  "sessionStyle": "custom",
  "powerMultiplier": 1.0,
  "workRestRatio": "2:1",
  "targetRPE": 7,
  "blocks": [
    { 
      "type": "steady-state", 
      "durationExpression": 3, 
      "powerExpression": 0.6 
    },
    { 
      "type": "interval", 
      "powerExpression": 1.0, 
      "cycles": 10,
      "workDurationSeconds": 40,
      "restDurationSeconds": 20
    },
    { 
      "type": "steady-state", 
      "durationExpression": 2, 
      "powerExpression": 0.5 
    }
  ]
}
```

In this example:
- **Block 1:** 3-minute steady-state warm-up at 60% power
- **Block 2:** 10 intervals of 40s work / 20s rest (10 min total) at 100% power
- **Block 3:** 2-minute steady-state cooldown at 50% power

> [!TIP]
> The total session duration for custom sessions is calculated from the sum of all block durations. The `durationMinutes` field is ignored when `blocks` is defined.

---

## Fatigue Modifiers

Fatigue modifiers allow your program to **automatically adjust training** based on the athlete's daily fatigue and readiness scores. They create intelligent, responsive programs that adapt to the athlete's current state.

### How Modifiers Work

1. Each session, the app calculates **fatigue** and **readiness** scores
2. Each modifier's **condition** is evaluated against these scores
3. If multiple modifiers match, only the **highest priority** (lowest number) triggers
4. The matching modifier's **adjustments** are applied to the session

### Modifier Structure

```json
{
  "fatigueModifiers": [
    {
      "condition": {
        "fatigue": ">70",
        "readiness": "<40",
        "logic": "and"
      },
      "adjustments": {
        "powerMultiplier": 0.85,
        "rpeAdjust": -1,
        "restMultiplier": 1.5,
        "volumeMultiplier": 0.8,
        "message": "High fatigue detected. Reducing intensity."
      },
      "priority": 1,
      "phase": "Intensity",
      "phaseName": "Build Phase",
      "weekPosition": "late"
    }
  ]
}
```

### Condition Fields

The `condition` object determines **when** the modifier triggers:

| Field | Type | Description |
|-------|------|-------------|
| `fatigue` | string | Fatigue threshold (e.g., `">70"`, `"<30"`, `">=50"`) |
| `readiness` | string | Readiness threshold (e.g., `">65"`, `"<40"`) |
| `logic` | `"and"` \| `"or"` | How to combine fatigue and readiness conditions |

**Threshold Operators:**
- `>` : greater than
- `<` : less than
- `>=` : greater than or equal
- `<=` : less than or equal

**Examples:**
- `"fatigue": ">70"` – Triggers when fatigue is above 70%
- `"readiness": "<40"` – Triggers when readiness is below 40%
- `"logic": "and"` – Both conditions must be true
- `"logic": "or"` – Either condition can be true

### Adjustment Fields

The `adjustments` object defines **what changes** when the modifier triggers:

| Field | Type | Description |
|-------|------|-------------|
| `powerMultiplier` | number | Multiply target power (e.g., `0.9` = 90%) |
| `rpeAdjust` | number | Add/subtract from target RPE (e.g., `-1` = reduce by 1) |
| `restMultiplier` | number | Multiply rest duration (e.g., `1.5` = 50% longer) |
| `volumeMultiplier` | number | Multiply session volume/duration (e.g., `0.8` = 80%) |
| `message` | string | Coach's advice message shown to user |

> [!NOTE]
> For interval sessions, `volumeMultiplier` is applied to the **number of cycles** and rounded to the nearest integer. For steady-state sessions, it's applied to the duration without rounding.

### Optional Filter Fields

These fields restrict **when** the modifier can trigger:

#### Priority

```json
{
  "priority": 1
}
```

Lower number = higher priority. Only **one modifier** triggers per session—the highest priority matching modifier wins.

| Priority | Use Case |
|----------|----------|
| 0-10 | Critical overrides (injury prevention, forced rest) |
| 11-30 | High fatigue responses |
| 31-60 | Moderate adjustments |
| 61-99 | Low-priority tweaks |

#### Phase Filter (WeekFocus)

```json
{
  "phase": "Intensity"
}
```

Only trigger during specific training focus phases.

| Value | Description |
|-------|-------------|
| `"Intensity"` | During intensity-focused weeks |
| `"Volume"` | During volume-focused weeks |
| `"Density"` | During density-focused weeks |
| `"Recovery"` | During recovery weeks |

Can also be an array: `["Intensity", "Density"]`

#### Phase Name Filter

```json
{
  "phaseName": "Build Phase"
}
```

Only trigger during weeks with a specific `phaseName` string. This allows more granular control than `phase`.

- Matches the `phaseName` field from week definitions or block definitions
- Can be a single string or an array: `["Build Phase", "Peak Phase"]`
- The UI shows a warning if the phase name doesn't match any defined in the template

#### Week Position Filter

```json
{
  "weekPosition": "late"
}
```

Only trigger at specific positions in the program timeline.

| Value | Description |
|-------|-------------|
| `"first"` | First week only |
| `"last"` | Last week only |
| `"early"` | First 33% of program |
| `"mid"` | Middle 33% of program |
| `"late"` | Last 33% of program |
| `"50%"` | At 50% through (±1 week) |
| `">50%"` | After 50% of program |
| `"<33%"` | Before 33% of program |
| `">5"` | After week 5 |
| `"<10"` | Before week 10 |

Can also be an array: `["first", "last"]`

### Complete Examples

#### High Fatigue Recovery

```json
{
  "condition": { "fatigue": ">75", "logic": "and" },
  "adjustments": {
    "powerMultiplier": 0.8,
    "rpeAdjust": -2,
    "restMultiplier": 1.5,
    "message": "High fatigue detected. Today's session is reduced."
  },
  "priority": 5
}
```

#### Peak Week Intensity Boost

```json
{
  "condition": { "readiness": ">70", "logic": "and" },
  "adjustments": {
    "powerMultiplier": 1.05,
    "message": "You're fresh! Push a little harder today."
  },
  "priority": 50,
  "phaseName": "Peak Phase",
  "weekPosition": "late"
}
```

#### Overreaching Prevention

```json
{
  "condition": { "fatigue": ">80", "readiness": "<30", "logic": "and" },
  "adjustments": {
    "powerMultiplier": 0.7,
    "volumeMultiplier": 0.6,
    "rpeAdjust": -3,
    "message": "⚠️ Critical fatigue! Mandatory reduced session."
  },
  "priority": 0
}
```

---

## Understanding Fatigue & Readiness Scores

CardioKinetic calculates fatigue and readiness scores using an **Exponentially Weighted Moving Average (EWMA)** model combined with advanced normalization functions based on sports science research.

### The Training Load Model

The underlying model is based on the **Fitness-Fatigue** (or Banister) model, which treats training as having two opposing effects:

1. **Fitness** (positive adaptation) – builds slowly, decays slowly
2. **Fatigue** (negative short-term effect) – builds quickly, decays quickly

Performance readiness is the balance between accumulated fitness and current fatigue.

### Key Metrics

| Metric | Full Name | Description |
|--------|-----------|-------------|
| **ATL** | Acute Training Load | 7-day EWMA of training load. Represents short-term fatigue accumulation. |
| **CTL** | Chronic Training Load | 42-day EWMA of training load. Represents long-term fitness/adaptation. |
| **ACWR** | Acute:Chronic Workload Ratio | `ATL / CTL`. Values >1.5 indicate elevated injury risk. |
| **TSB** | Training Stress Balance | `CTL - ATL`. Positive = fresh/recovered, Negative = fatigued. |

### Daily Load Calculation

Each session's training load is calculated using a non-linear formula that accounts for session duration, perceived effort, and relative intensity:

```
Load = RPE^1.5 × Duration^0.75 × PowerRatio^0.5 × 0.3
```

Where `PowerRatio = Session Power / Recent Average Power` (28-day weighted average).

**Why this formula?**

- **RPE exponent (1.5)**: Higher RPE sessions cause disproportionately more fatigue. An RPE 10 session is approximately **2.8× more demanding** than an RPE 5 session (not just 2×).
- **Duration exponent (0.75)**: Longer sessions have diminishing returns per minute. A 120-minute session is about **22× more load** than a 2-minute session (not 60×).
- **Power ratio exponent (0.5)**: Sessions harder than your recent average add more load; sessions easier than average add less.
- **Scaling factor (0.3)**: Calibrates scores to practical ranges.

### EWMA Smoothing

The app uses exponential smoothing with the following time constants:

| Metric | Time Constant | Smoothing Factor (α) |
|--------|---------------|----------------------|
| ATL | 7 days | `2 / (7 + 1) = 0.25` |
| CTL | 42 days | `2 / (42 + 1) ≈ 0.047` |

The formula applied each day:

```
ATL_today = ATL_yesterday × (1 - α_ATL) + Load_today × α_ATL
CTL_today = CTL_yesterday × (1 - α_CTL) + Load_today × α_CTL
```

### Initial State

When starting a new program or without session history, the model uses neutral seed values:

| Metric | Initial Value | Purpose |
|--------|---------------|---------|
| **ATL** | 9 | Represents baseline acute activity |
| **CTL** | 10 | Prevents divide-by-zero and represents minimal fitness |
| **TSB** | 1 (CTL - ATL) | Near-neutral training balance |
| **Readiness** | ~75% | "Neutral" starting state, neither fresh nor fatigued |

> [!TIP]
> Starting at ~75% readiness (rather than near 100%) represents a realistic neutral state. Athletes typically begin programs with some baseline activity level rather than complete rest. As real training data accumulates, these seed values quickly wash out via the EWMA decay.

### Score Derivation

CardioKinetic uses advanced normalization functions to convert raw metrics into meaningful 0-100 scores:

#### Fatigue Score (ACWR Sigmoid)

The **Fatigue Score** uses the Acute:Chronic Workload Ratio (ACWR) with a Logistic Sigmoid function. This creates high sensitivity around training load variations.

```
Fatigue Score = 100 / (1 + e^(-4.5 × (ACWR - 1.15)))
```

| ACWR Range | Fatigue Score | Interpretation |
|------------|---------------|----------------|
| < 0.9 | < 20 | **Fully Recovered** — Training load is well below chronic capacity |
| 0.9 - 1.15 | 20 - 50 | **Functional Fatigue** — Normal training zone, optimal adaptation |
| 1.15 - 1.35 | 50 - 75 | **Elevated Load** — Monitor recovery, training is above average |
| 1.35 - 1.5 | 75 - 85 | **Overreaching** — Caution advised, consider reducing intensity |
| > 1.5 | > 85 | **High Risk** — Elevated injury risk, taper or rest recommended |


#### Readiness Score (TSB Gaussian)

The **Readiness Score** uses Training Stress Balance (TSB) with a Gaussian distribution centered at the optimal "freshness" point. This creates an inverted-U curve that penalizes both excessive fatigue AND excessive rest (detraining).

```
Readiness Score = 100 × e^(-(TSB - 20)² / 1250)
```

| TSB Value | Readiness Score | Interpretation |
|-----------|-----------------|----------------|
| +20 | **100** | **Peak Performance** — Optimal freshness for competition |
| +50 | ~48 | **Too Rested** — Risk of detraining, may feel "stale" |
| 0 | ~72 | **Good Training State** — Balanced load, sustainable training |
| -30 | ~13 | **Deep Fatigue** — Significant recovery deficit |
| -50 | ~3 | **Overreached** — Extended recovery needed |

> [!IMPORTANT]
> Unlike simpler linear models, the Gaussian readiness curve recognizes that being **too fresh** can be as problematic as being fatigued. Athletes who taper too long may experience detraining effects and reduced performance.

### Practical Implications

- **High Fatigue (>60%)**: ACWR approaching danger zone. Recent training is significantly higher than your chronic capacity. Reduce intensity or volume.
- **Low Readiness (<50%)**: Negative TSB territory. Accumulated fatigue exceeds fitness gains. Prioritize recovery.
- **Peak Readiness (>85%)**: Near the optimal TSB sweet spot. Excellent opportunity for key sessions or competition.
- **Very High Readiness (>95%)**: Check if you're adequately maintaining training load. Extended freshness may indicate detraining.

> [!TIP]
> The fatigue and readiness scores update automatically based on logged sessions. Fatigue modifiers in your templates can use these scores to automatically adjust training prescriptions in real-time.


---

## Fatigue Modifiers

Fatigue modifiers automatically adjust training based on athlete state.

### Conditions

Conditions can be specified in two ways:

#### 1. Flexible Conditions (Recommended)

Define precise thresholds for fatigue and/or readiness with AND/OR logic:

```json
{
  "condition": {
    "fatigue": ">70",
    "readiness": "<40",
    "logic": "or"
  },
  "adjustments": { ... }
}
```

**Threshold Format:**

| Operator | Meaning | Example |
|----------|---------|---------|
| `>` | Greater than | `">70"` = fatigue above 70% |
| `<` | Less than | `"<40"` = readiness below 40% |
| `>=` | Greater than or equal | `">=50"` |
| `<=` | Less than or equal | `"<=30"` |

**Logic Options:**

| Logic | Meaning | Use Case |
|-------|---------|----------|
| `"and"` | Both conditions must be true | High fatigue AND low readiness = very fatigued |
| `"or"` | Either condition triggers | High fatigue OR low readiness = needs attention |

**Examples:**

```json
// Trigger when fatigue is high AND readiness is low
{ "fatigue": ">70", "readiness": "<40", "logic": "and" }

// Trigger when fatigue is very high (regardless of readiness)
{ "fatigue": ">85", "logic": "and" }

// Trigger when fresh (low fatigue OR high readiness)
{ "fatigue": "<30", "readiness": ">60", "logic": "or" }
```

#### 2. Preset Conditions (Legacy)

Quick presets for common scenarios:

| Condition | Trigger |
|-----------|---------|
| `"low_fatigue"` | Fatigue score < 30% |
| `"moderate_fatigue"` | Fatigue score 30-60% |
| `"high_fatigue"` | Fatigue score 60-80% |
| `"very_high_fatigue"` | Fatigue score > 80% |
| `"fresh"` | Readiness > 65% |
| `"recovered"` | Readiness 50-65% |
| `"tired"` | Readiness 35-50% |
| `"overreached"` | Readiness < 35% |

### Adjustments

```json
{
  "condition": { "fatigue": ">80", "logic": "and" },
  "adjustments": {
    "powerMultiplier": 0.85,
    "rpeAdjust": -1,
    "restMultiplier": 1.5,
    "volumeMultiplier": 0.75,
    "message": "High fatigue detected. Reducing intensity."
  }
}
```

| Adjustment | Effect |
|------------|--------|
| `powerMultiplier` | Multiply target power (0.85 = -15%) |
| `rpeAdjust` | Add/subtract target RPE (-1 = easier) |
| `restMultiplier` | Multiply rest duration (1.5 = +50%) |
| `volumeMultiplier` | Multiply session volume (0.75 = -25%). For interval sessions with `cycles`, cycles are rounded to nearest integer and duration is recalculated. For custom sessions: interval block cycles are rounded, steady-state durations keep decimal precision. |
| `message` | Display in Coach's Advice |

### Modifier Priority

> [!IMPORTANT]
> **Only one fatigue modifier can trigger per session.** When multiple modifiers match, the one with the highest priority (lowest `priority` number) is applied.

The `priority` field determines which modifier takes precedence:

```json
{
  "condition": "overreached",
  "priority": 0,
  "adjustments": {
    "powerMultiplier": 0.75,
    "message": "Critical: Major reduction for safety."
  }
}
```

**Priority Rules:**

| Priority Value | Recommended Use |
|----------------|-----------------|
| 0 | Critical safety (overreached) |
| 1-9 | Very high fatigue / compound emergencies |
| 10-19 | High fatigue handling |
| 20-29 | Moderate fatigue handling |
| 30-39 | Tired / general fatigue |
| 40+ | Fresh / low fatigue bonuses |

**Key Points:**

- **Lower number = higher priority** (priority 0 is applied before priority 10)
- **Default is 0** if not specified (maintains backward compatibility)
- If multiple modifiers have the same priority, the **first one in array order** wins
- Safety-critical modifiers should always have the lowest priority numbers

**Example: Prioritized Modifier List**

```json
"fatigueModifiers": [
  {
    "condition": "overreached",
    "priority": 0,
    "adjustments": { "powerMultiplier": 0.75, "message": "🛑 Overreaching! Major reduction." }
  },
  {
    "condition": "very_high_fatigue",
    "priority": 1,
    "adjustments": { "powerMultiplier": 0.85, "message": "⚠️ High fatigue. Reducing intensity." }
  },
  {
    "condition": "tired",
    "priority": 30,
    "adjustments": { "rpeAdjust": -1, "message": "😴 Tired today. Lower effort." }
  },
  {
    "condition": "fresh",
    "priority": 40,
    "adjustments": { "powerMultiplier": 1.05, "message": "✅ Fresh! Small boost." }
  }
]
```

In this example, if an athlete is both "overreached" AND "fresh", only the "overreached" modifier (priority 0) will trigger.


### Phase & Week Position Filters

Modifiers can be limited to specific phases or positions within the program. Week positions use **relative positioning** to work correctly with variable-length programs.

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string \| string[] | Only apply to specific phase(s): `"Density"`, `"Intensity"`, `"Volume"`, `"Recovery"` |
| `weekPosition` | string \| string[] | Only apply to specific position(s) in program (see values below) |

### Week Position Values

Week positions support **relative positioning** to work correctly with variable-length programs. All percentage positions use **floor semantics** where `0%` equals week 1 and `100%` equals the last week.

| Value | Description |
|-------|-------------|
| `"first"` | First week of the program only |
| `"last"` | Last week of the program only |
| `"early"` | First 33% of the program |
| `"mid"` | Middle 33% of the program |
| `"late"` | Last 33% of the program |
| `"50%"` | Exact percentage through program (±0.5 week tolerance) |
| `"33.3333%"` | Arbitrary precision percentages supported |
| `">5"` | After week 5 (week 6+) |
| `"<10"` | Before week 10 (week 1-9) |
| `">50%"` | After 50% through program |
| `"<33.3333%"` | Before 33.33% through program |

> [!TIP]
> Comparison operators work with arbitrary precision decimals: `">66.6666%"` applies to roughly the last third of the program.

#### Percentage Position Formula

Percentages map to weeks using: `week = 1 + (percentage × (totalWeeks - 1))`

For a **12-week program**:
- `">33.3333%"` applies to weeks where progress > 33.33% → weeks 6-12
- `"<66.6666%"` applies to weeks where progress < 66.66% → weeks 1-8

#### Example: Phase-Aware Modifier

```json
{
  "condition": "tired",
  "phase": "Intensity",
  "adjustments": {
    "powerMultiplier": 0.9,
    "message": "Reducing intensity targets since you're tired during a hard phase."
  }
}
```

#### Example: Position-Based Modifier with Comparison

```json
{
  "condition": "very_high_fatigue",
  "weekPosition": ">50%",
  "adjustments": {
    "volumeMultiplier": 0.8,
    "message": "Late in program - prioritizing recovery over volume."
  }
}
```

#### Example: Combining Phase and Position

```json
{
  "condition": "fresh",
  "phase": "Intensity",
  "weekPosition": ["mid", "late"],
  "adjustments": {
    "powerMultiplier": 1.1,
    "message": "You're feeling great during peak phase - pushing harder!"
  }
}
```

> **Note**: If multiple filter fields are specified (e.g., both `phase` and `weekPosition`), ALL conditions must match for the modifier to apply.

---

## Examples

### Example 1: Fixed 8-Week HIIT Program

```json
{
  "templateVersion": "1.0",
  "id": "fixed-hiit-8week",
  "name": "8-Week HIIT Accelerator",
  "description": "An intensive 8-week high-intensity interval program designed to maximize VO2max improvements.",
  "author": "CardioKinetic",
  
  "weekConfig": {
    "type": "fixed",
    "fixed": 8
  },
  
  "defaultSessionStyle": "interval",
  "progressionMode": "power",
  "defaultSessionDurationMinutes": 15,
  
  "weeks": [
    { "position": 1, "phaseName": "Activation", "focus": "Volume", "description": "Neural activation and movement patterns", "powerMultiplier": 0.9, "workRestRatio": "1:3", "targetRPE": 5 },
    { "position": 2, "phaseName": "Base", "focus": "Volume", "description": "Aerobic base development", "powerMultiplier": 0.95, "workRestRatio": "1:2", "targetRPE": 6 },
    { "position": 3, "phaseName": "Build 1", "focus": "Density", "description": "Increasing work density", "powerMultiplier": 1.0, "workRestRatio": "1:2", "targetRPE": 7 },
    { "position": 4, "phaseName": "Build 2", "focus": "Density", "description": "Peak density phase", "powerMultiplier": 1.0, "workRestRatio": "1:1", "targetRPE": 7 },
    { "position": 5, "phaseName": "Intensity 1", "focus": "Intensity", "description": "Power progression begins", "powerMultiplier": 1.05, "workRestRatio": "1:1", "targetRPE": 8 },
    { "position": 6, "phaseName": "Intensity 2", "focus": "Intensity", "description": "Peak power development", "powerMultiplier": 1.1, "workRestRatio": "2:1", "targetRPE": 8 },
    { "position": 7, "phaseName": "Peak", "focus": "Intensity", "description": "Maximum output", "powerMultiplier": 1.15, "workRestRatio": "2:1", "targetRPE": 9 },
    { "position": 8, "phaseName": "Taper", "focus": "Recovery", "description": "Active recovery and adaptation", "powerMultiplier": 0.8, "workRestRatio": "1:2", "targetRPE": 5 }
  ],
  
  "fatigueModifiers": [
    { "condition": "very_high_fatigue", "priority": 1, "adjustments": { "powerMultiplier": 0.85, "restMultiplier": 1.5, "message": "⚠️ High accumulated fatigue. Reducing intensity to prevent overtraining." } },
    { "condition": "fresh", "priority": 40, "adjustments": { "powerMultiplier": 1.03, "message": "✅ Well recovered. Small intensity boost today." } }
  ]
}
```

### Example 2: Variable-Length Progressive Program (4-6 weeks)

```json
{
  "templateVersion": "1.0",
  "id": "flexible-progressive",
  "name": "Flexible Progressive Builder",
  "description": "A 4-6 week program that adapts to your available training time. Uses relative week positioning for seamless scaling.",
  "author": "CardioKinetic",
  
  "weekConfig": {
    "type": "variable",
    "range": { "min": 4, "max": 6, "step": 1 }
  },
  
  "defaultSessionStyle": "interval",
  "progressionMode": "power",
  "defaultSessionDurationMinutes": 15,
  
  "weeks": [
    { "position": "first", "phaseName": "Foundation", "focus": "Volume", "description": "Establish baseline and movement quality", "powerMultiplier": 1.0, "workRestRatio": "1:2", "targetRPE": 6 },
    { "position": "50%", "phaseName": "Development", "focus": "Intensity", "description": "Progressive overload", "powerMultiplier": 1.1, "workRestRatio": "1:1", "targetRPE": 7 },
    { "position": "last", "phaseName": "Peak", "focus": "Intensity", "description": "Maximum performance", "powerMultiplier": 1.2, "workRestRatio": "2:1", "targetRPE": 9 }
  ],
  
  "fatigueModifiers": [
    { "condition": "overreached", "priority": 0, "adjustments": { "powerMultiplier": 0.75, "volumeMultiplier": 0.5, "message": "🛑 Signs of overreaching. Significant reduction applied." } },
    { "condition": "tired", "priority": 30, "adjustments": { "rpeAdjust": -1, "message": "Take it easier today - reduce perceived effort." } }
  ]
}
```

### Example 3: Steady-State Endurance Program

```json
{
  "templateVersion": "1.0",
  "id": "steady-state-endurance",
  "name": "Zone 2 Endurance Builder",
  "description": "A steady-state aerobic program focusing on fat oxidation and mitochondrial development.",
  
  "weekConfig": {
    "type": "variable",
    "range": { "min": 8, "max": 12, "step": 2 }
  },
  
  "defaultSessionStyle": "steady-state",
  "progressionMode": "duration",
  "defaultSessionDurationMinutes": 30,
  
  "weeks": [
    { "position": "first", "phaseName": "Base", "focus": "Volume", "description": "30min steady Zone 2", "powerMultiplier": 0.65, "workRestRatio": "1:0", "targetRPE": 4, "durationMinutes": 30 },
    { "position": "50%", "phaseName": "Build", "focus": "Volume", "description": "45min steady Zone 2", "powerMultiplier": 0.65, "workRestRatio": "1:0", "targetRPE": 4, "durationMinutes": 45 },
    { "position": "last", "phaseName": "Peak", "focus": "Volume", "description": "60min steady Zone 2", "powerMultiplier": 0.65, "workRestRatio": "1:0", "targetRPE": 5, "durationMinutes": 60 }
  ]
}
```

---

## Importing & Exporting

### Exporting a Template

1. Go to **Settings** tab
2. Click **"Export as Template"**
3. Save the `.json` file

### Importing a Template

1. Go to **Settings** tab
2. Click **"Import Template"**
3. Select your `.json` file
4. Review the validation result
5. The template will appear in your preset list

### Sharing Templates

Templates are plain JSON files that can be shared via:
- Email attachment
- File sharing services
- Community forums
- GitHub repositories

---

## Validation Errors

If your template has errors, you'll see specific messages:

| Error | Fix |
|-------|-----|
| `templateVersion: Must be "1.0"` | Set `"templateVersion": "1.0"` |
| `id: Required string field` | Add unique `"id": "your-id"` |
| `weeks: Must be a non-empty array` | Add at least one week definition |
| `weeks[0].position: Required field` | Each week needs a `position` |
| `weeks[0].powerMultiplier: Must be positive` | Use values > 0 (e.g., 1.0) |

---

## Tips

1. **Start with an export**: Export an existing preset, modify it, and re-import
2. **Use relative positions**: `"first"`, `"50%"`, `"last"` work better for variable-length programs
3. **Test your modifiers**: Create sample data to see fatigue modifiers in action
4. **Keep descriptions helpful**: They appear in Coach's Advice during workouts

---

*Template Documentation v1.0 — CardioKinetic*
