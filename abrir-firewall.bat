@echo off
REM Script para abrir el puerto 3000 en el firewall de Windows para Node.js

REM Requiere permisos de administrador

echo Abriendo el puerto 3000 para Node.js en el firewall de Windows...

REM Permitir tráfico entrante TCP en el puerto 3000
netsh advfirewall firewall add rule name="Node.js 3000" dir=in action=allow protocol=TCP localport=3000

REM Permitir node.exe (ajusta la ruta si es necesario)
netsh advfirewall firewall add rule name="node.exe" dir=in action=allow program="C:\Program Files\nodejs\node.exe" enable=yes

echo Listo. Si node.exe está en otra carpeta, edita este archivo y pon la ruta correcta.
pause
