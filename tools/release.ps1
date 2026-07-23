param(
    [switch]$DryRun,
    [string]$VersionOverride
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PackageJsonPath = Join-Path $ProjectRoot "package.json"

if (-not (Test-Path $PackageJsonPath)) {
    throw "package.json was not found at: $PackageJsonPath"
}

$PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
$PackageVersion = [string]$PackageJson.version

$Version = if ([string]::IsNullOrWhiteSpace($VersionOverride)) {
    $PackageVersion
}
else {
    $VersionOverride.Trim()
}

$TagName = "v$Version"

$PackageLockPath = Join-Path $ProjectRoot "package-lock.json"
$VersionFilePath = Join-Path $ProjectRoot "src\version.js"

if (
    -not [string]::IsNullOrWhiteSpace($VersionOverride) `
        -and -not $DryRun
) {
    throw "VersionOverride may only be used together with -DryRun."
}

if (
    -not [string]::IsNullOrWhiteSpace($VersionOverride) `
        -and $Version -ne $PackageVersion
) {
    Write-Host "Version override is being used for dry-run testing only."
    Write-Host "package.json version: $PackageVersion"
    Write-Host "Test version:         $Version"
    Write-Host ""
}

if (-not (Test-Path $PackageLockPath)) {
    throw "package-lock.json was not found at: $PackageLockPath"
}

$PackageLockVersion = node -p "require('./package-lock.json').version"

if ($LASTEXITCODE -ne 0) {
    throw "Unable to read the version from package-lock.json."
}

$PackageLockVersion = [string]$PackageLockVersion.Trim()

if ($PackageLockVersion -ne $PackageVersion) {
    throw "Version mismatch: package.json is $PackageVersion but package-lock.json is $PackageLockVersion."
}

if (Test-Path $VersionFilePath) {
    $VersionFileValue = node -p "require('./src/version.js').VERSION"

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the exported version from src\version.js."
    }

    $VersionFileValue = [string]$VersionFileValue.Trim()

    if ($VersionFileValue -ne $PackageVersion) {
        throw "Version mismatch: package.json is $PackageVersion but src\version.js exports $VersionFileValue."
    }
}

Write-Host ""
Write-Host "MasterForge Studio Release"
Write-Host "Version: $Version"
Write-Host "Tag:     $TagName"
Write-Host "Root:    $ProjectRoot"
Write-Host "Dry run: $DryRun"
Write-Host ""

Push-Location $ProjectRoot

try {
    $GitStatus = git status --porcelain

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read Git working tree status."
    }

    if ($GitStatus) {
        throw "The Git working tree is not clean. Commit or stash changes before releasing."
    }

    git rev-parse --verify --quiet "refs/tags/$TagName" | Out-Null

    if ($LASTEXITCODE -eq 0) {
        throw "Git tag $TagName already exists."
    }

    Write-Host "Working tree is clean."
    Write-Host "Tag is available."

    $InstallerPath = Join-Path `
        $ProjectRoot `
        "release\MasterForge-Studio-Setup-$Version-x64.exe"

    if ($DryRun) {
        Write-Host ""
        Write-Host "Dry run complete."
        Write-Host "Expected installer:"
        Write-Host $InstallerPath
        Write-Host ""
        Write-Host "No build or release actions were performed."
        exit 0
    }

    Write-Host ""
    Write-Host "Pre-release checks passed."
    Write-Host ""
    Write-Host "This will:"
    Write-Host "  - Build MasterForge Studio $Version"
    Write-Host "  - Create Git tag $TagName"
    Write-Host "  - Push the commit and tag to GitHub"
    Write-Host "  - Publish a GitHub pre-release"
    Write-Host "  - Upload the Windows installer"
    Write-Host "  - Trigger the WordPress release sync"
    Write-Host ""

    $Confirmation = Read-Host "Type RELEASE to continue"

    if ($Confirmation -cne "RELEASE") {
        throw "Release cancelled. The confirmation text did not match RELEASE."
    }

    Write-Host ""
    Write-Host "Building Windows installer..."
    Write-Host ""

    npm run dist:win

    if ($LASTEXITCODE -ne 0) {
        throw "Windows installer build failed."
    }

    if (-not (Test-Path $InstallerPath)) {
        throw "Expected installer was not found at: $InstallerPath"
    }

    $InstallerFile = Get-Item $InstallerPath

    if ($InstallerFile.Length -le 0) {
        throw "The installer exists but is empty: $InstallerPath"
    }

    Write-Host ""
    Write-Host "Installer build completed successfully."
    Write-Host "Installer: $InstallerPath"
    Write-Host "Size:      $([math]::Round($InstallerFile.Length / 1MB, 2)) MB"
}
finally {
    Pop-Location
}