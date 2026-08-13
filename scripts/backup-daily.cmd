@echo off
REM Daily automatic backup - run by Windows Task Scheduler (set up 13 Aug 2026)
REM Docs (Thai): see docs/BACKUP.md section "สำรองอัตโนมัติตามเวลา"
REM
REM NOTE: keep this file ASCII-only. Thai comments here made cmd misparse the script
REM       and it silently did nothing (verified: empty log, no backup folder created).
REM NOTE: call node directly, not npm. npm leaves errorlevel=1 on this machine even
REM       when the backup succeeded, so npm's exit code cannot be trusted here.
REM
REM Output goes to backups\ (git-ignored, contains real customer data - never commit).
REM Only runs while this machine is on. `npm run preflight` warns if the newest
REM backup is older than 7 days.
cd /d "%~dp0.."
echo. >> "backups\backup-daily.log"
echo ===== %DATE% %TIME% ===== >> "backups\backup-daily.log"
node scripts\backup.mjs >> "backups\backup-daily.log" 2>&1
if %errorlevel% neq 0 (
  echo [FAILED] exit code %errorlevel% >> "backups\backup-daily.log"
  exit /b 1
)
echo [OK] backup completed >> "backups\backup-daily.log"
exit /b 0
