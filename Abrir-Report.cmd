@echo off
REM Abre (decifra) um report.enc.txt do Liquidator.
REM Uso: arraste o arquivo report.enc.txt em cima deste .cmd,
REM      ou rode:  Abrir-Report.cmd "caminho\report.enc.txt"

setlocal
set "SCRIPT=%~dp0scripts\decrypt-report.mjs"

if "%~1"=="" (
  echo Arraste um arquivo report.enc.txt em cima deste atalho.
  echo.
  pause
  exit /b 1
)

node "%SCRIPT%" "%~1"
echo.
echo Pronto. Abra o .zip gerado ao lado do arquivo original.
pause
