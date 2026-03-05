Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Game-Data\game-manager"
WshShell.Run "cmd /c npm start", 0, False
