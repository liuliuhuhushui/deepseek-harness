# Creates the "dsh Web" desktop shortcut bound to this bundle. Run by --install-shortcut.
$dir = $PSScriptRoot
$shortcut = [Environment]::GetFolderPath('Desktop') + '\dsh Web.lnk'
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcut)
$sc.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$sc.Arguments = '"' + $dir + '\dsh-web.vbs"'
$sc.IconLocation = $dir + '\dsh-web.ico'
$sc.WorkingDirectory = $dir
$sc.Description = 'dsh Web'
$sc.Save()
$shortcut
