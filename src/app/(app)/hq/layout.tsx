"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";

export default function HQLayout({ children }: { children: React.ReactNode }) {
  const { isHQ, hydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isHQ) {
      router.replace("/dashboard");
    }
  }, [isHQ, hydrated, router]);

  // ห้ามเรนเดอร์เนื้อหา HQ (ข้อมูลทั้งเครือ) จนกว่าจะ hydrate เสร็จและยืนยันว่าเป็น HQ จริง
  // ก่อนหน้านี้ return children เสมอ → dealer ที่พิมพ์ /hq/* เห็นแดชบอร์ด HQ แวบหนึ่งก่อน redirect
  if (!hydrated || !isHQ) return null;

  return <>{children}</>;
}
