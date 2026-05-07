@echo off
title Stuttgart Galatasaray Dernek Yonetimi - Baslatiliyor...
color 0A

echo.
echo  ================================================
echo   Stuttgart Galatasaray - Dernek Yonetim Sistemi
echo  ================================================
echo.
echo  [1/2] Backend baslatiliyor (Port 5000)...
start "Backend - Dernek API" cmd /k "cd /d C:\Users\yardimca\Desktop\GSDernek\backend && node server.js"

echo  Bekleyiniz...
timeout /t 3 /nobreak > nul

echo  [2/2] Frontend baslatiliyor (Port 5173)...
start "Frontend - Dernek Panel" cmd /k "cd /d C:\Users\yardimca\Desktop\GSDernek\frontend && npm run dev"

echo.
echo  Bekleyiniz, tarayici aciliyor...
timeout /t 5 /nobreak > nul

start http://localhost:5173

echo.
echo  ================================================
echo   Sistem Hazir!
echo   Tarayicide: http://localhost:5173
echo  ================================================
echo.
echo  Kapatmak icin bu pencereyi kapatin ve acilan
echo  2 siyah CMD penceresini de kapatin.
echo.
pause
