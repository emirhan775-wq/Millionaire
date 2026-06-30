@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===============================================
echo ERP MUTABAKAT SISTEMI - V223 OTOMATIK MOD
echo ===============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js kurulu degil. Once Node.js LTS kurulmali: https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Ilk kurulum yapiliyor: npm install
  call npm install
  if errorlevel 1 (
    echo npm install basarisiz oldu.
    pause
    exit /b 1
  )
)
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3080"
echo Dashboard aciliyor: http://localhost:3080
echo Raporlari 02_RAPORLAR klasorune at; sistem otomatik okuyacak.
echo.
call npm start
pause
