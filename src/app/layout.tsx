import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { RoleProvider } from "@/context/RoleContext";
import { SalesProvider } from "@/context/SalesContext";
import { leads as initialLeads } from "@/lib/mock";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Benjamin PMS",
  description: "ระบบบริหารจัดการ Benjamin — Pre-Engineered Steel Building",
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
