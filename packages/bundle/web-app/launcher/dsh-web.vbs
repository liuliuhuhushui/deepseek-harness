' Invisible entry point used by the desktop shortcut: runs dsh-web.ps1 with no console window.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & fso.GetParentFolderName(WScript.ScriptFullName) & "\dsh-web.ps1""", 0, False
