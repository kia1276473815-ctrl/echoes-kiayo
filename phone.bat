@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   手机预览 / 휴대폰 미리보기
echo   手机和电脑连同一个 Wi-Fi，用手机浏览器打开下面 phone 那一行的地址。
echo   第一次运行时 Windows 可能会问是否允许 Python 访问网络，选"允许"（专用网络）。
echo   关掉这个窗口就停止。
echo.
where python >nul 2>nul && (python serve.py 8770 --lan) || (py serve.py 8770 --lan)
