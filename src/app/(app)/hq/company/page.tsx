// หน้า "บริษัท" (HQ) — เนื้อหาจริงอยู่ใน CompanyPanel เพื่อให้หน้า route รับเฉพาะ PageProps ของ Next
// (แท็บ "บริษัท" ในหน้าตั้งค่าเรียก <CompanyPanel embedded /> ตรงจากคอมโพเนนต์)
import { CompanyPanel } from "@/components/hq/CompanyPanel";
import { AdminGate } from "@/components/layout/AdminGate";

// ข้อมูลบริษัท (ส่วนกลาง) = เฉพาะผู้ดูแลระดับสูง (hq:all_data)
export default function HQCompanyPage() {
  return <AdminGate perm="hq:all_data"><CompanyPanel /></AdminGate>;
}
