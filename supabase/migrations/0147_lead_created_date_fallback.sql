-- Benjamin PMS — ลูกค้าเป้าหมายที่ไม่มี "วันที่แบบไทย" หายไปจากกราฟทุกใบ
--
-- อาการ (19 ส.ค. 69): ลีดที่ถูกสร้างโดยไม่ผ่านฟอร์ม (นำเข้า / สคริปต์ / เส้นทางอื่น) จะไม่มี
--   created_label → trigger set_lead_dates() แปลงเป็น created_date ไม่ได้ → เป็น NULL
--   ลีดนั้นยังอยู่ในตาราง แต่หายไปจาก lead_summary.byMonth (กราฟแนวโน้มทุกใบ),
--   unassigned_leads(), hq_alerts และการเรียงลำดับหน้า (0122)
--   ตัวเลขบนการ์ดกับจำนวนแถวในตารางจึงไม่ตรงกันแบบหาสาเหตุไม่เจอ
--
-- แก้ที่ต้นทาง: แปลงป้ายวันที่ไทยไม่ได้ → ใช้เวลาที่แถวถูกบันทึกจริง (created_at)
--   ⚠️ เติมเฉพาะช่องที่เป็น NULL — ค่าที่แปลงได้อยู่แล้วไม่ถูกแตะ พฤติกรรมเดิมคงเดิมทั้งหมด
--   ผลกระทบทางเดียว: ลีดที่เคยหายไปกลับมานับ ไม่มีตัวเลขไหนลดลง
create or replace function set_lead_dates() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_date := coalesce(
    parse_thai_date(new.created_label),
    (coalesce(new.created_at, now()))::date   -- ไม่มีป้ายวันที่ไทย → ใช้เวลาที่บันทึกลงฐาน
  );
  new.last_contact_at := coalesce(lead_last_activity_date(new.activities), new.created_date);
  return new;
end $$;

-- เติมย้อนหลังให้แถวที่ค้าง NULL อยู่ (ไม่แตะแถวที่มีค่าแล้ว)
update leads
   set created_date    = created_at::date,
       last_contact_at = coalesce(last_contact_at, created_at::date)
 where created_date is null
   and created_at is not null;
