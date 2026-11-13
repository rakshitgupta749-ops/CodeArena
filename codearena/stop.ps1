<#
.SYNOPSIS
    Stops all CodeArena services on Windows (Backend, Frontend, and optional Docker containers).

.DESCRIPTION
    Kills any processes listening on ports 5001 (Backend) and 5173 (Frontend),
    and optionally stops the Docker containers (codearena-mongo, codearena-redis, codearena-piston).

.PARAMETER StopDocker
    Also stops the Docker containers (codearena-mongo, codearena-redis, codearena-piston).
#>

[CmdletBinding()]
param(
    [switch]$StopDocker
)

Write-Host "=========================================" -ForegroundColor Yellow
Write-Host "  CodeArena - Windows Shutdown Manager   " -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow

# Helper to stop processes listening on specific ports
function Stop-ProcessByPort([int]$Port, [string]$ServiceName) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) {
            $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($p in $pids) {
                if ($p -and $p -ne 0) {
                    Write-Host "Terminating $ServiceName on port $Port (PID: $p)..." -ForegroundColor Cyan
                    taskkill /PID $p /T /F 2>$null | Out-Null
                }
            }
            Write-Host "[OK] $ServiceName on port $Port stopped." -ForegroundColor Green
        } else {
            Write-Host "[OK] No process listening on port $Port ($ServiceName)." -ForegroundColor Gray
        }
    } catch {
        Write-Warning "Could not stop process on port ${Port}: $_"
    }
}

# Stop Backend (Port 5001)
Stop-ProcessByPort -Port 5001 -ServiceName "Backend"

# Stop Frontend (Port 5173)
Stop-ProcessByPort -Port 5173 -ServiceName "Frontend"

# Stop Docker containers if requested
if ($StopDocker) {
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCmd) {
        Write-Host "`nStopping Docker containers..." -ForegroundColor Cyan
        $containers = @("codearena-mongo", "codearena-redis", "codearena-piston")
        foreach ($container in $containers) {
            $running = (docker ps -q -f "name=^/${container}$" 2>$null)
            if ($running) {
                Write-Host "Stopping container '$container'..." -ForegroundColor Cyan
                docker stop $container 2>&1 | Out-Null
                Write-Host "[OK] Container '$container' stopped." -ForegroundColor Green
            }
        }
    }
}

Write-Host "`nAll targeted services have been stopped." -ForegroundColor Green

