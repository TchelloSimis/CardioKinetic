---
description: Track changes in UNCOMMITTED_CHANGES.md and manage releases
---

# Change Tracking Workflow

## After Every Coding Session

**IMPORTANT**: After making any code changes, you MUST update `UNCOMMITTED_CHANGES.md`:

1. Open `UNCOMMITTED_CHANGES.md` in the project root
2. Add a concise description of the changes made under "## Changes Since Last Release"
3. Group related changes together (e.g., "Bug Fixes", "New Features", "Improvements")
4. Use bullet points for clarity

### Example Format:
```markdown
## Changes Since Last Release

### New Features
- Added dark mode toggle in settings
- Implemented export to CSV functionality

### Bug Fixes
- Fixed crash when opening empty program
- Corrected calculation in fatigue score

### Improvements
- Optimized chart rendering performance
- Updated documentation
```

---

## When Releasing a New Version

1. Review all entries in `UNCOMMITTED_CHANGES.md`
2. Add the changes to `CHANGELOG.md` under a new version heading with the current date
3. Follow the existing CHANGELOG.md format for consistency
4. Clear the content of `UNCOMMITTED_CHANGES.md` (keep the header structure)
5. Commit and tag the release

---

## Reminder

🔔 **Always check UNCOMMITTED_CHANGES.md before ending a coding session!**
