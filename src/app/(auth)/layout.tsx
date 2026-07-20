// เลย์เอาต์กลุ่ม (auth) = pass-through — แต่ละหน้าคุมพื้นหลัง/การจัดวางเต็มจอเอง
// (หน้า /login เป็น split เต็มจอ · /login/hq จัดกึ่งกลางการ์ดด้วยตัวเอง)
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
