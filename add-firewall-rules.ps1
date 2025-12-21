# PowerShell script to add Windows Firewall rules and Port Proxies for Stremio NAS
# Run this script as Administrator: Right-click PowerShell -> Run as Administrator
# This script configures networking to allow LAN access to Stremio NAS running in Podman

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Stremio NAS Network Configuration Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    exit 1
}

# ============================================
# SECTION 1: Windows Firewall Rules
# ============================================
Write-Host "STEP 1: Configuring Windows Firewall Rules..." -ForegroundColor Cyan
Write-Host ""

# Add firewall rule for Caddy HTTP (port 80) - for Let's Encrypt certificate verification
# Note: These are for the separate Caddy proxy project (see ./proxy folder)
try {
    $existingRule = Get-NetFirewallRule -DisplayName "Stremio NAS Caddy HTTP" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  Firewall rule for port 80 already exists. Enabling it..." -ForegroundColor Yellow
        Enable-NetFirewallRule -DisplayName "Stremio NAS Caddy HTTP"
    } else {
        New-NetFirewallRule -DisplayName "Stremio NAS Caddy HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow | Out-Null
        Write-Host "  [OK] Firewall rule for port 80 (Caddy HTTP) added successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] Failed to add firewall rule for port 80: $_" -ForegroundColor Red
}

# Add firewall rule for Caddy HTTPS (port 443) - for HTTPS addon access
try {
    $existingRule = Get-NetFirewallRule -DisplayName "Stremio NAS Caddy HTTPS" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  Firewall rule for port 443 already exists. Enabling it..." -ForegroundColor Yellow
        Enable-NetFirewallRule -DisplayName "Stremio NAS Caddy HTTPS"
    } else {
        New-NetFirewallRule -DisplayName "Stremio NAS Caddy HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow | Out-Null
        Write-Host "  [OK] Firewall rule for port 443 (Caddy HTTPS) added successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] Failed to add firewall rule for port 443: $_" -ForegroundColor Red
}

# Add firewall rule for Stremio NAS Addon (port 1222)
try {
    $existingRule = Get-NetFirewallRule -DisplayName "Stremio NAS Addon" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  Firewall rule for port 1222 already exists. Enabling it..." -ForegroundColor Yellow
        Enable-NetFirewallRule -DisplayName "Stremio NAS Addon"
    } else {
        New-NetFirewallRule -DisplayName "Stremio NAS Addon" -Direction Inbound -LocalPort 1222 -Protocol TCP -Action Allow | Out-Null
        Write-Host "  [OK] Firewall rule for port 1222 (Addon) added successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] Failed to add firewall rule for port 1222: $_" -ForegroundColor Red
}

# Add firewall rule for Stremio NAS API (port 3001)
try {
    $existingRule = Get-NetFirewallRule -DisplayName "Stremio NAS API" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  Firewall rule for port 3001 already exists. Enabling it..." -ForegroundColor Yellow
        Enable-NetFirewallRule -DisplayName "Stremio NAS API"
    } else {
        New-NetFirewallRule -DisplayName "Stremio NAS API" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow | Out-Null
        Write-Host "  [OK] Firewall rule for port 3001 (API) added successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] Failed to add firewall rule for port 3001: $_" -ForegroundColor Red
}

# Add firewall rule for Admin UI (port 8081)
try {
    $existingRule = Get-NetFirewallRule -DisplayName "Stremio NAS Admin" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Write-Host "  Firewall rule for port 8081 already exists. Enabling it..." -ForegroundColor Yellow
        Enable-NetFirewallRule -DisplayName "Stremio NAS Admin"
    } else {
        New-NetFirewallRule -DisplayName "Stremio NAS Admin" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow | Out-Null
        Write-Host "  [OK] Firewall rule for port 8081 (Admin UI) added successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] Failed to add firewall rule for port 8081: $_" -ForegroundColor Red
}

Write-Host ""

# ============================================
# SECTION 2: Port Proxies for WSL2/Podman
# ============================================
Write-Host "STEP 2: Configuring Port Proxies for Podman (WSL2)..." -ForegroundColor Cyan
Write-Host ""

# Get Podman machine IP address
Write-Host "  Getting Podman machine IP address..." -ForegroundColor Gray
try {
    $podmanIP = (wsl -d podman-machine-default ip addr show eth0 2>$null | Select-String -Pattern "inet (\d+\.\d+\.\d+\.\d+)" | ForEach-Object { $_.Matches.Groups[1].Value })
    
    if ([string]::IsNullOrEmpty($podmanIP)) {
        # Fallback: try using podman machine ssh
        $ipOutput = podman machine ssh "ip -4 addr show eth0" 2>$null
        $podmanIP = ($ipOutput | Select-String -Pattern "inet (\d+\.\d+\.\d+\.\d+)" | ForEach-Object { $_.Matches.Groups[1].Value })
    }
    
    if ([string]::IsNullOrEmpty($podmanIP)) {
        Write-Host "  [WARN] Could not get Podman machine IP. Make sure Podman is running." -ForegroundColor Yellow
        Write-Host "  Run 'podman machine start' and try again." -ForegroundColor Yellow
    } else {
        Write-Host "  Podman Machine IP: $podmanIP" -ForegroundColor Green
        
        # Remove existing port proxies (in case they have old IPs)
        Write-Host "  Removing old port proxies (if any)..." -ForegroundColor Gray
        netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0 2>$null
        netsh interface portproxy delete v4tov4 listenport=443 listenaddress=0.0.0.0 2>$null
        netsh interface portproxy delete v4tov4 listenport=1222 listenaddress=0.0.0.0 2>$null
        netsh interface portproxy delete v4tov4 listenport=3001 listenaddress=0.0.0.0 2>$null
        netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0 2>$null
        
        # Add port proxies
        netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=80 connectaddress=$podmanIP
        Write-Host "  [OK] Port proxy: 0.0.0.0:80 -> ${podmanIP}:80 (Caddy HTTP)" -ForegroundColor Green
        
        netsh interface portproxy add v4tov4 listenport=443 listenaddress=0.0.0.0 connectport=443 connectaddress=$podmanIP
        Write-Host "  [OK] Port proxy: 0.0.0.0:443 -> ${podmanIP}:443 (Caddy HTTPS)" -ForegroundColor Green
        
        netsh interface portproxy add v4tov4 listenport=1222 listenaddress=0.0.0.0 connectport=1222 connectaddress=$podmanIP
        Write-Host "  [OK] Port proxy: 0.0.0.0:1222 -> ${podmanIP}:1222 (Addon)" -ForegroundColor Green
        
        netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=$podmanIP
        Write-Host "  [OK] Port proxy: 0.0.0.0:3001 -> ${podmanIP}:3001 (API)" -ForegroundColor Green
        
        netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$podmanIP
        Write-Host "  [OK] Port proxy: 0.0.0.0:8081 -> ${podmanIP}:8081 (Admin UI)" -ForegroundColor Green
    }
} catch {
    Write-Host "  [FAIL] Error setting up port proxies: $_" -ForegroundColor Red
}

Write-Host ""

# ============================================
# SECTION 3: Summary
# ============================================
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Configuration Summary" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Firewall Rules:" -ForegroundColor Yellow
Get-NetFirewallRule -DisplayName "Stremio NAS*" -ErrorAction SilentlyContinue | 
    Select-Object DisplayName, Enabled, Direction, Action | 
    Format-Table -AutoSize

Write-Host "Port Proxies:" -ForegroundColor Yellow
netsh interface portproxy show all

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Done! Network configuration complete." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your services should now be accessible from your LAN:" -ForegroundColor Cyan

# Get Windows LAN IP for display (filter out loopback, vEthernet, and APIPA 169.254.x.x addresses)
$windowsIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notlike "*Loopback*" -and 
    $_.InterfaceAlias -notlike "*vEthernet*" -and 
    $_.IPAddress -notlike "169.254.*" -and
    $_.IPAddress -notlike "127.*" -and
    $_.PrefixOrigin -ne "WellKnown"
} | Select-Object -First 1).IPAddress

if ([string]::IsNullOrEmpty($windowsIP)) {
    # Fallback: try to get any 192.168.x.x or 10.x.x.x address
    $windowsIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"
    } | Select-Object -First 1).IPAddress
}

if ($windowsIP) {
    Write-Host "  Addon (HTTPS): https://<YOUR_DOMAIN>/manifest.json" -ForegroundColor Green
    Write-Host "  Addon (HTTP):  http://${windowsIP}:1222/manifest.json" -ForegroundColor White
    Write-Host "  API:           http://${windowsIP}:3001/api/files" -ForegroundColor White
    Write-Host "  Admin UI:      http://${windowsIP}:8081" -ForegroundColor White
} else {
    Write-Host "  Addon (HTTPS): https://<YOUR_DOMAIN>/manifest.json" -ForegroundColor Green
    Write-Host "  Addon (HTTP):  http://<YOUR_IP>:1222/manifest.json" -ForegroundColor White
    Write-Host "  API:           http://<YOUR_IP>:3001/api/files" -ForegroundColor White
    Write-Host "  Admin UI:      http://<YOUR_IP>:8081" -ForegroundColor White
    Write-Host ""
    Write-Host "  To find your IP, run: ipconfig | findstr IPv4" -ForegroundColor Gray
}

Write-Host ""
Write-Host "NOTE: The Podman machine IP may change after reboot." -ForegroundColor Yellow
Write-Host "      Run this script again after rebooting to update port proxies." -ForegroundColor Yellow
Write-Host ""

