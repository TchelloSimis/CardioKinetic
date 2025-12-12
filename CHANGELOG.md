# Changelog

All notable changes to CardioKinetic will be documented in this file.

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
