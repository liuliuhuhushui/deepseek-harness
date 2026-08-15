# dsh Web desktop launcher + tray. Installed by: dsh web --install-shortcut
# - opens the waiting page in the default browser FIRST, then does the slow work
# - reports real progress through dsh-web-status.json (served by dsh-web-status.mjs)
# - the service is resident; the tray icon is its visible off switch
$ErrorActionPreference = 'SilentlyContinue'
$base = 'http://127.0.0.1'
$dir = $PSScriptRoot                       # the installed bundle: $DSH_HOME/web-app
$repo = '__REPO__'                         # the dsh source checkout, baked in at install time
$state = Join-Path $dir 'dsh-web.state'
$statusFile = Join-Path $dir 'dsh-web-status.json'
$launch = ('file:///' + (Join-Path $dir 'dsh-web-launching.html')) -replace '\\', '/'
$icoPath = Join-Path $dir 'dsh-web.ico'
$statusServerId = 0

function Write-Stage([string]$stage, [string]$text, [int]$port = 0) {
  $json = @{ stage = $stage; text = $text; port = $port } | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($statusFile, $json)
}
function Test-PortOpen([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect('127.0.0.1', $port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(400)) { return $false }
    $client.EndConnect($iar)
    return $true
  } catch { return $false } finally { $client.Close() }
}
function Test-Dsh([int]$port) {
  if (-not (Test-PortOpen $port)) { return $false }
  try {
    return ((New-Object System.Net.WebClient).DownloadString("$base`:$port/") -match 'DeepSeek Harness')
  } catch { return $false }
}
function Test-ServerProcess {
  return [bool](Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'bin\.ts' })
}
function Start-Server([int]$port) {
  # per-port logs: a shared log path would lock and silently kill concurrent starts.
  # Returns the child PID so a failed attempt can be stopped precisely.
  $proc = Start-Process -FilePath 'node' -WindowStyle Hidden -WorkingDirectory $repo -PassThru `
    -ArgumentList '--import','tsx/esm','apps/cli/src/bin.ts','web','--port',"$port" `
    -RedirectStandardOutput (Join-Path $dir ".dsh-web-$port.log") -RedirectStandardError (Join-Path $dir ".dsh-web-$port.err.log")
  return $proc.Id
}
function Start-StatusServer {
  # serves the stage file to the waiting page; an already-running one is reused
  if (Test-PortOpen 3199) { return }
  $proc = Start-Process -FilePath 'node' -WindowStyle Hidden -WorkingDirectory $dir -PassThru `
    -ArgumentList (Join-Path $dir 'dsh-web-status.mjs')
  $script:statusServerId = $proc.Id
}
function Stop-DshServer {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'bin\.ts' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

# --- second instance while another is mid-boot or the tray is up: just open a tab ---
$self = $PID
$trayAlready = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.ProcessId -ne $self -and $_.CommandLine -match 'dsh-web-app\.ps1' }

$port = 0
if (Test-Path $state) {
  $saved = [int](Get-Content $state -TotalCount 1)
  if (Test-Dsh $saved) { $port = $saved } else { Remove-Item $state -Force }
}

if ($port -gt 0) {
  Start-Process "$base`:$port/"          # reuse: straight into the app tab
  if ($trayAlready) { exit }
} else {
  $midBoot = (Test-PortOpen 3199) -and (Test-ServerProcess)
  if ($midBoot) { Start-Process $launch; exit }   # another instance is already booting a server
  Start-StatusServer
  Write-Stage 'booting' 'Looking for a running server…'
  Start-Process $launch                  # waiting-page tab FIRST, slow work after
  if (-not $trayAlready) {
    # a manual server defaults to 3080..3085 territory; check those
    foreach ($p in 3080..3085) { if (Test-Dsh $p) { $port = $p; break } }
    if ($port -eq 0 -and (Test-ServerProcess)) {
      Write-Stage 'booting' 'Found a server mid-boot; waiting for it…'
      $tries = 0
      while ($port -eq 0 -and $tries -lt 20) {
        Start-Sleep -Seconds 1
        foreach ($p in 3080..3085) { if (Test-Dsh $p) { $port = $p; break } }
        $tries++
      }
    }
    if ($port -eq 0) {                                 # nothing: start our own
      foreach ($p in 3080..3085) {
        Write-Stage 'booting' "Starting the server process (port $p, ~20s on first run)…"
        $log = Join-Path $dir ".dsh-web-$p.log"
        $errLog = Join-Path $dir ".dsh-web-$p.err.log"
        Remove-Item $log, $errLog -Force
        try { $childId = Start-Server $p } catch { continue }
        $ready = $false
        for ($i = 0; $i -lt 40; $i++) {
          Start-Sleep -Seconds 1
          # the URL line in OUR log is the readiness signal — immune to network weirdness
          if ((Test-Path $log) -and ((Get-Content $log -Raw) -match 'dsh web: ')) { $ready = $true; break }
          if ((Test-Path $errLog) -and ((Get-Content $errLog -Raw) -match 'EADDRINUSE|EACCES')) { break }
          if (-not (Get-Process -Id $childId -ErrorAction SilentlyContinue)) { break }
        }
        if ($ready) {
          # healthy per its log; the browser must be able to reach it too
          $reachable = $false
          for ($i = 0; $i -lt 5; $i++) { if (Test-Dsh $p) { $reachable = $true; break }; Start-Sleep -Seconds 1 }
          if ($reachable) { $port = $p; Set-Content $state $p; break }
          Write-Stage 'error' 'Server is up but loopback connections are blocked: check proxy TUN mode or firewall'
        }
        Stop-Process -Id $childId -Force               # dead, unready, or unreachable: next port
      }
    }
    if ($port -gt 0) { Write-Stage 'ready' 'Ready — taking you there…' $port }
  }
  if ($trayAlready) { exit }                           # first instance's tray owns the lifecycle
}

# --- tray icon: the visible handle of the resident service ---
if (-not (Test-ServerProcess)) { exit }    # nothing started (all ports failed): no tray for nothing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = New-Object System.Drawing.Icon($icoPath)
$notifyIcon.Text = 'dsh Web is running'
$notifyIcon.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openDsh = {
  $p = 0
  if (Test-Path $state) { $p = [int](Get-Content $state -TotalCount 1) }
  if ($p -eq 0) { foreach ($c in 3080..3085) { if (Test-Dsh $c) { $p = $c; break } } }
  if ($p -gt 0) { Start-Process "$base`:$p/" }
}
$openItem = $menu.Items.Add('Open dsh Web')
$openItem.add_Click($openDsh)
$quit = $false
$quitItem = $menu.Items.Add('Quit DeepSeek Harness')
$quitItem.add_Click({ $script:quit = $true; Stop-DshServer })
$notifyIcon.ContextMenuStrip = $menu
# left click shows the menu (delayed one beat so a double click can cancel it);
# double click opens the page and dismisses any menu already showing
$showContextMenu = [System.Windows.Forms.NotifyIcon].GetMethod('ShowContextMenu', [System.Reflection.BindingFlags]'NonPublic, Instance')
$clickTimer = New-Object System.Windows.Forms.Timer
$clickTimer.Interval = [System.Windows.Forms.SystemInformation]::DoubleClickTime + 50
$clickTimer.add_Tick({ $clickTimer.Stop(); $showContextMenu.Invoke($notifyIcon, @()) })
$notifyIcon.add_MouseClick({
  param($sender, $e)
  if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) { $clickTimer.Stop(); $clickTimer.Start() }
})
$notifyIcon.add_MouseDoubleClick({
  param($sender, $e)
  $clickTimer.Stop()
  $menu.Close()
  & $openDsh
})

# DoEvents every 100ms keeps the menu snappy; liveness is polled every ~3s.
$aliveIn = 0
while (-not $quit) {
  [System.Windows.Forms.Application]::DoEvents()
  Start-Sleep -Milliseconds 100
  if (++$aliveIn % 30 -eq 0 -and -not (Test-ServerProcess)) { break }
}
if ($statusServerId -gt 0) { Stop-Process -Id $statusServerId -Force }
$notifyIcon.Visible = $false
Remove-Item $state -Force
