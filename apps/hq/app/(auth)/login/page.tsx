"use client";

// AuthGuard (แชร์) เด้งผู้ใช้ที่ยังไม่ล็อกอินไป "/login" เสมอ → เดิมเจอ 404 บนแอปนี้
// route นี้จับ /login แล้วส่งต่อไปหน้า login จริงของแอป HQ (canonical = /hq/login)
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/hq/login");
  }, [router]);
  return null;
}
