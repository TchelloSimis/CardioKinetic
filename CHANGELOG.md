# Changelog

All notable changes to CardioKinetic will be documented in this file.

## [1.8.1] - 2026-01-07

### Fixed

- **Dashboard/Chart Synchronization**: Fixed discrepancy between dashboard and daily chart view for fatigue/readiness values by implementing wellness carryover logic in the chart

### Documentation

- **Contributing Guide**: Updated `CONTRIBUTING.md` formatting

## [1.8.0] - 2026-01-07

This release introduces a fundamentally redesigned fatigue and readiness system, replacing the legacy EWMA-based approach with a scientifically grounded dual-compartment model that tracks metabolic and structural fatigue independently. The new system learns your Critical Power from training history, calculates physiologically-accurate session costs, and self-corrects based on your RPE feedback.

### Added

#### Chronic Fatigue Model

A complete overhaul of how CardioKinetic tracks training load and recovery. The new system consists of four interconnected engines:

##### Critical Power Engine
Your aerobic ceiling and anaerobic reserve are now estimated automatically from your training history:

- **eCP (Estimated Critical Power)**: The maximum power you can sustain indefinitely, derived from the power-duration relationship across your sessions
- **W' (W-Prime)**: Your finite work capacity above CP, representing your anaerobic reserve in kilojoules
- **MMP Extraction**: Analyzes mean maximal power across durations from 3 to 40 minutes using second-by-second data when available
- **RPE Proximity Scoring**: Learns from moderate-effort steady-state work—higher stable RPE indicates power closer to your CP threshold
- **Automatic Decay**: CP estimates degrade gradually if you haven't performed maximal efforts recently, ensuring the model stays calibrated

##### Physiological Cost Engine
Training load is no longer calculated linearly. The new engine uses W'bal-style acute deficit tracking to capture the true physiological cost of each session:

- **State-Dependent Cost**: Working at 300W when depleted costs significantly more than when fresh
- **W' Deficit Tracking**: Monitors your anaerobic reserve depletion and recovery throughout each session
- **Non-Linear Integration**: Sessions with repeated high-intensity efforts generate proportionally higher load than pure duration would suggest
- **Intelligent Fallback**: When detailed power data isn't available, the engine infers cost from session style, intensity, and work:rest ratios

##### Dual-Compartment Fatigue Tracking
Fatigue is now split into two reservoirs with distinct recovery dynamics:

- **MET (Metabolic)**: Fast-recovering fatigue with a 2-day time constant, representing glycogen stores, hormonal balance, and CNS readiness—answers "Do I have the energy to train?"
- **MSK (Musculoskeletal)**: Slow-recovering fatigue with a 15-day time constant, representing muscle fiber damage, inflammation, and joint stress—answers "Does my body hurt? Am I at injury risk?"
- **Weighted Readiness**: Your readiness score blends both compartments (60% MET, 40% MSK) for actionable training guidance

##### RPE Correction Loop
The model now self-corrects when your perceived effort doesn't match predictions:

- **Mismatch Detection**: Compares your actual RPE against model-predicted difficulty based on intensity relative to CP
- **Penalty Load Injection**: If sessions feel harder than expected, hidden fatigue is added to MET
- **CP Recalibration**: Persistent RPE mismatches trigger gradual CP downgrades to keep estimates honest

#### Critical Power Insights
A new section in the Training Insights dashboard displays your estimated CP (in watts) and W' (in kilojoules), giving you visibility into the values driving your training recommendations.

#### Recovery Efficiency Display
The Insights tab now shows your current recovery efficiency (φ) as a percentage, derived from your questionnaire responses. Color-coded display indicates whether your recovery conditions are excellent, good, moderate, or impaired.

### Improved

#### Questionnaire Integration
Your daily check-in now directly influences the fatigue model:

- **Recovery Efficiency (φ)**: Sleep, nutrition, and stress responses modulate how quickly MET fatigue clears—poor recovery means fatigue lingers longer
- **Bayesian Corrections**: When you report high soreness but the model shows fresh MSK, hidden structural fatigue is injected (and vice versa for energy/MET)
- **Chart Visualization**: Questionnaire effects now appear correctly in the analytics chart with proper historical carryover

#### Live Session UI
- Phase progress semicircle indicator wraps around the remaining time display
- Interval counter (X/Y) for interval sessions and percentage progress for steady-state sessions displayed below the timer
- Clearer "Remaining" label for the countdown timer

#### Session Log UI
- Dynamic accent colors applied throughout the modal, matching the v1.5.0 design language
- RPE slider redesigned with gradient background, interpolated thumb color, and min/max labels
- Power input and session chart headers use accent-colored icons and labels

### Fixed

#### Chronic Model Integration
- Dashboard tiles now display MET/MSK percentages instead of legacy TSB/ACWR badges
- Monte Carlo simulation engine updated to use dual-compartment dynamics
- Chart and dashboard fatigue/readiness values now calculate consistently from program start date
- Modifier Testing Lab and Auto-Adaptive percentile generation now use the chronic model

#### Auto-Adaptive Modifier Restoration
- Reverted to legacy 2-tier percentile thresholds (P30/P70) for better detection sensitivity
- Restored original adjustment magnitudes: 0.80/0.85 for critical states, 1.12/1.10 for primed states
- Training Insights Dashboard now uses chronic model for all fatigue/readiness insights

#### W' Calculation
- Fixed validation bug where W' = 0 incorrectly passed through—now correctly returns null and uses default fallback
- Root cause: sessions without second-by-second power data produce flat MMP curves where regression calculates W' = 0

### Technical Details

The new system represents a significant architectural advancement:

| Aspect | Legacy (EWMA) | New (Dual-Compartment) |
|--------|---------------|------------------------|
| **Fatigue Types** | Single ATL/CTL | Separate MET (fast) + MSK (slow) |
| **Load Calculation** | Linear power × duration | Non-linear W'bal (state-dependent cost) |
| **Recovery** | Fixed time constants | φ-modulated from questionnaire |
| **Self-Correction** | None | RPE mismatch → penalty + CP downgrade |
| **Subjective Data** | Ignored | Bayesian corrections from soreness/energy |
| **CP Estimation** | External/manual | Built-in eCP with decay + submaximal anchor |

---

## [1.7.0] - 2026-01-05

### Added

#### In-Session RPE Logging
Real-time RPE tracking is now integrated directly into guided training sessions:
- **Live RPE Slider**: Adjust RPE on the fly with a dedicated slider during sessions
- **Data Persistence**: RPE history is logged and stored with session results
- **Safety Features**: Debounced input prevents accidental adjustments
- **Session Analysis**: View your RPE progression alongside power data in post-session analysis

#### Session Chart Viewer
A comprehensive charting tool for visualizing session history:
- **Interactive Charts**: Dual-axis support visualizing Power and RPE simultaneously
- **Access Everywhere**: View charts from the dashboard session list or within session edit screens
- **Smart Integration**: Automatically saves and displays chart data for all new guided sessions

### Improved

#### Live Session Experience
- **Enhanced Layout**: Redesigned for better space efficiency on all devices
- **Visual Feedback**: RPE slider features phase-aware gradients and dynamic thumb coloring
- **Optimized Controls**: Larger touch targets and better safe-area handling for notched devices

#### Session Planning
- **Visual RPE Selection**: New slider-based RPE input replaces button grid
- **Dynamic Cues**: Interface colors update instantly to reflect selected RPE intensity

### Enhancement

- **RPE Descriptions**: Completely rewritten guide with consistent, actionable descriptions across the app
- **Fractional RPE**: Support for 0.5 increments for more precise intensity logging
- **Documentation**: Updated architecture documentation to reflect new data handling

## [1.6.2] - 2026-01-02

### Fixed

#### Training Insights Dashboard Clarity
Resolved confusion caused by change badges showing inconsistent values. The dashboard now clearly separates weekly averages from daily snapshots:
- Weekly averages display as main values with percentage-point change badges
- Today's current values appear in a secondary section with appropriate labels

#### Questionnaire Date Preservation
Fixed a bug where editing a historical questionnaire response would incorrectly overwrite today's response. Edited responses now correctly preserve their original dates.

#### Historic Questionnaire Data Integration
Resolved an issue where past questionnaire responses did not carry over into the analytics chart or affect subsequent days' fatigue and readiness calculations. Questionnaire adjustments are now integrated directly into the EWMA smoothing loop with a 3-day wellness modifier, ensuring consistent values between the dashboard and chart.

### Added

#### Questionnaire Date Selector
A date picker has been added to the questionnaire modal, allowing users to fill in or edit responses for any past date. Selecting a date with existing data automatically loads those values for review or modification.

---

## [1.6.1] - 2026-01-02

### Fixed

- **Questionnaire tile icon color**: Fixed the readiness questionnaire tile icon to use the correct readiness color instead of the fatigue color when pending
- **Timezone-agnostic data handling**: Resolved issues with date handling in the chart and history views to ensure correct data display across different timezones
- **Android Versioning**: Corrected build version synchronization in Gradle configuration

### Improved

- **Dashboard Tile Styling**: Enhanced the visual weight of the power number on the Next Target tile and improved alignment of session details
- **Error Handling**: Introduced a global Error Boundary to improve app stability and provide graceful fallback UI during crashes
- **Code Architecture**: Refactored navigation state management for better maintainability

## [1.6.0] - 2026-01-01

### Added

#### Research-Based Program Templates
Replaced the original preset templates with five new programs grounded in cardiovascular programming research:

- **Aerobic Base Builder**: Structured steady-state program with progressive duration increases from 20 to 35 minutes across weeks
- **Threshold Development**: Block-based program featuring dedicated warmup, threshold work, and cooldown phases for lactate threshold improvement
- **Billat vVO2max Protocol**: Implements the 30-second/30-second interval research for VO2max development with scientifically-backed work:rest ratios
- **Gibala Sprint Intervals**: High-intensity interval training with progressive work:rest ratio adjustments based on HIIT research
- **Builder/Deload Periodization**: Cyclical block-based structure alternating 4-week build phases with 2-week recovery deloads

All templates now demonstrate advanced features including block-based structures, custom session configurations, compound fatigue modifiers, and explicit interval parameters.

#### Program Preview Charts
The onboarding flow now displays power and work progression charts when configuring a new program. Preview your planned training load visually before committing to a program, helping you understand the intensity curve and total volume distribution across weeks.

#### Questionnaire History
View and manage your wellness check-in history with a dedicated history screen accessible from the questionnaire modal:

- **Month-Based Grouping**: Responses organized in collapsible accordion sections by month
- **Visual Scoring**: Color-coded readiness and fatigue adjustments matching your theme
- **Full Edit Capability**: Modify any past response to correct inaccurate entries
- **Delete Support**: Remove individual responses when needed

### Fixed

- **Block-Based Template Simulation**: Resolved a runtime error when simulating block-based templates with custom sessions that caused a `require is not defined` error
- **Program Reordering**: Fixed the up/down reordering buttons in the programming settings that were not properly moving programs

### Changed

#### Legacy System Removal
Removed the deprecated cycle phase detection system that was superseded by the Auto-Adaptive Modifier System in v1.5.0:

- Deleted the phase detection module and legacy duplicate suggest modifiers utility
- Removed `cyclePhase` and `phasePosition` fields from fatigue modifier interfaces
- Cleaned up phase-related calculations from plan generation and metrics hooks
- Reduces codebase by approximately 1,700 lines of legacy code

---

## [1.5.4] - 2025-12-30

### Improved

#### Analytics Chart Performance
Significant performance optimizations to the analytics chart for smoother interactions:

- **Gesture Handling Refactor**: Extracted pan and zoom logic into a dedicated `useChartGestures` hook with optimized event handling
- **Frame-Rate Throttling**: Touch and pan events now throttled via requestAnimationFrame for consistent 60fps updates
- **Reduced Re-renders**: Gesture state tracked in refs during active interactions, committed to React state only on gesture end
- **Memoized Computations**: Chart colors, render data, and tooltip components now properly memoized to prevent unnecessary recalculations

#### Auto-Adaptive Training Accuracy
Refined the automatic training adjustment engine for better detection and more meaningful interventions:

- **Expanded Detection Thresholds**: Widened percentile bands from P30/P70 to P25/P35/P65/P75 for more sensitive detection of fatigue and readiness deviations
- **New Mild Adjustment Tier**: Added a subtle tier for edge-of-normal values that applies conservative adjustments before escalating to stronger interventions
- **Stronger Critical State Response**: Critical fatigue states now reduce power more aggressively (70% vs. previous 80%) for better overtraining prevention
- **Capped Positive Adjustments**: Fresh and primed states now limited to modest power increases to avoid counteracting the benefits of accumulated rest

### Developer Tools

- **Modifier CLI Compatibility**: Updated the command-line modifier analysis tool to use the current auto-adaptive engine, replacing legacy system calls and ensuring test results match production behavior

## [1.5.3] - 2025-12-30

### Added

- **ACWR Badge on Fatigue Tile**: The dashboard fatigue tile now displays an ACWR (Acute:Chronic Workload Ratio) badge matching the TSB badge style. Color-coded indicators show green for optimal training zone (0.8-1.3), gray for potential undertraining (<0.8), and red for elevated injury risk (>1.3)
- **Tile Interactivity Indicators**: Tappable dashboard tiles now display a subtle chevron indicator in the top-right corner, providing visual feedback that they open detailed views

### Fixed

- **Training Insights Timezone Handling**: Session dates in the "Last 7 Days" section now display correctly regardless of timezone by using the date-agnostic parsing system

### Changed

- **Portrait Orientation Lock**: Android app is now locked to portrait mode, preventing unintended landscape rotation

## [1.5.2] - 2025-12-30

### Fixed

- **Update Workflow and Version Config**: Corrected a timing issue in the release workflow that could cause version mismatches. The config file is now properly updated before building to ensure the update checker toast displays the correct version
- **Auto-Adaptive Modifier Messages**: Fixed modifier messages to accurately describe all applied adjustments. Messages now correctly report RPE changes for stressed, tired, and primed states, duration and rest interval modifications for steady-state and interval sessions, and proper percentage calculations for custom sessions

## [1.5.1] - 2025-12-29

### Fixed

- **Program Overwrite Fatigue Modifiers**: Resolved an issue where deleting all fatigue modifiers from a template and applying changes to the current program would incorrectly preserve the original modifiers instead of removing them
- **Version Configuration Sync**: Corrected the APP_VERSION in config.ts to match the actual release version, ensuring the settings toast update checker functions correctly

### Improved

- **Simulation Chart Readability**: X-axis labels on fatigue and readiness projection charts now display at consistent intervals based on program length, preventing cramped labels for longer programs (every 2nd label for 9-16 weeks, every 3rd for 17-24 weeks, etc.)

## [1.5.0] - 2025-12-29

### Added

#### Auto-Adaptive Modifier System
A sophisticated automatic training adjustment engine that replaces the legacy suggestion system:

- **Monte Carlo Simulations**: Runs 100,000 iterations per week count to establish statistical baselines (P15/P30/P70/P85)
- **6 Adaptive States**: Defines your status as Critical, Stressed, Tired, Baseline, Fresh, or Primed based on TSB and fatigue metrics
- **Smart Adjustments**: Modifies programs intelligently based on session type (reducing interval cycles, extending rest, maintaining warmup/cooldown in custom blocks)
- **Coach Priority**: Coach-created modifiers always take precedence, with auto-adaptive adjustments filling the gaps

#### Developer Tools
- **Modifier Testing Lab Export**: Export comprehensive simulation results to JSON for analysis
- **CLI Analysis Tool**: New command-line utility for verifying modifier logic and detecting contradictions
- **Template Simulation Cache**: Pre-computed simulation data stored locally for instant program creation

#### Experience Updates
- **Version Update Toast**: Automatic notification when a new version is available on GitHub
- **Dynamic Accent Colors**: Programming and Data settings now fully respect your chosen theme colors

### Improved

- **Simulation Variability**: Added ±5% duration variability to Monte Carlo simulations for more realistic modeling
- **Chart Layout**: Optimized legend layout and forced X-axis weekly labels for better readability on small screens
- **UI Polish**: Enhanced button states and visual hierarchy across settings and dashboard

### Removed

- **Legacy Suggest Modifiers**: Replaced by the new real-time Auto-Adaptive Modifier System

## [1.4.0] - 2025-12-27

### Added

#### Apply to Current Program
A new workflow for iterating on active programs without losing progress:

- **Live Template Updates**: After editing a program template while a program is active, the save dialog now offers an "Apply to Current Program" option alongside the standard save
- **Session Preservation**: All logged sessions remain intact when applying template changes, ensuring your training history is never lost
- **Seamless Iteration**: Perfect for refining fatigue modifiers, adjusting power progressions, or fine-tuning week configurations mid-program

#### Position-Aware Fatigue Modifiers
Enhanced modifier system with phase position awareness for more nuanced training adjustments:

- **Phase Position Filter**: New `phasePosition` field on fatigue modifiers accepts `'early'`, `'mid'`, or `'late'` values
- **Fatigue Accumulation Patterns**: Modifiers can now trigger differently based on accumulated fatigue within continuous phase blocks
- **Improved Phase Detection**: Enhanced cycle phase detection with better signal smoothing and adaptive window sizing

### Improved

#### Algorithm Enhancements
- **Suggest Modifiers**: The automatic modifier suggestion algorithm now generates position-aware threshold adjustments that account for fatigue accumulation patterns within training phases
- **Template Documentation**: Comprehensive updates to reflect phase position filtering and improved modifier suggestions

### Fixed

- **TypeScript Strict Mode Compliance**: Resolved 37 strict type-checking errors across 17 files, including proper typing for React components, test fixtures, and utility functions
- **Haptics Integration**: Added missing `@capacitor/haptics@7` package dependency for improved tactile feedback on Android
- **Chart Import**: Fixed `Chart.tsx` missing `getProgramEndDate` import that could cause runtime errors
- **Session Guide Properties**: Fixed incorrect property names in `sessionGuideUtils.ts` to match the `SessionResult` type interface
- **Test Infrastructure**: Fixed test fixtures using incorrect types for `WeekPosition`, `WeekFocus`, and `ThresholdCondition`, and added all missing required fields

## [1.3.2] - 2025-12-27

### Fixed

- **Work:Rest Badge Display**: Fixed the Next Target tile incorrectly showing work:rest ratios (1:1, 1:2) for steady-state sessions where the ratio is not applicable

### Improved

#### Dashboard Styling Refinements
Minor visual polish to dashboard elements for a more cohesive appearance:

- **Work:Rest Badge**: Updated styling to match the TSB and readiness/fatigue badges with fully rounded corners and consistent font weight
- **Coach's Advice Card**: Refined to match other dashboard tiles with glassmorphism styling, consistent iconography, and more rounded corners

## [1.3.1] - 2025-12-27

### Improved

#### Questionnaire Badge Redesign
The daily check-in tile now displays readiness and fatigue adjustments using a cleaner badge style that matches the TSB indicator. Badges are rounded, stacked vertically, and color-coded: green for beneficial adjustments, red for concerning ones, and neutral gray for zero impact.

#### Back Button Navigation
Android hardware back button now properly navigates out of the Readiness Questionnaire modal and Training Insights page. The modal header has been updated with a consistent back arrow style that matches the rest of the application.

### Fixed

- **Dashboard and Chart Metrics Synchronization**: Resolved an issue where the Dashboard and Analytics Chart displayed different fatigue and readiness values. The Dashboard now filters sessions to the active program only (matching Chart behavior), and the Chart now applies questionnaire adjustments to current-day values
- **Training Insights Metrics Accuracy**: Fixed the Training Insights page showing different values than the Dashboard. The page now uses pre-calculated metrics from the shared useMetrics hook, ensuring consistency with questionnaire adjustments and program-filtered sessions
- **Timezone-Agnostic Date Handling**: Fixed an issue where session dates could shift by one day in non-UTC timezones. All date operations now use local time consistently via a centralized dateUtils module, ensuring sessions logged late at night appear on the correct calendar day
- **Week Description Cleanup**: Fixed unresolved template placeholders like `{weekCount}` appearing in dashboard week descriptions. Legacy program data is now sanitized at display time to remove any leftover template variables

## [1.3.0] - 2025-12-26

### Added

#### Training Insights Dashboard
A new full-screen insights page provides a comprehensive view of your training status and progress:

- **Body Status Overview**: Current readiness and fatigue percentages with weekly averages and trend indicators
- **Personalized Recommendations**: Smart insights based on fatigue and readiness patterns, suggesting when to push harder or recover
- **Personal Records**: Track peak power, longest session duration, and most work completed (in Wh)
- **Weekly Trends**: Side-by-side comparison of current week vs. previous week training metrics
- **Recent Activity Summary**: Quick view of your last 7 days of training sessions

#### Complete Export and Import System
Full backup and restore functionality for all your training data:

- **Comprehensive Exports**: Backup includes programs, sessions, questionnaire responses, custom templates, and settings
- **Format Migration**: Automatic migration from v1 (legacy) to v2 format during import
- **Merge Import Mode**: Option to preserve existing data during import, with newer entries winning on conflicts
- **Import Preview**: Review data counts before confirming an import operation

#### PWA and Offline Support
CardioKinetic now works offline as a Progressive Web App:

- **Android Standalone Experience**: Install directly from the browser with `manifest.json` support
- **Offline Caching**: Service worker with cache-first strategy ensures the app works without internet
- **Seamless Updates**: Background cache updates when connectivity is restored

### Improved

#### Enhanced Readiness Questionnaire Algorithm
A complete overhaul of the daily check-in algorithm with six new intelligence layers for more accurate training adjustments:

- **Synergy Detection**: Compound effects when multiple wellness categories strongly align, with 1.25x-1.5x multipliers
- **7-Day Trend Analysis**: Historical pattern detection that amplifies declining trends and dampens improving ones
- **Cascade Effects**: Physiological rule-based triggers for conditions like sleep deprivation or extreme soreness
- **Athlete Profile Detection**: Identifies patterns like "masked fatigue" (high motivation but low energy) and "resilient athlete"
- **Cluster Weighting**: Different weights for Recovery Input categories vs. Current State categories
- **Non-linear Scaling**: Extreme responses (1 or 5) have amplified impact compared to moderate answers

Calibrated base impacts increased to ±8 for both readiness and fatigue, with asymmetric risk weighting for injury prevention and combined multipliers capped at 2.5x.

#### Analytics Chart Improvements
- **Weekly Averages**: Fatigue and readiness in weeks view now show weekly averages instead of end-of-week snapshots
- **Partial Week Handling**: Current week correctly averages only completed days
- **Continuous Display**: Fatigue and readiness extend to current date, not just last session
- **Simulated Date Support**: Chart respects developer tools simulated date for testing historical states

### Fixed

- **Incomplete Program Handling**: Programs finished early now correctly respect their actual end date for timeline calculations, planned power/work display, and session grouping
- **Block Description Placeholder**: The `{weekCount}` placeholder in block-based program descriptions now correctly substitutes the actual week count

### Testing

Comprehensive test coverage now includes 40 test files with 810+ unit tests, covering core training metrics, block expansion, template validation, fatigue modifiers, export/import functionality, chart data generation, and component rendering.

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
