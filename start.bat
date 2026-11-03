@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   메아리가 오는 곳 — http://localhost:8765/
echo   (이 창을 닫으면 발표가 멈춥니다)
echo.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8765/"
where python >nul 2>nul && (python serve.py 8765) || (py serve.py 8765)
