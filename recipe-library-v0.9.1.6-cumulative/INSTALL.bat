@echo off
setlocal
cd /d "%~dp0"
node install.mjs "%CD%"
echo.
pause
