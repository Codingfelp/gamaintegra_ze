@echo off
cd /d "C:\xampp\htdocs\zedelivery-clean"

:inicio
echo Iniciando o script Node...
node v1-itens.js

echo O script foi finalizado. Reiniciando em 5 segundos...
timeout /t 2 /nobreak >nul
goto inicio
