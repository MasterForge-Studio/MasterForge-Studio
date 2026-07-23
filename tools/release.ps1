param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PackageJsonPath = Join-Path $ProjectRoot "package.json"

if (-not (Test-Path $PackageJsonPath)) {
    throw "package.json was not found at: $PackageJsonPath"
}

$PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
$Version = [string]$PackageJson.version
$TagName = "v$Version"

$PackageLockPath = Join-Path $ProjectRoot "package-lock.json"
$VersionFilePath = Join-Path $ProjectRoot "src\version.js"

if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "No version was found in package.json."
}

if (-not (Test-Path $PackageLockPath)) {
    throw "package-lock.json was not found at: $PackageLockPath"
}

$PackageLockVersion = node -p "require('./package-lock.json').version"

if ($LASTEXITCODE -ne 0) {
    throw "Unable to read the version from package-lock.json."
}

$PackageLockVersion = [string]$PackageLockVersion.Trim()

if ($PackageLockVersion -ne $Version) {
    throw "Version mismatch: package.json is $Version but package-lock.json is $PackageLockVersion."
}

if (Test-Path $VersionFilePath) {
    $VersionFileValue = node -p "require('./src/version.js').VERSION"

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the exported version from src\version.js."
    }

    $VersionFileValue = [string]$VersionFileValue.Trim()

    if ($VersionFileValue -ne $Version) {
        throw "Version mismatch: package.json is $Version but src\version.js exports $VersionFileValue."
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

    if ($DryRun) {
        Write-Host ""
        Write-Host "Dry run complete. No build or release actions were performed."
        exit 0
    }

    Write-Host ""
    Write-Host "Pre-release checks passed."
    Write-Host "Build and publishing steps will be added next."
}
finally {
    Pop-Location
}