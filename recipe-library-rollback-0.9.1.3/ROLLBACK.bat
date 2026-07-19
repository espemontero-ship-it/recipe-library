@echo off
setlocal EnableExtensions
cd /d "%~dp0"
node rollback.mjs "%CD%"
if errorlevel 1 (
  echo.
  echo Rollback failed. Nothing else was changed.
  pause
  exit /b 1
)
echo.
echo Recipe Library restored to the pre-URL-patch importer.
echo A diagnostic ZIP was also created in the project root.
pause
