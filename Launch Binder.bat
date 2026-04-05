@echo off
title Pendragon GM's Binder

echo.
echo  ==========================================
echo   Pendragon GM's Binder — Launching...
echo  ==========================================
echo.

:: Change to the folder this bat file lives in
cd /d "%~dp0"

:: Try Python 3 first (most common)
python --version >nul 2>&1
if %errorlevel% == 0 (
    start "" "http://localhost:8765"
    python server.py
    goto done
)

:: Try py launcher (alternate Python install)
py --version >nul 2>&1
if %errorlevel% == 0 (
    start "" "http://localhost:8765"
    py server.py
    goto done
)

:: No Python found
echo  Python not found!
echo.
echo  Please install Python from https://python.org
echo  During install, check the box that says "Add Python to PATH"
echo  Then close and reopen this launcher.
echo.
pause
exit

:done
echo.
echo  Goodbye!
pause
