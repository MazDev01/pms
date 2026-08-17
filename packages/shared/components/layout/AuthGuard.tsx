"use client";

import { useRole } from "@pms/shared/context/RoleContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// เส้นทางหน้า login ต่อแอป — dealer ใช้ "/login" (ค่าเริ่มต้น) · HQ ตั้ง NEXT_PUBLIC_LOGIN_PATH="/hq/login"
// (แอป HQ ไม่มี route "/login" เปล่า — เดิม hardcode "/login" จึงเด้งไปเจอ 404)
const LOGIN_PATH = process.env.NEXT_PUBLIC_LOGIN_PATH || "/login";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, hydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.replace(LOGIN_PATH);
    }
  }, [isLoggedIn, hydrated, router]);

  // ยังกู้ session ไม่เสร็จ — ต้องเรนเดอร์ children ไว้ (แค่ซ่อน) ไม่ใช่ null
  //   ตอน build/prerender ค่านี้เป็น false เสมอ ถ้าคืน null จะไม่มีเนื้อหาให้ Next สร้างหน้า
  if (!hydrated) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  // รู้แน่แล้วว่าไม่ได้ล็อกอิน → ห้ามเรนเดอร์เนื้อหาข้างในเด็ดขาด (7 ส.ค. 69)
  //   เดิมซ่อนด้วย CSS แต่ยังเรนเดอร์อยู่ → ทุก hook ข้างในทำงานเต็มที่ ยิงขอข้อมูลจริงไปที่ฐานข้อมูล
  //   ทั้งที่ยังไม่มีสิทธิ์อะไรเลย · ยืนยันจากการยิงจริง: เปิด /dashboard โดยไม่ล็อกอิน
  //   แอปยิงขอ 13 อย่าง (ลูกค้าเป้าหมาย ลูกค้า ใบเสนอราคา ทะเบียนสาขา ฯลฯ) และทะเบียนสาขาตอบ 401
  //   "permission denied for view dealers_directory" เด้งเป็นหน้าจอ error แดงคาหน้า login
  //   (สิทธิ์ฝั่งฐานข้อมูลถูกแล้ว — คนไม่ล็อกอินต้องอ่านไม่ได้ · ที่ผิดคือแอปไม่ควรถามตั้งแต่แรก)
  if (!isLoggedIn) return null;

  return <>{children}</>;
}
