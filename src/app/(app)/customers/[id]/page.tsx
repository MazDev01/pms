"use client";

// ลูกค้ามี UI เดียว = โมดัลในหน้า "ลูกค้า" (ไม่มีหน้าเต็มซ้ำ)
// เส้นทางเก่า /customers/[id] จึง redirect ไปเปิดโมดัลของลูกค้ารายนั้นที่ /customers?open=N
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CustomerDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/customers?open=${params.id}`);
  }, [params.id, router]);
  return (
    <div className="erp" style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: "0.86rem" }}>
      กำลังเปิดข้อมูลลูกค้า…
    </div>
  );
}
