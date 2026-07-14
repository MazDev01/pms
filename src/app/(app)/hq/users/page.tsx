// หน้า "ผู้ใช้งานและสิทธิ์" (HQ) — เนื้อหาจริงอยู่ใน UsersPanel เพื่อให้หน้า route รับเฉพาะ PageProps ของ Next
// (แท็บ "ผู้ใช้งาน" ในหน้าตั้งค่าเรียก <UsersPanel embedded /> ตรงจากคอมโพเนนต์)
import { UsersPanel } from "@/components/hq/UsersPanel";

export default function HQUsersPage() {
  return <UsersPanel />;
}
