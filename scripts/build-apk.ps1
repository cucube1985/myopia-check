$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
if (-not (Test-Path (Join-Path $env:JAVA_HOME 'bin/java.exe'))) { throw 'JDK 21 이상 경로를 JAVA_HOME에 지정해 주세요.' }
if (-not (Test-Path $env:ANDROID_HOME)) { throw 'Android SDK 경로를 ANDROID_HOME에 지정해 주세요.' }
Push-Location $projectDirectory
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw '웹 빌드 실패' }
    & npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Android 동기화 실패' }
    Push-Location (Join-Path $projectDirectory 'android')
    try {
        & .\gradlew.bat assembleDebug --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'APK 빌드 실패' }
    } finally { Pop-Location }
    $artifactDirectory = Join-Path $projectDirectory 'artifacts'
    New-Item -ItemType Directory -Force -Path $artifactDirectory | Out-Null
    $apkPath = Join-Path $artifactDirectory 'myopia-prototype-0.1.0-debug.apk'
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination $apkPath -Force
    Get-Item $apkPath | Select-Object FullName, Length
    $apkStream = [System.IO.File]::OpenRead($apkPath)
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try {
        $apkHash = [System.BitConverter]::ToString($hasher.ComputeHash($apkStream)).Replace('-', '').ToLowerInvariant()
        Write-Output "SHA256: $apkHash"
    } finally { $apkStream.Dispose(); $hasher.Dispose() }
} finally { Pop-Location }
