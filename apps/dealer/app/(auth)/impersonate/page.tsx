"use client";

// ─── เข้าระบบแทนตัวแทน (สำนักงานใหญ่กดจากหน้า /hq/dealers) ────────────────────
//
// ทำไมต้องมีหน้านี้ (แก้ 20 ส.ค. 69 — บอสแจ้งว่ากดปุ่ม "เข้าระบบ" แล้วไม่ได้):
//   เดิมสำนักงานใหญ่เปิด "ลิงก์ยืนยันของ Supabase" ตรง ๆ แล้วให้ Supabase พากลับมาที่แอปตัวแทน
//   แต่ปลายทางนั้นต้องถูกใส่ไว้ในรายการที่อนุญาต (Authentication → URL Configuration)
//   ถ้าไม่ได้ใส่ Supabase จะไม่แจ้งอะไรเลย แค่เงียบ ๆ แล้วพาไปที่ Site URL ของโปรเจกต์แทน
//   ผลคือเปิดแท็บใหม่ขึ้นมาเจอหน้าเปล่า/หน้า error — ผู้ใช้ไม่รู้ว่าเกิดอะไรขึ้น
//   (ยืนยันจากของจริง: ลิงก์ที่ได้มี redirect_to=http://127.0.0.1:3000 ซึ่งไม่มีอะไรรันอยู่)
//
// ตอนนี้จึงไม่พึ่งการตั้งค่าฝั่ง Supabase อีก: สำนักงานใหญ่ส่ง "ใบผ่านครั้งเดียว" มาที่หน้านี้
//   แล้วหน้านี้แลกเป็น session เอง — คุมได้ทั้งหมดในโค้ด ใช้ได้ทั้งตอนพัฒนาและระบบจริง
//
// ⚠️ ใบผ่านมาทาง #hash ไม่ใช่ query string — hash ไม่ถูกส่งไปกับคำขอ HTTP
//    จึงไม่มีทางไปโผล่ใน log ของเซิร์ฟเวอร์/ตัวกลางระหว่างทาง
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@pms/shared/lib/data/supabase/client";
import { REAL_BACKEND } from "@pms/shared/lib/data/config";

export default function ImpersonatePage() {
  const router = useRouter();
  const [ผิดพลาด, setผิดพลาด] = useState("");

  useEffect(() => {
    if (!REAL_BACKEND) { setผิดพลาด("โหมดเดโมไม่ต้องใช้หน้านี้"); return; }
    const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("th") ?? "";
    if (!token) { setผิดพลาด("ลิงก์ไม่สมบูรณ์ — ขอลิงก์ใหม่จากหน้าตัวแทนของสำนักงานใหญ่"); return; }

    let alive = true;
    getSupabase().auth.verifyOtp({ token_hash: token, type: "magiclink" })
      .then(({ error }) => {
        if (!alive) return;
        if (error) {
          // ใบผ่านใช้ได้ครั้งเดียวและมีอายุสั้น — หมดอายุ/ถูกใช้ไปแล้วเป็นกรณีที่เจอบ่อยสุด
          setผิดพลาด(`เข้าระบบแทนไม่สำเร็จ — ${error.message}`);
          return;
        }
        // ล้าง token ออกจากแถบที่อยู่ก่อนไปต่อ (กันติดไปกับประวัติเบราว์เซอร์)
        window.history.replaceState(null, "", window.location.pathname);
        router.replace("/dashboard?impersonated=1");
      })
      .catch((e: unknown) => { if (alive) setผิดพลาด(`เข้าระบบแทนไม่สำเร็จ — ${String(e)}`); });
    return () => { alive = false; };
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 12, padding: 24, textAlign: "center", background: "#f7f9fc",
    }}>
      {ผิดพลาด ? (
        <>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#b4232a" }}>{ผิดพลาด}</div>
          <a href="/login" style={{ fontSize: "0.85rem", color: "#003366", fontWeight: 700 }}>ไปหน้าเข้าสู่ระบบ</a>
        </>
      ) : (
        <>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            border: "2.5px solid #e6eaf0", borderTopColor: "#003366",
            animation: "spin 0.8s linear infinite",
          }} />
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#374151" }}>กำลังเข้าระบบแทนตัวแทน…</div>
          <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
        </>
      )}
    </div>
  );
}
