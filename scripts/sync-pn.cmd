@echo off
rem Runs the PN sync and keeps a log, for Task Scheduler or a double-click.
rem Cloudflare challenges this call from any datacentre, so it has to run from a
rem machine at home. See README, "Preference numbers".
setlocal
cd /d "%~dp0.."
echo. >> sync-pn.log
echo ==== %DATE% %TIME% ==== >> sync-pn.log
call npm run sync-pn >> sync-pn.log 2>&1
set code=%ERRORLEVEL%
if %code% neq 0 echo FAILED with code %code% >> sync-pn.log
exit /b %code%
