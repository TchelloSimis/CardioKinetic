# Android Build Diagnostics Script
# Run this script to check your Android development environment

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CardioKinetic Android Build Diagnostics" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check Java version
Write-Host "[1/5] Checking Java Version..." -ForegroundColor Yellow
$javaVersion = java -version 2>&1 | Select-String -Pattern 'version'
Write-Host "Java Version: $javaVersion" -ForegroundColor White

$javaHome = $env:JAVA_HOME
if ($javaHome) {
    Write-Host "JAVA_HOME: $javaHome" -ForegroundColor White
} else {
    Write-Host "JAVA_HOME: NOT SET" -ForegroundColor Red
}

# Extract major version number
$versionMatch = [regex]::Match($javaVersion, '"(\d+)')
if ($versionMatch.Success) {
    $majorVersion = [int]$versionMatch.Groups[1].Value
    if ($majorVersion -eq 17) {
        Write-Host "[OK] Java 17 detected - Compatible!" -ForegroundColor Green
    } elseif ($majorVersion -gt 17) {
        Write-Host "[ERROR] Java $majorVersion is too NEW. Android Gradle Plugin 8.7.2 requires JDK 17." -ForegroundColor Red
        Write-Host "        Please install JDK 17 and update JAVA_HOME." -ForegroundColor Red
    } else {
        Write-Host "[ERROR] Java $majorVersion is too OLD. Android Gradle Plugin 8.7.2 requires JDK 17." -ForegroundColor Red
    }
}

Write-Host ""

# Check Node.js
Write-Host "[2/5] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js Version: $nodeVersion" -ForegroundColor White
    Write-Host "[OK] Node.js is installed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH" -ForegroundColor Red
}

Write-Host ""

# Check npm packages
Write-Host "[3/5] Checking npm packages..." -ForegroundColor Yellow
$packageJson = "c:\Users\marce\Downloads\cardiokinetic(1)\package.json"
if (Test-Path $packageJson) {
    Write-Host "[OK] package.json found" -ForegroundColor Green
    
    # Check if node_modules exists
    $nodeModules = "c:\Users\marce\Downloads\cardiokinetic(1)\node_modules"
    if (Test-Path $nodeModules) {
        Write-Host "[OK] node_modules exists" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] node_modules not found - run 'npm install'" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERROR] package.json not found" -ForegroundColor Red
}

Write-Host ""

# Check dist folder
Write-Host "[4/5] Checking Web Build (dist/)..." -ForegroundColor Yellow
$distFolder = "c:\Users\marce\Downloads\cardiokinetic(1)\dist"
if (Test-Path $distFolder) {
    $distFiles = Get-ChildItem -Path $distFolder -Recurse -File
    Write-Host "[OK] dist/ folder exists with $($distFiles.Count) files" -ForegroundColor Green
    
    $indexHtml = Join-Path $distFolder "index.html"
    if (Test-Path $indexHtml) {
        Write-Host "[OK] dist/index.html exists" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] dist/index.html missing - run 'npm run build'" -ForegroundColor Red
    }
} else {
    Write-Host "[ERROR] dist/ folder not found - run 'npm run build'" -ForegroundColor Red
}

Write-Host ""

# Check Android assets
Write-Host "[5/5] Checking Android Assets..." -ForegroundColor Yellow
$androidAssets = "c:\Users\marce\Downloads\cardiokinetic(1)\android\app\src\main\assets\public"
if (Test-Path $androidAssets) {
    $assetFiles = Get-ChildItem -Path $androidAssets -Recurse -File
    Write-Host "[OK] Android assets folder exists with $($assetFiles.Count) files" -ForegroundColor Green
    
    $androidIndex = Join-Path $androidAssets "index.html"
    if (Test-Path $androidIndex) {
        Write-Host "[OK] assets/public/index.html exists" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] assets/public/index.html missing - run 'npx cap sync android'" -ForegroundColor Red
    }
} else {
    Write-Host "[ERROR] Android assets folder not found - run 'npx cap sync android'" -ForegroundColor Red
}

Write-Host ""

# Gradle wrapper check
Write-Host "[BONUS] Checking Gradle Wrapper..." -ForegroundColor Yellow
$gradlew = "c:\Users\marce\Downloads\cardiokinetic(1)\android\gradlew.bat"
if (Test-Path $gradlew) {
    Write-Host "[OK] gradlew.bat exists" -ForegroundColor Green
} else {
    Write-Host "[ERROR] gradlew.bat not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostics Complete" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Summary and recommendations
Write-Host "SUMMARY:" -ForegroundColor White
if ($majorVersion -ne 17) {
    Write-Host ""
    Write-Host "[ACTION REQUIRED] Install JDK 17 to fix Android build:" -ForegroundColor Red
    Write-Host "  1. Download JDK 17 from: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor White
    Write-Host "  2. Install it" -ForegroundColor White
    Write-Host "  3. Set JAVA_HOME to the JDK 17 installation path" -ForegroundColor White
    Write-Host "  4. Restart your terminal and IDE" -ForegroundColor White
    Write-Host "  5. Run: cd android; .\gradlew clean; .\gradlew build" -ForegroundColor White
}

Write-Host ""
Write-Host "To rebuild the Android app after fixing Java:" -ForegroundColor Yellow
Write-Host "  cd 'c:\Users\marce\Downloads\cardiokinetic(1)'" -ForegroundColor White
Write-Host "  npm run build" -ForegroundColor White
Write-Host "  npx cap sync android" -ForegroundColor White
Write-Host "  cd android" -ForegroundColor White
Write-Host "  .\gradlew assembleDebug" -ForegroundColor White
Write-Host ""
