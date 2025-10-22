<#
Run local services for development:
 - Starts the Python FastAPI embedding service (uvicorn) in a new window
 - Starts the Node dev API server in the current window

Usage: from repo root
  powershell -ExecutionPolicy Bypass -File .\scripts\run_local.ps1
#>

param()

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Activate venv and start uvicorn in a new PowerShell window

# assume venv at repoRoot ".venv"
$hfFolder = Join-Path $repoRoot 'hf_service'

Write-Host "Starting embedding service in a new window..."
# Properly quote paths for Start-Process -ArgumentList
$activatePath = "$repoRoot\\.venv\\Scripts\\Activate.ps1"
$uvicornCmd = "Set-Location '$hfFolder'; & '$activatePath'; uvicorn hf_embedding_service:app --host 0.0.0.0 --port 8000 --reload"
Start-Process -FilePath powershell -ArgumentList '-NoExit', '-Command', $uvicornCmd
Start-Sleep -Seconds 2

Write-Host "Setting LOCAL_CLIP_URL and starting Node dev API server in this window..."
$env:LOCAL_CLIP_URL = 'http://localhost:8000'
Set-Location $repoRoot
Write-Host "Starting node server (npm run dev:server)..."
npm run dev:server
