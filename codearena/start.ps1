<#
.SYNOPSIS
    Starts all CodeArena services on Windows (MongoDB, Redis, Piston, Backend, Frontend).

.DESCRIPTION
    PowerShell equivalent of start.sh for Windows environments.
    Checks for Docker, Windows Services, and local ports for MongoDB, Redis, and Piston sandbox,
    then launches the Express backend and Vite frontend.

.PARAMETER NewWindows
    Launches Backend and Frontend in separate PowerShell console windows for isolated log viewing.

.PARAMETER SkipDocker
    Skips Docker container checks and launches services directly.

.EXAMPLE
    .\start.ps1
    Starts all services in the current console. Press Ctrl+C to stop.

.EXAMPLE
    .\start.ps1 -NewWindows
    Starts Backend and Frontend in dedicated windows.
#>

[CmdletBinding()]
param(
    [switch]$NewWindows,
    [switch]$SkipDocker,
    [switch]$Seed
)

$ErrorActionPreference = "Continue"

# Determine script root directory
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $ScriptDir) { $ScriptDir = Get-Location }

$BackendDir = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  CodeArena - Windows Startup Manager    " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Helper function to test TCP port connectivity quickly
function Test-PortOpen([string]$HostName, [int]$Port, [int]$TimeoutMs = 1000) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $result = $tcp.BeginConnect($HostName, $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne($TimeoutMs)
        if ($success -and $tcp.Connected) {
            $tcp.EndConnect($result)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

# Check Docker availability
$DockerAvailable = $false
if (-not $SkipDocker) {
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCmd) {
        try {
            docker info 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $DockerAvailable = $true
            } else {
                Write-Host "[INFO] Docker command found, but Docker daemon is not running." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "[INFO] Docker command check failed." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[INFO] Docker is not installed or not in PATH." -ForegroundColor Yellow
    }
}

# Helper to ensure a Docker container is running
function Ensure-Container([string]$Name, [string]$RunCmd) {
    if (-not $DockerAvailable) {
        return $false
    }

    try {
        $running = (docker ps -q -f "name=^/${Name}$" 2>$null)
        if ($running) {
            Write-Host "[OK] Container '$Name' is already running." -ForegroundColor Green
            return $true
        }

        $existing = (docker ps -aq -f "name=^/${Name}$" 2>$null)
        if ($existing) {
            Write-Host "Starting existing '$Name' container..." -ForegroundColor Cyan
            docker start $Name 2>&1 | Out-Null
            return $true
        }

        Write-Host "Creating and starting '$Name' container..." -ForegroundColor Cyan
        Invoke-Expression $RunCmd 2>&1 | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        Write-Warning "Failed to manage container '$Name': $_"
        return $false
    }
}

# ----------------------------------------------------
# 1. Start MongoDB (Port 27017)
# ----------------------------------------------------
Write-Host "`n[1/5] Checking MongoDB..." -ForegroundColor Cyan
$mongoPortOpen = Test-PortOpen "127.0.0.1" 27017 1000

if ($mongoPortOpen) {
    Write-Host "[OK] MongoDB is already running on port 27017." -ForegroundColor Green
} else {
    # Check Windows Services
    $mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if (-not $mongoService) {
        $mongoService = Get-Service -Name "*mongo*" -ErrorAction SilentlyContinue | Select-Object -First 1
    }

    if ($mongoService) {
        if ($mongoService.Status -eq 'Running') {
            Write-Host "[OK] MongoDB Windows service ($($mongoService.Name)) is running." -ForegroundColor Green
        } else {
            Write-Host "Starting MongoDB Windows service ($($mongoService.Name))..." -ForegroundColor Cyan
            try {
                Start-Service -Name $mongoService.Name -ErrorAction Stop
                Start-Sleep -Seconds 2
                if (Test-PortOpen "127.0.0.1" 27017 2000) {
                    Write-Host "[OK] MongoDB service started successfully." -ForegroundColor Green
                } else {
                    Write-Host "[OK] MongoDB service start command sent." -ForegroundColor Green
                }
            } catch {
                Write-Warning "Could not start MongoDB Windows service: $_"
            }
        }
    } elseif ($DockerAvailable) {
        Ensure-Container "codearena-mongo" "docker run -d --name codearena-mongo -p 27017:27017 mongo:latest" | Out-Null
    } else {
        Write-Warning "MongoDB is not running on port 27017 and no Windows service or Docker daemon was detected."
        Write-Warning "Please start MongoDB manually or ensure Docker Desktop is running."
    }
}

# ----------------------------------------------------
# 2. Start Redis (Port 6379) - BullMQ & Caching
# ----------------------------------------------------
Write-Host "`n[2/5] Checking Redis..." -ForegroundColor Cyan
$redisPortOpen = Test-PortOpen "127.0.0.1" 6379 1000

if ($redisPortOpen) {
    Write-Host "[OK] Redis is already running on port 6379." -ForegroundColor Green
} elseif ($DockerAvailable) {
    Ensure-Container "codearena-redis" "docker run -d --name codearena-redis -p 6379:6379 redis" | Out-Null
} else {
    Write-Warning "Redis is not running on port 6379 and Docker is not available."
    Write-Warning "BullMQ background queue requires Redis. If you have Docker Desktop, please start it."
}

# ----------------------------------------------------
# 3. Start Piston sandbox (Port 2000) - Code Execution
# ----------------------------------------------------
Write-Host "`n[3/5] Checking Piston Sandbox..." -ForegroundColor Cyan
$pistonPortOpen = Test-PortOpen "127.0.0.1" 2000 1000

if ($pistonPortOpen) {
    Write-Host "[OK] Piston sandbox is already running on port 2000." -ForegroundColor Green
} elseif ($DockerAvailable) {
    Ensure-Container "codearena-piston" "docker run -d --name codearena-piston --privileged -p 2000:2000 ohmygodvt95/piston" | Out-Null
} else {
    Write-Warning "Piston sandbox (port 2000) requires Docker Desktop to execute code submissions."
    Write-Warning "Ensure Docker Desktop is installed and started if you plan to test code submissions."
}

# ----------------------------------------------------
# Verify Node.js & Dependencies
# ----------------------------------------------------
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) {
    $npmCmd = (Get-Command npm -ErrorAction SilentlyContinue).Source
}

if (-not $npmCmd) {
    Write-Error "npm was not found on your system. Please install Node.js (https://nodejs.org/)."
    exit 1
}

# Ensure frontend Windows shims exist
$viteCmd = Join-Path $FrontendDir "node_modules\.bin\vite.cmd"
if (-not (Test-Path $viteCmd)) {
    Write-Host "`n[INFO] Frontend Windows binary shims not detected. Running 'npm install' in frontend..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    try {
        & $npmCmd install | Out-Null
    } finally {
        Pop-Location
    }
}

# Optional database seeding
if ($Seed) {
    Write-Host "`n[SEED] Seeding MongoDB with dummy users (Admin, Faculty, Students)..." -ForegroundColor Cyan
    Push-Location $BackendDir
    try {
        & $npmCmd run seed
    } finally {
        Pop-Location
    }
}

# ----------------------------------------------------
# 4 & 5. Start Backend and Frontend
# ----------------------------------------------------
$backendProc = $null
$frontendProc = $null

$cleanup = {
    Write-Host "`nStopping services..." -ForegroundColor Yellow
    if ($backendProc -and -not $backendProc.HasExited) {
        Write-Host "Stopping Backend (PID: $($backendProc.Id))..." -ForegroundColor Gray
        taskkill /PID $backendProc.Id /T /F 2>$null | Out-Null
    }
    if ($frontendProc -and -not $frontendProc.HasExited) {
        Write-Host "Stopping Frontend (PID: $($frontendProc.Id))..." -ForegroundColor Gray
        taskkill /PID $frontendProc.Id /T /F 2>$null | Out-Null
    }
    Write-Host "Services stopped." -ForegroundColor Green
}

if ($NewWindows) {
    Write-Host "`n[4/5] Starting Backend in separate window..." -ForegroundColor Cyan
    $backendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendDir'; Write-Host '=== Backend (Port 5001) ===' -ForegroundColor Green; npm run dev" -PassThru

    Write-Host "[5/5] Starting Frontend in separate window..." -ForegroundColor Cyan
    $frontendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontendDir'; Write-Host '=== Frontend (Port 5173) ===' -ForegroundColor Green; npm run dev" -PassThru
} else {
    Write-Host "`n[4/5] Starting Backend (npm run dev)..." -ForegroundColor Cyan
    $backendProc = Start-Process -FilePath $npmCmd -ArgumentList "run dev" -WorkingDirectory $BackendDir -PassThru -NoNewWindow

    Write-Host "[5/5] Starting Frontend (npm run dev)..." -ForegroundColor Cyan
    $frontendProc = Start-Process -FilePath $npmCmd -ArgumentList "run dev" -WorkingDirectory $FrontendDir -PassThru -NoNewWindow
}

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host "All services have been started!" -ForegroundColor Green
if ($backendProc) { Write-Host "Backend:       http://localhost:5001 (PID: $($backendProc.Id))" -ForegroundColor Cyan }
if ($frontendProc) { Write-Host "Frontend:      http://localhost:5173 (PID: $($frontendProc.Id))" -ForegroundColor Cyan }
Write-Host "MongoDB:       $(if (Test-PortOpen '127.0.0.1' 27017) { 'Running (Port 27017)' } else { 'Not Detected' })"
Write-Host "Redis:         $(if (Test-PortOpen '127.0.0.1' 6379) { 'Running (Port 6379)' } else { 'Not Detected' })"
Write-Host "Piston:        $(if (Test-PortOpen '127.0.0.1' 2000) { 'Running (Port 2000)' } else { 'Not Detected' })"
Write-Host "Press Ctrl+C to stop all applications (or run .\stop.ps1)." -ForegroundColor Yellow
Write-Host "=========================================`n" -ForegroundColor Green

# Monitor loop and handle Ctrl+C
try {
    while ($true) {
        if ($backendProc.HasExited -and $frontendProc.HasExited) {
            Write-Host "Both Backend and Frontend processes have exited." -ForegroundColor Yellow
            break
        }
        Start-Sleep -Milliseconds 500
    }
}
finally {
    & $cleanup
}

