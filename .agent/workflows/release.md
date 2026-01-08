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

### Step 1: Analyze UNCOMMITTED_CHANGES.md for Version Increment

**This step MUST be completed before calculating the version number.**

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

**Decision Indicators:**

- **MAJOR (RARE - complete redesign only):** The app has been completely rewritten from the ground up, the entire UI/UX paradigm has fundamentally changed, or this is essentially a "new app."
- **MINOR:** A new "headline" feature is added, new menu items/screens/modes added, multiple smaller features combined, or significant algorithm changes.
- **PATCH:** Bug fixes only, UI polish, single small feature additions, performance improvements, documentation updates.

> [!IMPORTANT]
> You must explicitly state your reasoning when deciding the version number. Example:
> "UNCOMMITTED_CHANGES.md contains a new Daily Questionnaire feature (major new functionality). This warrants a MINOR increment: 1.2.0 → 1.3.0"

---

// turbo
### Step 2: Calculate Next Version

Based on your analysis from Step 1, run the appropriate command:

**For PATCH increment:**
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
$changelog = Get-Content CHANGELOG.md -Raw
if ($changelog -match '\[(\d+)\.(\d+)\.(\d+)\]') {
    $major = [int]$matches[1]; $minor = [int]$matches[2]; $patch = [int]$matches[3]
    $newVersion = "$major.$minor.$($patch + 1)"
    Write-Host "Current: $major.$minor.$patch -> Next (PATCH): $newVersion"
}
```

**For MINOR increment:**
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
$changelog = Get-Content CHANGELOG.md -Raw
if ($changelog -match '\[(\d+)\.(\d+)\.(\d+)\]') {
    $major = [int]$matches[1]; $minor = [int]$matches[2]; $patch = [int]$matches[3]
    $newVersion = "$major.$($minor + 1).0"
    Write-Host "Current: $major.$minor.$patch -> Next (MINOR): $newVersion"
}
```

**For MAJOR increment:**
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
$changelog = Get-Content CHANGELOG.md -Raw
if ($changelog -match '\[(\d+)\.(\d+)\.(\d+)\]') {
    $major = [int]$matches[1]; $minor = [int]$matches[2]; $patch = [int]$matches[3]
    $newVersion = "$($major + 1).0.0"
    Write-Host "Current: $major.$minor.$patch -> Next (MAJOR): $newVersion"
}
```

---

### Step 3: Update `config.ts` with New Version

**CRITICAL - must happen before build:**
- Open `config.ts` and update `APP_VERSION` to match the new release version
- This ensures the built APK has the correct version for the update checker toast
- Also make sure that version number in build.gradle is updated. 

---

// turbo
### Step 4: Build the Web Application
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
npm run build
```

// turbo
### Step 5: Sync Capacitor Assets to Android
```powershell
npx cap sync android
```

// turbo
### Step 6: Build the Debug APK (uses JDK 25)
```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-25.0.1.8-hotspot"; .\gradlew assembleDebug
```

// turbo
### Step 7: Rename APK to CardioKinetic(x.y.z).apk (with x.y.z representing the version number)
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
$version = (Get-Content src\config.ts | Select-String "APP_VERSION\s*=\s*['""]([^'""]+)['""]").Matches.Groups[1].Value
Copy-Item -Path "android\app\build\outputs\apk\debug\app-debug.apk" -Destination "CardioKinetic($version).apk" -Force
```

### Step 8: Update CHANGELOG.md
   - Read `UNCOMMITTED_CHANGES.md` content
   - Write original, cohesive release notes matching the style of previous versions:
     - Use `### Added`, `### Fixed`, `### Improved`, `### Changed` sections as appropriate
     - Use `#### Feature Name` subheadings for major features
     - Use bullet points with **bold labels** and concise descriptions
     - No emojis
   - Insert new version section at top (after header)
   - Format: `## [X.Y.Z] - YYYY-MM-DD`

### Step 9: Update README.md (DO NOT FORGET)
   - Find the download link near the top: `**[Download APK (vX.Y.Z)](...)**`
   - Update the version number in the link text to match the new release
   - If any substantial features are added and not present in the readme file, use your own thinking and judgement to add it to the readme if needed and useful. Match the new writing to the current writing style to make one cohesive, well written text that properly showcases the app. Do note that you should only add user-facing features to the readme. 
   - You should ALWAYS analyze individually (no matter what) each of the screenshots displayed in the readme file to see if they need updating. If they do, ask me for the screenshots. Do not take them yourself.
   - If you believe the new features are big enough that they require new screenshots to showcase them, ask for me to take the screenshots. Do not take them yourself. 
   - If screenshots are added/modified, make sure to update both the cnhangelog and unomitted changes properly. 
   

### Step 10: Clear UNCOMMITTED_CHANGES.md
   - Keep header and instructions
   - Replace changes section with `*No changes yet.*`

### Step 11: Commit All Changes
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
git add -A
git commit -m "Release vX.Y.Z: [Brief description of main feature]"
```

// turbo
### Step 12: Push to GitHub
```powershell
git push origin main
```

### Step 13: Create GitHub Release with APK
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
gh release create vX.Y.Z CardioKinetic(X.Y.Z).apk --title "vX.Y.Z: [Title]" --notes "[Release notes - original, cohesive text without emojis]"
```

---

## Important Notes

> [!IMPORTANT]
> - Release notes must be ORIGINAL text, not copy-pasted from UNCOMMITTED_CHANGES.md
> - Match the writing style, tone, and structure of existing changelog entries
> - No emojis anywhere in release notes or changelog
> - Verify the release was created successfully before clearing UNCOMMITTED_CHANGES.md