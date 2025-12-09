---
description: Build and deploy Android APK
---

# Build Android APK

Follow these steps to build the Android app.

## Prerequisites
- JDK 21+ installed (JDK 25 recommended: `C:\Program Files\Microsoft\jdk-25.0.1.8-hotspot`)
- Node.js and npm installed

## Steps

// turbo
1. Build the web application:
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
npm run build
```

// turbo
2. Sync Capacitor assets to Android:
```powershell
npx cap sync android
```

// turbo
3. Build the debug APK (uses JDK 25):
```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-25.0.1.8-hotspot"; .\gradlew assembleDebug
```

4. The APK will be at:
   `android\app\build\outputs\apk\debug\app-debug.apk`

> [!IMPORTANT]
> **DO NOT attempt to install the APK automatically.** Let the user install it manually on their device.

## Troubleshooting

If you see Java version errors, ensure JAVA_HOME is set to JDK 21+ (JDK 25 works best).

Run the diagnostic script:
```powershell
cd 'c:\Users\marce\Downloads\cardiokinetic(1)'
powershell -ExecutionPolicy Bypass -File .\android-diagnostics.ps1
```
