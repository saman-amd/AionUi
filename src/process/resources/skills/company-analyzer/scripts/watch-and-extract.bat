@echo off
title Document Auto-Extractor (Watching for changes)

if "%~1"=="" (
    echo Usage: watch-and-extract.bat "C:\path\to\company\folder"
    echo.
    echo This script watches a folder for new/changed documents
    echo and automatically extracts them to plain text.
    echo The AI model can then read the text files directly.
    pause
    exit /b 1
)

set WATCH_DIR=%~1
set SCRIPT_DIR=%~dp0

echo =============================================
echo   Document Auto-Extractor
echo   Watching: %WATCH_DIR%
echo   Press Ctrl+C to stop
echo =============================================
echo.

:loop
echo [%date% %time%] Extracting documents...
python "%SCRIPT_DIR%extract-all.py" "%WATCH_DIR%"
echo.
echo [%date% %time%] Waiting 30 seconds for changes...
timeout /t 30 /nobreak >nul
goto loop
