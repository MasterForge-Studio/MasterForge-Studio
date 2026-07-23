param(
    [switch]$DryRun,
    [switch]$BuildOnly,
    [switch]$PrepareOnly,
    [string]$VersionOverride,
    [string]$ReleaseVersion
)

$ErrorActionPreference = "Stop"

if (
    -not [string]::IsNullOrWhiteSpace($ReleaseVersion) `
        -and $DryRun
) {
    throw "ReleaseVersion cannot be used together with DryRun."
}

if (
    -not [string]::IsNullOrWhiteSpace($ReleaseVersion) `
        -and $BuildOnly
) {
    throw "ReleaseVersion cannot be used together with BuildOnly."
}

if (
    -not [string]::IsNullOrWhiteSpace($ReleaseVersion) `
        -and -not [string]::IsNullOrWhiteSpace($VersionOverride)
) {
    throw "ReleaseVersion and VersionOverride cannot be used together."
}

if (-not [string]::IsNullOrWhiteSpace($ReleaseVersion)) {
    $ReleaseVersion = $ReleaseVersion.Trim()

    if ($ReleaseVersion -notmatch '^\d+\.\d+\.\d+-(alpha|beta)(?:\.[0-9A-Za-z.-]+)?$') {
        throw "ReleaseVersion must look like 0.3.2-alpha or 0.3.2-beta.1."
    }
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PackageJsonPath = Join-Path $ProjectRoot "package.json"

if (-not (Test-Path $PackageJsonPath)) {
    throw "package.json was not found at: $PackageJsonPath"
}

$PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
$PackageVersion = [string]$PackageJson.version

$Version = if (-not [string]::IsNullOrWhiteSpace($ReleaseVersion)) {
    $ReleaseVersion
}
elseif (-not [string]::IsNullOrWhiteSpace($VersionOverride)) {
    $VersionOverride.Trim()
}
else {
    $PackageVersion
}

$TagName = "v$Version"

$PackageLockPath = Join-Path $ProjectRoot "package-lock.json"
$VersionFilePath = Join-Path $ProjectRoot "src\version.js"
$ChangelogPath = Join-Path $ProjectRoot "CHANGELOG.md"

if (
    -not [string]::IsNullOrWhiteSpace($VersionOverride) `
        -and -not $DryRun
) {
    throw "VersionOverride may only be used together with -DryRun."
}

$SelectedModes = @(
    $DryRun,
    $BuildOnly,
    $PrepareOnly
) | Where-Object { $_ }

if ($SelectedModes.Count -gt 1) {
    throw "DryRun, BuildOnly and PrepareOnly cannot be used together."
}

if ($PrepareOnly -and [string]::IsNullOrWhiteSpace($ReleaseVersion)) {
    throw "PrepareOnly requires ReleaseVersion."
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

$PackageLockVersion = node -e `
    "process.stdout.write(String(require(process.argv[1]).version))" `
    $PackageLockPath

if ($LASTEXITCODE -ne 0) {
    throw "Unable to read the version from package-lock.json."
}

$PackageLockVersion = [string]$PackageLockVersion.Trim()

if ($PackageLockVersion -ne $PackageVersion) {
    throw "Version mismatch: package.json is $PackageVersion but package-lock.json is $PackageLockVersion."
}

if (Test-Path $VersionFilePath) {
    $VersionFileValue = node -e `
        "process.stdout.write(String(require(process.argv[1]).VERSION))" `
        $VersionFilePath

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read the exported version from src\version.js."
    }

    $VersionFileValue = [string]$VersionFileValue.Trim()

    if ($VersionFileValue -ne $PackageVersion) {
        throw "Version mismatch: package.json is $PackageVersion but src\version.js exports $VersionFileValue."
    }
}

if (-not $PrepareOnly -and -not $DryRun -and -not $BuildOnly) {
    if (-not (Test-Path $ChangelogPath)) {
        throw "CHANGELOG.md was not found at: $ChangelogPath"
    }

    $ChangelogContent = Get-Content $ChangelogPath -Raw
    $ChangelogHeading = "## v$Version"
    $ChangelogPattern = "(?ms)^" +
    [regex]::Escape($ChangelogHeading) +
    "\s*\r?\n(?<notes>.*?)(?=^##\s|\z)"

    $ChangelogMatch = [regex]::Match(
        $ChangelogContent,
        $ChangelogPattern
    )

    if (-not $ChangelogMatch.Success) {
        throw "CHANGELOG.md does not contain a section headed '$ChangelogHeading'."
    }

    $ReleaseNotes = $ChangelogMatch.Groups["notes"].Value.Trim()

    if ([string]::IsNullOrWhiteSpace($ReleaseNotes)) {
        throw "The changelog section for $Version is empty."
    }

    $ReleaseNotesPath = Join-Path `
        $ProjectRoot `
        "release\release-notes-$Version.md"
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
    $RequiredCommands = @(
        "git",
        "node",
        "npm",
        "gh"
    )

    foreach ($CommandName in $RequiredCommands) {
        if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
            throw "Required command '$CommandName' is not installed or is not available in PATH."
        }
    }

    gh auth status 2>&1 | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI is not authenticated. Run: gh auth login"
    }

    Write-Host "Required release tools are available."
    Write-Host "GitHub CLI authentication is valid."
    Write-Host ""
    $CurrentBranch = git branch --show-current

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to determine the current Git branch."
    }

    $CurrentBranch = [string]$CurrentBranch.Trim()

    if ($CurrentBranch -ne "main") {
        throw "Releases must be created from the main branch. Current branch: $CurrentBranch"
    }

    Write-Host "Fetching the latest GitHub repository state..."

    git fetch origin --tags

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to fetch the latest commits and tags from GitHub."
    }

    $LocalCommit = git rev-parse HEAD
    $RemoteCommit = git rev-parse origin/main

    if (
        $LASTEXITCODE -ne 0 `
            -or [string]::IsNullOrWhiteSpace($RemoteCommit)
    ) {
        throw "Unable to compare the local branch with origin/main."
    }

    if ($LocalCommit.Trim() -ne $RemoteCommit.Trim()) {
        throw "Local main does not match origin/main. Pull or push your changes before releasing."
    }

    Write-Host "Current branch is main."
    Write-Host "Local main matches origin/main."
    $GitStatus = git status --porcelain

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read Git working tree status."
    }

    if ($GitStatus) {
        throw "The Git working tree is not clean. Commit or stash changes before releasing."
    }

    if (-not $BuildOnly -and -not $PrepareOnly) {
        git rev-parse --verify --quiet "refs/tags/$TagName" | Out-Null

        if ($LASTEXITCODE -eq 0) {
            throw "Git tag $TagName already exists."
        }

        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        gh release view $TagName --json tagName 2>$null | Out-Null
        $GitHubReleaseExists = ($LASTEXITCODE -eq 0)

        $ErrorActionPreference = $PreviousErrorActionPreference

        if ($GitHubReleaseExists) {
            throw "GitHub release $TagName already exists."
        }

        Write-Host "Git tag is available."
        Write-Host "GitHub release name is available."
    }
    else {
        if ($PrepareOnly) {
            Write-Host "Prepare-only mode: tag and GitHub release checks skipped."
        }
        else {
            Write-Host "Build-only mode: tag and GitHub release checks skipped."
        }
    }

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

    if ($PrepareOnly) {
        Write-Host "  - Update package.json to $Version"
        Write-Host "  - Update package-lock.json to $Version"
        Write-Host "  - Stop without staging, committing, building or publishing"
    }
    else {
        Write-Host "  - Build MasterForge Studio $Version"
        Write-Host "  - Generate the installer SHA-256 checksum"

        if ($BuildOnly) {
            Write-Host "  - Stop without creating a tag or GitHub release"
        }
        else {
            Write-Host "  - Create Git tag $TagName"
            Write-Host "  - Push the commit and tag to GitHub"
            Write-Host "  - Publish a GitHub pre-release"
            Write-Host "  - Upload the installer and checksum"
            Write-Host "  - Trigger the WordPress release sync"
        }
    }

    Write-Host ""

    $Confirmation = Read-Host "Type RELEASE to continue"

    if ($Confirmation -cne "RELEASE") {
        Write-Host ""
        Write-Host "Release cancelled. No changes were made."
        exit 0
    }

    if (-not [string]::IsNullOrWhiteSpace($ReleaseVersion)) {
        Write-Host ""
        Write-Host "Preparing project version $ReleaseVersion..."

        npm version $ReleaseVersion --no-git-tag-version

        if ($LASTEXITCODE -ne 0) {
            throw "npm failed to update package.json and package-lock.json."
        }

        $UpdatedPackageVersion = node -e `
            "process.stdout.write(String(require(process.argv[1]).version))" `
            $PackageJsonPath

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to verify the updated package.json version."
        }

        $UpdatedPackageLockVersion = node -e `
            "process.stdout.write(String(require(process.argv[1]).version))" `
            $PackageLockPath

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to verify the updated package-lock.json version."
        }

        $UpdatedPackageVersion = [string]$UpdatedPackageVersion.Trim()
        $UpdatedPackageLockVersion = [string]$UpdatedPackageLockVersion.Trim()

        if ($UpdatedPackageVersion -ne $ReleaseVersion) {
            throw "package.json was not updated to $ReleaseVersion."
        }

        if ($UpdatedPackageLockVersion -ne $ReleaseVersion) {
            throw "package-lock.json was not updated to $ReleaseVersion."
        }
        if ($PrepareOnly) {
            Write-Host ""
            Write-Host "Prepare-only mode complete."
            Write-Host "package.json and package-lock.json were updated but not staged or committed."
            Write-Host "Review the changes with: git diff"
            exit 0
        }

        git add package.json package-lock.json

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to stage the version files."
        }

        git commit -m "Prepare MasterForge Studio v$ReleaseVersion"

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to commit the version update."
        }

        Write-Host "Version files updated and committed."
    }

    Write-Host ""
    Write-Host "Preparing Windows installer build..."

    if (Test-Path $InstallerPath) {
        Write-Host "Removing existing installer for version $Version..."
        Remove-Item $InstallerPath -Force
    }

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

    $ChecksumPath = "$InstallerPath.sha256"
    $InstallerChecksum = (
        Get-FileHash `
            -Path $InstallerPath `
            -Algorithm SHA256
    ).Hash.ToLowerInvariant()

    "$InstallerChecksum  $($InstallerFile.Name)" |
    Set-Content `
        -Path $ChecksumPath `
        -Encoding ASCII

    if (-not (Test-Path $ChecksumPath)) {
        throw "Installer checksum file was not created at: $ChecksumPath"
    }

    Write-Host ""
    Write-Host "Installer build completed successfully."
    Write-Host "Installer: $InstallerPath"
    Write-Host "Size:      $([math]::Round($InstallerFile.Length / 1MB, 2)) MB"
    Write-Host "SHA-256:   $InstallerChecksum"
    Write-Host "Checksum:  $ChecksumPath"
    if ($BuildOnly) {
        Write-Host ""
        Write-Host "Build-only mode complete."
        Write-Host "No Git tag, push, or GitHub release was created."
        exit 0
    }
    Write-Host ""
    Write-Host "Creating Git tag $TagName..."

    git tag -a $TagName -m "MasterForge Studio $Version"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Git tag $TagName."
    }

    Write-Host "Pushing current branch..."

    git push origin HEAD

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to push the current branch to GitHub."
    }

    Write-Host "Pushing tag $TagName..."

    git push origin $TagName

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to push Git tag $TagName."
    }

    $ReleaseTitle = "MasterForge Studio v$Version"

    Write-Host ""
    Write-Host "Publishing GitHub pre-release..."
    $ReleaseNotesDirectory = Split-Path -Parent $ReleaseNotesPath

    if (-not (Test-Path $ReleaseNotesDirectory)) {
        New-Item `
            -ItemType Directory `
            -Path $ReleaseNotesDirectory `
            -Force |
        Out-Null
    }

    $ReleaseNotes |
    Set-Content `
        -Path $ReleaseNotesPath `
        -Encoding UTF8

    gh release create `
        $TagName `
        $InstallerPath `
        $ChecksumPath `
        --verify-tag `
        --prerelease `
        --latest=false `
        --title $ReleaseTitle `
        --notes-file $ReleaseNotesPath

    if ($LASTEXITCODE -ne 0) {
        throw "GitHub pre-release creation failed."
    }

    Write-Host ""
    Write-Host "Release published successfully."
    Write-Host "GitHub tag: $TagName"
    Write-Host "Installer:  $InstallerPath"
    Write-Host ""
    Write-Host "The GitHub release event will now trigger the WordPress sync workflow."
}
finally {
    Pop-Location
}