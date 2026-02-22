# PowerShell Version Check and Setup

$minVersion = [Version]"5.1"
$currentVersion = $PSVersionTable.PSVersion

if ($currentVersion -lt $minVersion) {
    Write-Host "ERROR: PowerShell version $currentVersion is too old" -ForegroundColor Red
    Write-Host "Minimum required: $minVersion" -ForegroundColor Red
    Write-Host "Please upgrade PowerShell or use Windows PowerShell 5.1" -ForegroundColor Yellow
    exit 1
}

Write-Host "PowerShell version: $currentVersion" -ForegroundColor Green

# Continue with setup...
