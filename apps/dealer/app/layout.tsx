import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { RoleProvider } from "@pms/shared/context/RoleContext";
import { SalesProvider } from "@pms/shared/context/SalesContext";
import { leads as initialLeads } from "@pms/shared/lib/mock";
import "@pms/shared/globals.css";

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-thai",
  display: "swap",
});

// เดิม title เดียวกันเป๊ะกับแอป HQ — เปิดสองแอปพร้อมกันแยกแท็บไม่ออก (พบจากผลตรวจสอบระบบรอบ 2, 31 ก.ค. 69)
export const metadata: Metadata = {
  title: "Benjamin PMS · ตัวแทนจำหน่าย",
  description: "ระบบบริหารจัดการ Benjamin — Pre-Engineered Steel Building (ตัวแทนจำหน่าย)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={notoThai.variable}>
      <body className={notoThai.className}>
        <RoleProvider><SalesProvider initialLeads={initialLeads}>{children}</SalesProvider></RoleProvider>
      </body>
    </html>
  );
}
