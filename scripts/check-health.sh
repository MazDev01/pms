#!/usr/bin/env bash
# ── เช็กด้วยมือว่าเว็บยังไหว ──────────────────────────────────────────────────
# ใช้: bash scripts/check-health.sh <ที่อยู่เว็บ> [<ที่อยู่เว็บ> ...]
# เช่น: bash scripts/check-health.sh http://localhost:3002 http://localhost:3001
set -u
FAIL=0
for base in "$@"; do
  url="${base%/}/api/health"
  rm -f /tmp/health-body.json   # กันพิมพ์คำตอบของเว็บก่อนหน้าออกมาผิดตัวเวลายิงไม่ติด
  code=$(curl -s -o /tmp/health-body.json -w "%{http_code}" --max-time 20 "$url") || code="ยิงไม่ติด"
  if [ "$code" = "200" ]; then
    echo "ปกติ    $base"
  else
    echo "ไม่ไหว  $base (รหัส $code)"
    head -c 300 /tmp/health-body.json 2>/dev/null; echo
    FAIL=1
  fi
done
exit $FAIL
