@echo off
setlocal

set "PROJECT=%~dp0"
set "DEPLOY=C:\xampp\htdocs\PaezLobatoServidor"
set "OBF=C:\Users\RAFAEL\AppData\Roaming\npm\javascript-obfuscator.cmd"

for %%D in (js shared\js terminal\js gestion\js) do (
  if exist "%PROJECT%%%D" (
    if not exist "%DEPLOY%\%%D" mkdir "%DEPLOY%\%%D"
    "%OBF%" "%PROJECT%%%D" --output "%DEPLOY%\%%D" --compact true --control-flow-flattening true --control-flow-flattening-threshold 1 --dead-code-injection true --dead-code-injection-threshold 0.5 --string-array true --string-array-encoding rc4 --string-array-threshold 1 --rename-globals false --self-defending true --disable-console-output true --identifier-names-generator hexadecimal
    if errorlevel 1 exit /b 1
  )
)

pause
