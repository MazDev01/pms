#!/usr/bin/env bash
# ── ซ้อมกู้ข้อมูลลงฐานข้อมูลในเครื่อง (ไม่แตะของจริง) ─────────────────────────
# ใช้: bash scripts/restore-db-drill.sh <โฟลเดอร์SRCไว้>
#
# ⚠️ สคริปต์นี้ "ล้างฐานข้อมูลในเครื่องทิ้งทั้งหมด" แล้วกู้จากไฟล์สำรอง
#    ปลอดภัยเพราะยิงเข้าคอนเทนเนอร์ในเครื่องเท่านั้น ไม่มีทางไปโดนของจริง
# ⚠️ ต้องมี Docker เปิดอยู่ และรัน `npx supabase start` มาก่อน
set -euo pipefail
export MSYS_NO_PATHCONV=1   # กันไม่ให้ Git Bash แปลง /tmp/x.sql เป็นพาธวินโดวส์ (เจอจริง 26 ส.ค. 69)

SRC="${1:?ต้องระบุโฟลเดอร์SRCไว้}"
DB=supabase_db_Benjamin-HQ-main

for f in roles schema data; do docker cp "$SRC/$f.sql" "$DB:/tmp/$f.sql"; done

echo "ล้างฐานข้อมูลในเครื่อง..."
docker exec "$DB" psql -U postgres -d postgres -c "drop schema public cascade;" >/dev/null
docker exec "$DB" psql -U postgres -d postgres -c "create schema public;"       >/dev/null
docker exec "$DB" psql -U postgres -d postgres -c "truncate auth.users cascade;" >/dev/null

echo "กู้กลับ..."
t0=$(date +%s)
for f in roles schema data; do
  docker exec "$DB" psql -U postgres -d postgres -q -f "/tmp/$f.sql" > "/tmp/restore-$f.log" 2>&1 || true
done
t1=$(date +%s)
echo "กู้เสร็จใน $((t1-t0)) วินาที"

echo "ตรวจผล:"
docker exec "$DB" psql -U postgres -d postgres -t -A -c \
  "select 'ตาราง=' || (select count(*) from pg_tables where schemaname='public')
       || ' · บัญชีผู้ใช้=' || (select count(*) from auth.users)
       || ' · ลูกค้า=' || (select count(*) from public.customers)
       || ' · ใบเสนอราคา=' || (select count(*) from public.quotations);"
