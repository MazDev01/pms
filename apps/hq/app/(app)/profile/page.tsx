"use client";

// โปรไฟล์ของฉัน — เดิมมีแค่ apps/dealer/app/(app)/profile ตอนแยกโมโนเรโปจาก main (แอปเดียว /profile
// เส้นทางเดียว) ไม่ได้ก๊อปมาไว้ apps/hq ด้วย → ปุ่ม "โปรไฟล์" ใน Topbar ของ HQ กด router.push("/profile")
// แล้วเจอ 404 เสมอ (ไม่มี route จริงในแอปนี้)
export { default } from "@pms/shared/components/profile/ProfilePage";
