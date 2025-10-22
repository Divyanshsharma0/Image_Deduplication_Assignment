<#
Interactive helper: show the process using TCP port 3001 and optionally stop it.

Usage (from repo root):
  powershell -ExecutionPolicy Bypass -File .\scripts\stop_3001.ps1

This script will:
- find the PID listening on port 3001
- print the process name and full command line
- ask for confirmation before attempting to stop the process
#>

# find listeners on port 3001
$entries = netstat -a -n -o | Select-String ":3001"
if (-not $entries) {
    Write-Host "No process found listening on port 3001."
    exit 0
}

Write-Host "Entries for port 3001:`n"
$entries | ForEach-Object { Write-Host $_ }

# extract PID(s)
$pids = ($entries -split "\s+") | Where-Object { $_ -match '^[0-9]+$' } | Select-Object -Unique
if (-not $pids) {
    # fallback parse by regex
    $pids = $entries | ForEach-Object { ($_ -replace '^\s+','') -split '\s+' | Select-Object -Last 1 }
}

$pids = $pids | Where-Object { $_ -ne '' } | Select-Object -Unique

foreach ($p in $pids) {
    Write-Host "`nInspecting PID: $p"
    try {
        $proc = Get-Process -Id $p -ErrorAction Stop | Select-Object Id,ProcessName,Path,StartTime
        $proc | Format-List
    } catch {
        Write-Host "Process $p not found via Get-Process"
    }
    try {
        $cli = Get-CimInstance Win32_Process -Filter "ProcessId=$p" | Select-Object ProcessId,CommandLine
        Write-Host "CommandLine: `n$($cli.CommandLine)`n"
    } catch {
        Write-Host "Could not retrieve command line for PID $p"
    }

    $answer = Read-Host "Do you want to stop PID $p? (y/N)"
    if ($answer -match '^[Yy]$') {
        try {
            Stop-Process -Id $p -ErrorAction Stop
            Write-Host "Stopped process $p"
        } catch {
            # Use ${} around variables to avoid parsing issues with colons
            Write-Host "Failed to stop process ${p}: ${_}"
            Write-Host "You can force-kill with: taskkill /PID ${p} /F"
        }
    } else {
        Write-Host "Skipped stopping PID $p"
    }
}