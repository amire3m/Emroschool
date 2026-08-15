#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$PackageJson = Get-Content "package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$Version = [string]$PackageJson.version

$KeyStoreRel = "android/emroschool-release.keystore"
$KeyStore = Join-Path $RepoRoot $KeyStoreRel
$KeyAlias = if ($env:ANDROID_KEYSTORE_ALIAS) { $env:ANDROID_KEYSTORE_ALIAS } else { "emroschool" }
$StorePass = if ($env:ANDROID_KEYSTORE_PASSWORD) { $env:ANDROID_KEYSTORE_PASSWORD } else { "emroschool" }
$KeyPass = if ($env:ANDROID_KEY_PASSWORD) { $env:ANDROID_KEY_PASSWORD } else { $StorePass }

function Assert-Tool([string]$Name, [string[]]$Args) {
  try {
    $null = & $Name @Args 2>$null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

Write-Host "=== Preflight ==="
if (-not (Assert-Tool "java" @("-version"))) { Write-Error "JDK 17 not found in PATH. Install from https://adoptium.net/temurin/releases/?version=17" }
if (-not (Assert-Tool "keytool" @("-help"))) { Write-Error "keytool not found in PATH (JDK required)." }
if (-not (Assert-Tool "node" @("--version"))) { Write-Error "Node.js not found in PATH." }
if (-not (Assert-Tool "npx" @("--version"))) { Write-Error "npx not found in PATH." }
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) { Write-Warning "ANDROID_HOME/ANDROID_SDK_ROOT is not set; bubblewrap will try to auto-install the SDK." }

Write-Host "=== Keystore ==="
if (-not (Test-Path $KeyStore)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $KeyStore) | Out-Null
  Write-Host "Generating release keystore at $KeyStoreRel ..."
  & keytool -genkeypair -v -keystore $KeyStore -alias $KeyAlias -keyalg RSA -keysize 2048 -validity 10000 -storepass $StorePass -keypass $KeyPass -dname "CN=Emroschool, OU=App, O=Emroschool, L=Tehran, C=IR"
  if ($LASTEXITCODE -ne 0) { Write-Error "keytool failed. Set ANDROID_KEYSTORE_PASSWORD/ANDROID_KEY_PASSWORD and retry." }
} else {
  Write-Host "Keystore already exists: $KeyStoreRel (skipped)."
}

Write-Host "=== Bubblewrap init ==="
$AndroidDir = Join-Path $RepoRoot "android"
if (-not (Test-Path (Join-Path $AndroidDir "twa-manifest.json"))) {
  & npx --yes @bubblewrap/cli init --manifest="$RepoRoot/twa-manifest.json" --directory="$AndroidDir"
  if ($LASTEXITCODE -ne 0) { Write-Error "bubblewrap init failed. See docs/twa/README.md." }
} else {
  Write-Host "TWA project already initialized in android/ (skipped init)."
}

$AndroidManifest = Join-Path $AndroidDir "twa-manifest.json"
$Twa = Get-Content $AndroidManifest -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Twa.signingKey.path -ne "emroschool-release.keystore") {
  $Twa.signingKey.path = "emroschool-release.keystore"
  $Twa | ConvertTo-Json -Depth 10 | Set-Content -Path $AndroidManifest -Encoding UTF8
  Write-Host "Adjusted signingKey.path inside android/twa-manifest.json"
}

Write-Host "=== Bubblewrap build ==="
Write-Host "Building signed APK (enter keystore/key passwords if prompted, or set ANDROID_KEYSTORE_PASSWORD/ANDROID_KEY_PASSWORD)."
& npx --yes @bubblewrap/cli build --directory="$AndroidDir" --skipPwaValidation
if ($LASTEXITCODE -ne 0) {
  Write-Error "bubblewrap build failed. If it failed while asking for passwords, re-run manually:
    npx @bubblewrap/cli build --directory android
   See docs/twa/README.md."
}

$SignedApk = Join-Path $AndroidDir "app-release-signed.apk"
if (-not (Test-Path $SignedApk)) { Write-Error "Signed APK not found at $SignedApk" }

Write-Host "=== Copy to public/apk ==="
$ApkDir = Join-Path $RepoRoot "public/apk"
New-Item -ItemType Directory -Force -Path $ApkDir | Out-Null
$Target = Join-Path $ApkDir "app-v$Version.apk"
Copy-Item -Path $SignedApk -Destination $Target -Force
Write-Host "Copied to $Target"

Write-Host "=== SHA-256 fingerprint (base64) ==="
$CertOutput = & keytool -printcert -jarfile $SignedApk 2>$null | Select-String -Pattern "SHA256" | Select-Object -First 1
if ($CertOutput -and $CertOutput.Line -match "SHA256:\s*([0-9A-F:]+)") {
  $Hex = ($Matches[1] -replace ":", "")
  $Bytes = New-Object byte[] ($Hex.Length / 2)
  for ($i = 0; $i -lt $Bytes.Length; $i++) { $Bytes[$i] = [Convert]::ToByte($Hex.Substring($i * 2, 2), 16) }
  $Fingerprint = [Convert]::ToBase64String($Bytes)
  Write-Host "ANDROID_SHA256_FINGERPRINT=$Fingerprint"
  Write-Host "ANDROID_PACKAGE_NAME=$([string]$Twa.packageId)"
  Write-Host "Put both values in the server .env, then deploy (see docs/twa/README.md)."
} else {
  Write-Warning "Could not extract fingerprint automatically. Run: keytool -printcert -jarfile android/app-release-signed.apk"
}
Write-Host "=== Done ==="
