@echo off
setlocal enabledelayedexpansion
title ws - Dev Setup

set "npm_config_loglevel=error"
set "npm_config_audit=false"
set "npm_config_fund=false"

:: Colors via ANSI (Windows 10+)
for /f %%a in ('echo prompt $E^| cmd') do set "ESC=%%a"
set "RED=%ESC%[0;31m"
set "GREEN=%ESC%[0;32m"
set "YELLOW=%ESC%[1;33m"
set "CYAN=%ESC%[0;36m"
set "NC=%ESC%[0m"

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo %RED%  X Node.js is not installed. Install Node.js 20+ first.%NC%
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VERSION=%%v"
echo %CYAN%==^> Node.js %NODE_VERSION%%NC%

set "MAJOR=%NODE_VERSION:~1,2%"
if %MAJOR% LSS 20 (
    echo %RED%  X Node.js %NODE_VERSION% is too old. Requires 20+.%NC%
    pause
    exit /b 1
)
echo %GREEN%  + Node.js %NODE_VERSION% OK%NC%

:: Install dependencies
echo %CYAN%==^> Installing dependencies...%NC%
call npm install --include=dev --loglevel error --no-audit --no-fund 2>nul
if errorlevel 1 (
    echo %RED%  X npm install failed. Try running manually: npm install --include=dev%NC%
    pause
    exit /b 1
)
echo %GREEN%  + Dependencies installed%NC%

:: Build
echo %CYAN%==^> Building all packages...%NC%
call node scripts\build.js
if errorlevel 1 (
    echo %RED%  X Build failed%NC%
    pause
    exit /b 1
)
echo %GREEN%  + All packages built%NC%

:: Verify CLI
echo %CYAN%==^> Verifying CLI...%NC%
for /f "tokens=*" %%v in ('node packages\cli\dist\index.js --version 2^>nul') do set "VERSION=%%v"
if "%VERSION%"=="0.1.0" (
    echo %GREEN%  + ws --version -^> %VERSION%%NC%
) else (
    echo %RED%  X ws --version returned '%VERSION%', expected '0.1.0'%NC%
    pause
    exit /b 1
)

:: Run tests
echo %CYAN%==^> Running tests...%NC%
echo     (this may take a minute)
call node node_modules\vitest\vitest.mjs run --exclude="**/git/__tests__/**" --reporter=verbose > "%TEMP%\ws-test-output.txt" 2>&1
set "TEST_RESULT=!ERRORLEVEL!"
echo.
node -e "const l=require('fs').readFileSync(process.env.TEMP+'\\ws-test-output.txt','utf8').replace(/\x1b\[[0-9;]*m/g,'');const lines=l.split('\n');const summary=lines.filter(s=>/Test Files|Tests |Duration/.test(s));if(summary.length)summary.forEach(s=>console.log('  '+s.trim()));else console.log('  (see full output below)');"
echo.
if !TEST_RESULT! neq 0 (
    echo %YELLOW%  ! Some tests failed. Full log: %TEMP%\ws-test-output.txt%NC%
) else (
    echo %GREEN%  + All tests passed%NC%
)

echo.
echo %GREEN%============================================%NC%
echo %GREEN%  Setup complete!%NC%
echo %GREEN%============================================%NC%
echo.
echo   Quick start:
echo     node packages\cli\dist\index.js --version
echo     node packages\cli\dist\index.js init
echo     node packages\cli\dist\index.js setup
echo     node packages\cli\dist\index.js start
echo.
echo   Or link globally:
echo     cd packages\cli ^&^& npm link
echo     ws --version
echo.
pause
