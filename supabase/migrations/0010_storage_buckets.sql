-- Benjamin PMS — Storage buckets + RLS (Phase 6)
-- สร้าง bucket ผ่าน SQL ได้ (ไม่ต้องใช้ Dashboard/service_role) — buckets = ตาราง storage.buckets
-- โครงพาธที่ตกลงกัน: dealer-files/{dealerCode}/{filename} → ใช้ segment แรกเป็นตัวคุมสิทธิ์
--
--   dealer-files   (private) — ไฟล์แนบของตัวแทน · ตัวแทนเห็น/แก้เฉพาะโฟลเดอร์สาขาตัวเอง · HQ อ่านได้ทั้งหมด
--   catalog-images (public)  — รูปแม่แบบ/ราคากลาง · อ่านสาธารณะ · เขียนเฉพาะ HQ
--   avatars        (public)  — รูปโปรไฟล์/พนักงานขาย · อ่านสาธารณะ · ผู้ล็อกอินเขียนได้

insert into storage.buckets (id, name, public)
values ('dealer-files', 'dealer-files', false),
       ('catalog-images', 'catalog-images', true),
       ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ── dealer-files: แยกตามสาขาด้วยโฟลเดอร์ชั้นแรก ──
drop policy if exists dealer_files_read  on storage.objects;
drop policy if exists dealer_files_write on storage.objects;
create policy dealer_files_read on storage.objects for select
  using (
    bucket_id = 'dealer-files'
    and ( is_hq() or (storage.foldername(name))[1] = auth_dealer() )
  );
create policy dealer_files_write on storage.objects for all
  using (
    bucket_id = 'dealer-files' and (storage.foldername(name))[1] = auth_dealer()
  )
  with check (
    bucket_id = 'dealer-files' and (storage.foldername(name))[1] = auth_dealer()
  );

-- ── catalog-images: อ่านสาธารณะ · เขียนเฉพาะ HQ ──
drop policy if exists catalog_images_read  on storage.objects;
drop policy if exists catalog_images_write on storage.objects;
create policy catalog_images_read on storage.objects for select
  using ( bucket_id = 'catalog-images' );
create policy catalog_images_write on storage.objects for all
  using ( bucket_id = 'catalog-images' and is_hq() )
  with check ( bucket_id = 'catalog-images' and is_hq() );

-- ── avatars: อ่านสาธารณะ · ผู้ล็อกอินเขียนได้ ──
drop policy if exists avatars_read  on storage.objects;
drop policy if exists avatars_write on storage.objects;
create policy avatars_read on storage.objects for select
  using ( bucket_id = 'avatars' );
create policy avatars_write on storage.objects for all
  to authenticated
  using ( bucket_id = 'avatars' )
  with check ( bucket_id = 'avatars' );
