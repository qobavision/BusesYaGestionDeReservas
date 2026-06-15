@echo off
REM Arranca SIEMPRE con el Python del .venv del proyecto (evita ejecutar código viejo de otro entorno).
cd /d "%~dp0"
if not exist ".venv\Scripts\uvicorn.exe" (
  echo ERROR: No encuentro .venv\Scripts\uvicorn.exe
  echo Crea el entorno en esta carpeta: python -m venv .venv
  echo Instala deps: pip install -r requirements.txt
  pause
  exit /b 1
)
echo Iniciando API desde: %CD%
echo.
echo Liberando puerto 8000 si quedo un proceso anterior colgado...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo.
echo Cuando veas "Application startup complete", abre http://127.0.0.1:8000/salud
echo Usa UNA sola terminal con este script. No ejecutes uvicorn dos veces a la vez.
echo.
".venv\Scripts\uvicorn.exe" main:app --reload --host 127.0.0.1 --port 8000
