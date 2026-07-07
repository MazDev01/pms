"use client";

// Lead Detail มี UI เดียว = โมดัลใน "ลูกค้าเป้าหมาย" (One page · One workflow)
// เส้นทางเก่า /leads/[id] จึง redirect ไปเปิดโมดัลของลีดตัวนั้นที่ /leads?open=N
// (ลิงก์เดิมจาก Dashboard / ลูกค้า / ใบเสนอราคา ยังใช้ได้ทั้งหมด)
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LeadDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/leads?open=${params.id}`);
  }, [params.id, router]);
  return (
    <div className="erp" style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: "0.86rem" }}>
      กำลังเปิดข้อมูลลูกค้าเป้าหมาย…
    </div>
  );
}
