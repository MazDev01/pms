import { redirect } from "next/navigation";

// แอป HQ: หน้าแรกพาไปแดชบอร์ดสำนักงานใหญ่
export default function Page() {
  redirect("/hq/dashboard");
}
