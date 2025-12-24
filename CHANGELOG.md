# Changelog

All notable changes to CardioKinetic will be documented in this file.

## [1.2.2] - 2025-12-24

### Added

#### Vitest Testing Framework
A comprehensive unit testing infrastructure has been established:

- **Test Environment**: Vitest with jsdom environment, React Testing Library, and jest-dom matchers
- **Coverage**: 249 unit tests across 16 test files with full pass status
- **Scripts**: Added `test`, `test:run`, and `test:coverage` npm commands

#### Design Token System
A centralized design system providing consistent styling across the application:

- **Color Tokens**: Accent colors via CSS variables, status palettes (success/error/warning/info with 50-700 shades), neutral scale (0-950)
- **Spacing Scale**: Comprehensive scale from 0 to 24 (2px to 96px)
- **Typography Tokens**: Font families, size/line-height pairs, weights, and letter spacing
- **Component Presets**: Button, card, input, modal, and label tokens for consistent component styling

#### Standardized Component Library
A set of reusable, accessible components built on the design token system:

- **Button**: Five variants (primary, secondary, ghost, danger, success), three sizes, loading states, and icon support
- **Label**: Default, subtle, and strong variants with required indicators and helper text
- **Card**: Four variants (default, elevated, outlined, filled), three sizes with consistent border radii
- **Typography**: Heading levels 1-6 with consistent sizing hierarchy, Text component with body/small/caption/overline variants
- **Skeleton Loaders**: Base skeleton with pulse/shimmer animation, plus specialized variants for text, cards, stats, list items, and charts
- **Empty State**: Configurable component with icon, title, description, and action buttons
- **Step Indicator**: Horizontal/vertical orientations with completed/active/pending states

#### UI/UX Utilities
Cross-cutting utilities for improved user experience:

- **Form Validation**: Validators for power, RPE, duration, intervals, dates, and required fields with consistent error messaging
- **Haptic Feedback Service**: Seven feedback types (light/medium/heavy/success/warning/error/selection) with session-specific patterns
- **Scroll Position Preservation**: Per-key position storage with save/restore on mount/unmount
- **Accessibility Helpers**: Touch target constants, ARIA prop generators, focus management, and screen reader announcements

### Improved

#### Modular Architecture Refactoring
Major codebase reorganization splitting monolithic files into focused, testable modules:

- **suggestModifiers**: Split from 1189 lines into types, algorithms, simulation, and generators modules
- **useSessionTimer**: Split from 1048 lines into types, sessionState, and timerCore modules
- **BlocksDefinitionStep**: Split from 996 lines into constants, FixedWeekEditor, BlockEditorCard, and WeekSessionEditor components
- **App Handlers**: Extracted program and session handlers into dedicated modules
- **WeekDefinitionsStep**: Extracted week utilities (createDefaultWeek, calculateIntervalDuration)
- **DevToolsSettings**: Extracted notification, date, and color helpers
- **LiveSessionGuide**: Extracted phase, time, and progress utilities

### Documentation

- **README.md**: Updated feature sections for Block-Based Programs, Daily Readiness Questionnaire, and Intelligent Modifier Suggestions; all screenshots recaptured with Lavender theme; download link now version-agnostic

## [1.2.1] - 2025-12-24

### Added

#### Daily Readiness Questionnaire
An optional daily check-in system that refines fatigue and readiness scores based on subjective wellness data:

- **Wellness Categories**: Eight questions across five domains (Sleep, Nutrition, Stress, Physical State, Motivation) capture daily physiological and psychological status
- **Discrete Response System**: Five-point scales with descriptive tooltips for each answer, displayed as styled range inputs with tick marks
- **Contradiction-Weighted Adjustments**: Responses that contradict predicted metrics receive larger score modifications than confirmatory responses
- **Asymmetric Safety Bias**: Negative subjective reports (feeling worse than expected) carry greater weight than positive reports, prioritizing injury prevention
- **Dashboard Integration**: Check-in card displays completion status with readiness (+X R) and fatigue (+Y F) adjustment badges
- **Persistent and Editable**: Responses stored in localStorage with full edit capability; skipping has zero effect on metrics

New types: `QuestionnaireResponse`, `QuestionnaireQuestion` (with `optional` field for rest-day flexibility).

New files: `utils/questionnaireConfig.ts` (question definitions, adjustment algorithm), `components/modals/ReadinessQuestionnaireModal.tsx` (modal UI).

Modified: `types.ts`, `hooks/useAppState.ts`, `hooks/useMetrics.ts`, `components/DashboardTab.tsx`, `App.tsx`.

## [1.2.0] - 2025-12-24

### Added

#### Intelligent Modifier Suggestions (Major Feature)
A new "Suggest Modifiers" button leverages advanced multi-scale adaptive trend detection to automatically generate fatigue modifiers tailored to your program:

- **Automatic Cycle Phase Detection**: Uses signal processing (Savitzky-Golay smoothing) and CUSUM change-point detection to identify training phases (`ascending`, `peak`, `descending`, `trough`) from fatigue trajectory
- **Two-Tier Suggestion System**: Standard tier (P30/P70 thresholds) for moderate deviations, Extreme tier (P15/P85) for significant deviations requiring stronger adjustments
- **Session-Type Awareness**: Analyzes your program structure and generates appropriate modifiers—`restMultiplier` for interval sessions, `durationMultiplier` for steady-state, block-level adjustments for custom sessions
- **Combined Condition Modifiers**: Triggers on both fatigue AND readiness simultaneously for aggressive interventions when needed
- **Overload Protection**: Priority 1 modifiers force mandatory deloads when fatigue exceeds 85% or readiness drops below 25%
- **Actionable Messages**: Human-readable suggestions like "Target power at 92%" instead of technical notation

New supporting types: `CyclePhase`, `cyclePhase`/`sessionType` filter fields, `durationMultiplier` adjustment, and `detectCyclePhase()` runtime function.

#### Modifier Testing Panel (Developer Tools)
A new Monte Carlo simulation panel for validating modifier effectiveness:

- Run 10-1000 iterations comparing baseline vs. adaptive (modifier-applied) execution
- Week-by-week fatigue/readiness projections with P30-P70 statistical variance
- Power multiplier progression overlay and modifier trigger frequency tracking
- Click any week for detailed breakdown of triggered modifiers

### Fixed

- **Fatigue Modifiers Step Header**: Fixed cramped header layout that caused overflow on smaller screens. Buttons now wrap properly with shortened labels ("Suggest", "Add")
- **Block-Based Program Preview**: Chart and week definitions table now correctly display for block-based programs using `expandBlocksToWeeks()`. Added support for `customDurations` and empty state message
- **Block-Based Duration Progression**: `expandBlocksToWeeks()` now correctly applies `durationProgression` and `durationReference` fields. Added `calculateBlockDuration()` function paralleling power calculations
- **Block Sequence Starting Point**: Fixed block-based programs sometimes starting with wrong block (e.g., Deload instead of Build) by always using first block in array order
- **Custom Session Target Power Display**: Live session guide now shows block-specific power (e.g., 70W at 70% multiplier) instead of base session power. Harder/easier adjustments properly reset on block transitions
- **Session Editor State After Cancel**: Fixed stale values appearing when reopening session setup after cancelling a live session

### Improved

#### Algorithm Enhancements
- **Zero-History Edge Case**: Added `CTL_MINIMUM = 15` constant to prevent ACWR explosion for new users
- **Asymmetric Readiness Penalties**: Steeper penalty for overtraining (injury risk) vs. gentler penalty for detraining (gradual fitness loss)
- **Training Monotony Utilities**: New `calculateMonotony()`, `calculateStrain()`, and risk classification functions based on Foster et al. research
- **Cycle Phase Detection**: Increased minimum data points (3→5), added hysteresis to prevent phase thrashing, confidence-based phase stickiness

### Documentation
- **Complete rewrite of `TEMPLATE_DOCUMENTATION.md`**: Streamlined from ~1050 to ~560 lines with Quick Start guide, Suggested Modifiers section, session-type adjustments, and consolidated filter field documentation
- **Enhanced Fatigue & Readiness Science Section**: Added algorithm explanations with research citations (Gabbett 2016, Friel 2009, Banister 1991, Foster 1998)

## [1.1.0] - 2025-12-12

### Added

#### Block-Based Program Templates (Major Feature)
- **New `structureType` field**: Templates can now be `'week-based'` (traditional) or `'block-based'` (new)
- **`ProgramBlock` type**: Define reusable training blocks with:
  - `id`, `name`, `weekCount`: Block identification and length
  - `powerReference`: Power calculation mode (`'base'`, `'previous'`, or `'block_start'`)
  - `powerProgression`: Array of power multipliers for each week in the block
  - `followedBy`: Chain blocks together (e.g., Builder → Deload → Builder)
  - Full `WeekDefinition` properties: `focus`, `phaseName`, `description`, `workRestRatio`, `targetRPE`, etc.
- **`PowerReference` type**: Three modes for relative power calculations:
  - `'base'`: Multiplier × basePower (absolute reference)
  - `'previous'`: Multiplier × previous week's power
  - `'block_start'`: Multiplier × power from the week before the block started
- **`fixedFirstWeek` and `fixedLastWeek`**: Define fixed introductory/conclusion weeks
- **`customDurations` in WeekConfig**: Specify exact valid durations instead of min/max/step range

#### New Files
- **`utils/blockExpansion.ts`**: Core algorithm for block-based program generation
  - `expandBlocksToWeeks()`: Converts block definitions to week arrays
  - `calculateBlockPower()`: Handles relative power reference calculations
  - `generateBlockSequence()`: Sequences blocks using followedBy chains
  - `countBlockOccurrences()`: Counts block instances for a given duration
  - `formatBlockCounts()`: Returns UI-friendly string (e.g., "Builder ×2, Deload ×1")

#### UI Enhancements
- **Onboarding duration slider**: Now displays block composition for block-based templates
  - Shows "Builder ×2, Deload ×1" format below the week selector
  - Updates dynamically as user changes duration

- **Program Editor: Block-Based Program Support**
  - Configuration Step now has "Program Structure" toggle (Week-Based / Block-Based)
  - New "Custom" duration option: enter comma-separated week counts with validation
  - New types in `programTemplate.ts`:
    - `BlockProgressionType`: 'power' | 'duration' | 'double'
    - `BlockWeekSession`: per-week session configuration with targetRPE
  - `ProgramBlock` interface now includes:
    - `progressionType`: power-only, duration-only, or double progression
    - `durationProgression`: per-week duration multipliers (cycles rounded for interval)
  - New `BlocksDefinitionStep.tsx` component with **per-week session customization**:
    - Block list with add/remove/reorder functionality
    - **Progression selector** (Power Only / Duration Only / Power + Duration)
    - **Per-week expandable editors (W1, W2, W3...)** with:
      - Session Style selector (Interval / Steady-State / Custom)
      - Interval mode: Cycles, Work (s), Rest (s), auto-calculated duration
      - Steady-State mode: Duration (min) only (removed Work:Rest - not applicable)
      - Custom mode: Full Training Blocks UI
      - **Power × multiplier** (shown for power/double progression)
      - **Duration × multiplier** (shown for duration/double progression)
      - **Target RPE** per week
    - followedBy selector for block chaining
    - Fixed First Week and Fixed Last Week sections
  - Step 3 dynamically shows "Blocks" or "Weeks" based on structure type

#### Example Template



- **Builder/Deload Periodization**: New preset demonstrating block-based structure
  - 4-week Builder blocks (power 1.1× → 1.4× relative to block start)
  - 2-week Deload blocks (power 0.8× relative to block start)
  - Custom durations: 8, 14, 20, 26 weeks
  - Fixed intro/outro weeks at base power

#### Features for week-based programs
- **Interval sessions now support cycles/work/rest configuration in Program Editor**
  - When `sessionStyle === 'interval'`, you can now define sessions using:
    - `cycles`: Number of work/rest cycles
    - `workDurationSeconds`: Work duration per cycle
    - `restDurationSeconds`: Rest duration per cycle
  - Duration is automatically calculated: `cycles × (work + rest) / 60`
  - Fatigue modifier `volumeMultiplier` rounds cycles to nearest integer (same as interval blocks in custom sessions)

#### Fatigue Modifier Enhancements
- **Phase Name condition**: Fatigue modifiers can now trigger only in specific phases
  - New `phaseName` field in `FatigueModifier` interface
  - Added to `FatigueContext` for condition checking
  - **UI**: Phase Name dropdown selector in Fatigue Modifiers step
    - Shows available phase names from weeks/blocks when defined
    - Falls back to text input when no phases are defined
    - Validation warning when phase name doesn't match template
  - Runtime check in `applyFatigueModifiers()` filters modifiers by phase name


### Changed
- **`planGeneration.ts`**: Extended to detect `structureType` and route to appropriate generation path
- **`templateValidation.ts`**: Added validation for:
  - `customDurations` (must be positive integers)
  - `ProgramBlock` structure (id, name, weekCount, powerReference, powerProgression, etc.)
  - `followedBy` chain references (must point to valid block IDs)
- **`templateUtils.ts`**: `templateToPreset()` and `hydratePreset()` now preserve block-based fields
- **`getWeekOptions()`**: Now returns `customDurations` when specified (overrides range)
- **`getValidWeekCount()`**: Validates against `customDurations` when present

### Documentation
- **`TEMPLATE_DOCUMENTATION.md`**: Added comprehensive "Block-Based Programs" section
  - Custom Duration Lists documentation
  - ProgramBlock interface reference
  - Power reference modes with calculation examples
  - Fixed first/last weeks documentation
  - Block chaining explanation
  - Complete JSON example template

### Fixed
- **Duration fatigue modifiers now work correctly with custom sessions**
  - For interval blocks: `volumeMultiplier` is applied to cycles and rounded to the nearest integer (e.g., 6 cycles × 0.8 = 5 cycles)
  - For steady-state blocks: `volumeMultiplier` is applied to duration without rounding (e.g., 8 min × 0.8 = 6.4 min)
  - `targetDurationMinutes` is recalculated from modified blocks for consistency
- **Analytics chart dates now match session history dates**
  - Fixed timezone issue where chart dates could be off by one day in non-UTC timezones
  - Date display now parses directly from ISO strings instead of using `toLocaleDateString()` on UTC-constructed dates
- **Fatigue/Readiness curves now extend through the current day**
  - Metrics continue to show the natural decay on rest days instead of stopping at the last session
  - EWMA model correctly displays current readiness state even without recent training
- **Simulation tile now properly handles fixed-duration programs**
  - Programs with a single `weekCount` (no `minWeeks`/`maxWeeks`) now display a static week value instead of a slider
  - Programs with `weekOptions` containing only one value are correctly detected as fixed-duration
  - Week count automatically syncs when switching between programs with different duration configurations
- **Simulation charts now fill full horizontal width**
  - Removed unnecessary padding from chart containers
  - Set explicit Y-axis widths (35px left, 30px right) to minimize reserved space
  - Charts now extend edge-to-edge within the card

### Changed
- **Readiness model now starts at ~75% instead of ~93%**
  - Initial ATL seed changed from 0 to 9 (CTL remains at 10)
  - TSB = CTL - ATL = 1 → Readiness ≈ 75% (neutral starting state)
  - Represents a more realistic baseline where athletes have some acute training load
  - Updated `metricsUtils.ts` and `simulationEngine.ts` with new initial values
  - Added "Initial State" section to `TEMPLATE_DOCUMENTATION.md` explaining seed values
- **Duration selector now supports non-uniform custom durations**
  - Changed from value-based slider (`step = weekOptions[1] - weekOptions[0]`) to index-based
  - Slider now correctly handles asymmetric durations like `[8, 12, 14, 18, 20, 24, 26]`
  - Uses `min=0, max=weekOptions.length-1, step=1` to index into options array

### Documentation
- **`TEMPLATE_DOCUMENTATION.md`**: Added comprehensive **Fatigue Modifiers** section (~200 lines)
  - Condition fields (fatigue, readiness thresholds with operators)
  - Adjustment fields (powerMultiplier, rpeAdjust, restMultiplier, volumeMultiplier, message)
  - Priority system explanation with use case tiers
  - Phase filter (WeekFocus types)
  - Phase Name filter (string matching with validation)
  - Week Position filter (first/last, early/mid/late, percentage positions)
  - Three complete JSON examples (high fatigue recovery, peak week boost, overreaching prevention)

### UI Fixes
- **Edit Template program selector**: Description text now shows 3 lines instead of 2 (line-clamp-3)
  - Added `flex-1 pr-2` for proper text wrapping

## [1.0.1] - 2025-12-12

### Added
- **Fatigue Modifier Priority** — Set priority on fatigue modifiers so only the highest-priority matching condition triggers, preventing conflicting adjustments
- **New Fatigue and Readiness formulas** — better, more responsive formulas for fatigue and readiness. Check template documentation for details. 
- **Fatigue and Readiness projection** — Visualize how fatigue and readiness should behave in any program, on average (see developer tools)

### Changed
- **Fatigue Score Sensitivity** — Adjusted formula parameters (midpoint: 1.15, steepness: 4.5) for more responsive fatigue tracking
- **Removed Swipe Tab Navigation** — Tab switching via horizontal swipe gestures has been disabled for more intentional navigation
- **Modernized Dropdown Menus** — Updated all dropdown menus in the program editor with a modern, sleek design
- **License** — Changed from CC BY-NC 4.0 to GNU General Public License v3.0 (GPLv3)

### Fixed
- **Custom Session Audio Cues** — 3-second countdown now plays before each block (including final intervals)
- **Flexible Program Chart Accuracy** — Program preview and analytics charts now correctly display planned power/work for variable-length programs
- **Custom Session Block Colors** — Steady-state blocks now use the correct fatigue/alt-accent color, interval blocks use readiness/accent color
- **Custom Session Power/Work Calculations** — Accurate planned average power and total work for sessions with mixed block types

---

## [1.0.0] - 2025-12-09

### Initial Release
- Smart training programs with power, duration, and double progression modes
- Fixed and variable-length program support with automatic week interpolation
- Comprehensive analytics with power trends, total work, and fatigue tracking
- Fitness-Fatigue model (Banister model) with ATL, CTL, ACWR, and TSB metrics
- Fatigue and Readiness scoring with automatic training adjustments
- Interval, steady-state, and custom hybrid session types
- Material You theming with system-aware dark mode
- Native Android experience with foreground service and persistent notifications
- Audio cues for interval transitions and countdowns
