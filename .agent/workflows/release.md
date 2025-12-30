---
description: Build app, create release with auto-versioning, update changelog, push to GitHub
---

# Release Workflow

Automates the full release process: build, version increment, changelog update, and GitHub release.

## Prerequisites
- All changes must be tracked in `UNCOMMITTED_CHANGES.md`
- Clean working directory (no uncommitted changes outside of tracked files)
- GitHub CLI (`gh`) authenticated

## Steps

// turbo
1. Read current version from CHANGELOG.md to determine next version:
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
$changelog = Get-Content CHANGELOG.md -Raw
if ($changelog -match '\[(\d+)\.(\d+)\.(\d+)\]') {
    $major = [int]$matches[1]; $minor = [int]$matches[2]; $patch = [int]$matches[3]
    $newVersion = "$major.$minor.$($patch + 1)"
    Write-Host "Current: $major.$minor.$patch -> Next: $newVersion"
}
```

// turbo
2. Build the web application:
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
npm run build
```

// turbo
3. Sync Capacitor assets to Android:
```powershell
npx cap sync android
```

// turbo
4. Build the debug APK (uses JDK 25):
```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-25.0.1.8-hotspot"; .\gradlew assembleDebug
```

// turbo
5. Rename APK to CardioKinetic.apk:
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
Copy-Item -Path "android\app\build\outputs\apk\debug\app-debug.apk" -Destination "CardioKinetic.apk" -Force
```

6. Update CHANGELOG.md:
   - Read `UNCOMMITTED_CHANGES.md` content
   - Write original, cohesive release notes matching the style of previous versions:
     - Use `### Added`, `### Fixed`, `### Improved`, `### Changed` sections as appropriate
     - Use `#### Feature Name` subheadings for major features
     - Use bullet points with **bold labels** and concise descriptions
     - No emojis
   - Insert new version section at top (after header)
   - Format: `## [X.Y.Z] - YYYY-MM-DD`

7. **Update README.md** (DO NOT FORGET):
   - Find the download link near the top: `**[Download APK (vX.Y.Z)](...)**`
   - Update the version number in the link text to match the new release
   - If any substantial features are added and not present in the readme file, use your own thinking and judgement to add it to the readme if needed and useful. Match the new writing to the current writing style to make one cohesive, well written text that properly showcases the app. Do note that you should only add user-facing features to the readme. 
   - You should ALWAYS analyze individually (no matter what) each of the screenshots displayed in the readme file to see if they need updating. If they do, ask me for the screenshots. Do not take them yourself.
   - If you believe the new features are big enough that they require new screenshots to showcase them, ask for me to take the screenshots. Do not take them yourself. 
   - If screenshots are added/modified, make sure to update both the cnhangelog and unomitted changes properly. 
   

8. Clear UNCOMMITTED_CHANGES.md:
   - Keep header and instructions
   - Replace changes section with `*No changes yet.*`

9. Commit all changes:
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
git add -A
git commit -m "Release vX.Y.Z: [Brief description of main feature]"
```

10. Push to GitHub:
```powershell
git push origin main
```

11. Create GitHub release with APK:
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
gh release create vX.Y.Z CardioKinetic.apk --title "vX.Y.Z: [Title]" --notes "[Release notes - original, cohesive text without emojis]"
```

## Version Increment Decision

Before incrementing the version, you MUST analyze the contents of `UNCOMMITTED_CHANGES.md` and apply the following criteria:

### Evaluation Process

1. Read `UNCOMMITTED_CHANGES.md` completely
2. Categorize each change as one of:
   - **Breaking change**: API changes, removed features, incompatible data format changes
   - **New feature**: New user-facing functionality, major new components
   - **Enhancement**: Improvements to existing features, UI refinements
   - **Bug fix**: Corrections to existing behavior
   - **Documentation**: Docs-only changes
   - **Refactor**: Internal code changes with no user-facing impact

3. Apply these rules in order:

| If changes include... | Increment | Example |
|----------------------|-----------|---------|
| Complete app redesign or rewrite | **Major** (X+1.0.0) | 1.2.1 → 2.0.0 |
| New major feature (standalone functionality) | **Minor** (X.Y+1.0) | 1.2.1 → 1.3.0 |
| Multiple new features or significant enhancements | **Minor** (X.Y+1.0) | 1.2.1 → 1.3.0 |
| Bug fixes, small features, refinements only | **Patch** (X.Y.Z+1) | 1.2.1 → 1.2.2 |

### Decision Indicators

**Increment MAJOR when (RARE - complete redesign only):**
- The app has been completely rewritten from the ground up
- The entire UI/UX paradigm has fundamentally changed
- This is essentially a "new app" that happens to share the same name

> [!CAUTION]
> Do NOT increment major version for regular breaking changes, new features, or even significant rewrites of individual components. Major version changes are reserved for complete app redesigns only.

**Increment MINOR when:**
- A new "headline" feature is added (something you'd announce)
- New menu items, screens, or modes added
- Multiple smaller features combined
- Significant algorithm or behavior changes

**Increment PATCH when:**
- Bug fixes only
- UI polish or refinements
- Single small feature additions
- Performance improvements
- Documentation updates

> [!IMPORTANT]
> You must explicitly state your reasoning when deciding the version number. Example:
> "UNCOMMITTED_CHANGES.md contains a new Daily Questionnaire feature (major new functionality). This warrants a MINOR increment: 1.2.0 → 1.3.0"

## Important Notes

> [!IMPORTANT]
> - Release notes must be ORIGINAL text, not copy-pasted from UNCOMMITTED_CHANGES.md
> - Match the writing style, tone, and structure of existing changelog entries
> - No emojis anywhere in release notes or changelog
> - Verify the release was created successfully before clearing UNCOMMITTED_CHANGES.md
> - **Update `APP_VERSION` in `config.ts`** to match the new version number - this is required for the settings toast update checker to work correctly