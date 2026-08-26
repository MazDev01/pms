#!/usr/bin/env bash
# ── สำรองฐานข้อมูล Benjamin PMS ───────────────────────────────────────────────
# ใช้: bash scripts/backup-db.sh [โฟลเดอร์DEST]
#
# ⚠️ สำรอง "โปรเจกต์ที่ผูกไว้" (supabase/.temp/project-ref) เท่านั้น
#    ตรวจให้แน่ใจก่อนรันว่าผูกอยู่กับโปรเจกต์ที่ตั้งใจ — มี 2 ชุด (ของจริง / ชุดทดสอบ)
#    ดูได้ด้วย: cat supabase/.temp/project-ref
#
# ได้ 3 ไฟล์ ต้องเก็บครบทั้งสามถึงจะกู้กลับได้:
#   roles.sql  — บัญชีระดับฐานข้อมูล
#   schema.sql — โครงสร้างตาราง/ฟังก์ชัน/กติกาสิทธิ์ (RLS)
#   data.sql   — ข้อมูลทั้งหมด รวมบัญชีผู้ใช้ (auth) และไฟล์แนบ (storage)
set -euo pipefail
# ⚠️ ชื่อตัวแปรต้องเป็นอังกฤษ — bash บน Git Bash ใช้ชื่อตัวแปรภาษาไทยไม่ได้ (เจอจริง 26 ส.ค. 69)

DEST="${1:-backups/$(date +%Y%m%d-%H%M)}"
mkdir -p "$DEST"
echo "โปรเจกต์ที่ผูกไว้: $(cat supabase/.temp/project-ref 2>/dev/null || echo '<ยังไม่ได้ผูก>')"
echo "เก็บลงที่: $DEST"

npx supabase db dump --linked --role-only -f "$DEST/roles.sql"
npx supabase db dump --linked            -f "$DEST/schema.sql"
npx supabase db dump --linked --data-only -f "$DEST/data.sql"

for f in roles schema data; do
  SIZE=$(wc -c < "$DEST/$f.sql")
  echo "  $f.sql = $SIZE ไบต์"
  # ไฟล์ว่าง = สำรองไม่สำเร็จ ห้ามปล่อยผ่านเงียบ ๆ แล้วไปรู้ตอนจะกู้จริง
  [ "$SIZE" -gt 100 ] || { echo "!! $f.sql เล็กผิดปกติ — สำรองไม่สำเร็จ"; exit 1; }
done
echo "สำรองเรียบร้อย (ล่าสุดวัดได้ ~80 วินาที ที่ข้อมูล ~10 MB)"
