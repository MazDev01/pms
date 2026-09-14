// ── ใบเสนอแพ็กเกจตัวแทน (บอสสั่ง 14 ก.ย. 69) ─────────────────────────────────────────
//
// บอส: "ต้องทำเหมือนดีลเลอร์ที่ต้องมีใบเสนอราคา แต่อันนี้ของ HQ" · "คล้ายแฟรนไชส์ แต่ไม่ใช่แฟรนไชส์"
//   → ชื่อ "ใบเสนอแพ็กเกจตัวแทน" (บอสเลือก) — ตรงกับคำที่ทีมใช้ในไฟล์: Proposal · Dealer Package · Standard/Exclusive
//
// กติกาเดียวกับฝั่งตัวแทน (ปิดการขายต้องมีใบเสนอราคาที่ส่งแล้ว · 0145):
//   สร้างตัวแทนใหม่ได้ต่อเมื่อมีใบที่ "ส่งแล้ว" หรือ "ตอบรับ" อย่างน้อย 1 ใบ
//   ด่านจริงที่ POST /api/admin/dealers · สถานะ/การล็อกเนื้อหาบังคับที่ฐานข้อมูล (0172)
//
// ช่องข้อมูลมีเท่าที่มีที่มาจริง — มูลค่าแพ็กเกจเป็นช่องให้ HQ กรอกเอง ไม่มีค่า = "—" (ห้ามเติมตัวเลขให้)
//
// ไฟล์นี้เป็นตรรกะล้วน — หน้าจอ ตัวเชื่อมข้อมูลทั้งสามแบบ และเซิร์ฟเวอร์ใช้ชุดเดียวกัน
import type { DealerPackage, DealerPackageProposal, DealerProposalStatus } from "./data/types";
import { regionOf } from "./provinces";
import { ตรวจภาคกับจังหวัด } from "./dealerProspects";

// ชื่อแพ็กเกจเป็นชื่อเฉพาะที่ทีมใช้จริง (ในไฟล์: "สนใจ Standard" / "สนใจ Exclusive") — คงภาษาอังกฤษไว้ตามนั้น
export const PACKAGE_ORDER: readonly DealerPackage[] = ["standard", "exclusive"];
export const packageLabel: Record<DealerPackage, string> = { standard: "Standard", exclusive: "Exclusive" };

export const PROPOSAL_STATUS_ORDER: readonly DealerProposalStatus[] = ["draft", "sent", "accepted", "rejected"];
// คำเดียวกับสถานะใบเสนอราคาของตัวแทน (ร่าง / ส่งแล้ว / ตอบรับ / ปฏิเสธ) — คนใช้สองระบบจะได้ไม่สับสน
export const proposalStatusLabel: Record<DealerProposalStatus, string> = {
  draft: "ร่าง", sent: "ส่งแล้ว", accepted: "ตอบรับ", rejected: "ปฏิเสธ",
};
export const proposalStatusColor: Record<DealerProposalStatus, { bg: string; text: string }> = {
  draft:    { bg: "#f3f4f6", text: "#4b5563" },
  sent:     { bg: "#dce5f0", text: "#003366" },
  accepted: { bg: "#dcfce7", text: "#15803d" },
  rejected: { bg: "#fee2e2", text: "#b91c1c" },
};

export const เป็นแพ็กเกจ = (v: unknown): v is DealerPackage =>
  typeof v === "string" && (PACKAGE_ORDER as readonly string[]).includes(v);
export const เป็นสถานะใบ = (v: unknown): v is DealerProposalStatus =>
  typeof v === "string" && (PROPOSAL_STATUS_ORDER as readonly string[]).includes(v);

/** ส่งแล้ว = แก้เนื้อหาไม่ได้ ลบไม่ได้ (ตรงกับตัวดักของฐานข้อมูล 0172) */
export const ใบล็อกแล้ว = (s: DealerProposalStatus) => s !== "draft";

/** สถานะที่เลือกได้จากสถานะปัจจุบัน (รวมตัวเอง) — เดินหน้าทางเดียว ข้ามจากร่างไปตอบรับไม่ได้ */
export function สถานะที่เปลี่ยนไปได้(จาก: DealerProposalStatus): DealerProposalStatus[] {
  if (จาก === "draft") return ["draft", "sent"];
  if (จาก === "sent") return ["sent", "accepted", "rejected"];
  return [จาก];
}

/** ใบที่ "นับได้" สำหรับด่านสร้างตัวแทน — ส่งแล้วหรือตอบรับ (ใบร่าง/ปฏิเสธไม่นับ) */
export const ใบนับได้ = (s: DealerProposalStatus) => s === "sent" || s === "accepted";
export const มีใบเสนอที่ส่งแล้ว = (list: Pick<DealerPackageProposal, "status">[]) => list.some(p => ใบนับได้(p.status));

/** ใบที่ส่งไปแล้วแต่เลยวันที่ข้อเสนอมีผล (ยังไม่มีคำตอบ) */
export function หมดอายุแล้ว(p: Pick<DealerPackageProposal, "status" | "validUntil">, วันนี้ISO: string): boolean {
  return p.status === "sent" && !!p.validUntil && p.validUntil < วันนี้ISO;
}

/** มูลค่าอ่านง่าย — ไม่ได้กรอก = "—" ไม่ใช่ ฿0 */
export function มูลค่าอ่านง่าย(amount?: number | null): string {
  return amount == null || !Number.isFinite(amount) ? "—" : `฿${amount.toLocaleString("th-TH")}`;
}

export type ใบเสนอที่จะบันทึก = Omit<DealerPackageProposal, "id" | "proposalNo" | "createdAt" | "updatedAt">;

const ข้อความหรือว่าง = (v?: string | null): string | null => {
  const t = String(v ?? "").trim();
  return t || null;
};
// ช่องวันที่ในฐานข้อมูลเป็นชนิด date — ส่ง "" ไปจะถูกปฏิเสธทั้งแถว
const วันที่หรือว่าง = (v?: string | null): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null;

/** มูลค่า: รับได้ทั้งตัวเลขและข้อความที่มีลูกน้ำ/฿ · ว่าง = null · อ่านไม่ออก = NaN (ให้ตัวตรวจฟ้อง ไม่กลืนเป็น 0) */
function มูลค่าจาก(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const t = String(v).replace(/[,฿\s]/g, "");
  return t === "" ? null : Number(t);
}

/** จัดข้อมูลก่อนบันทึก · เซิร์ฟเวอร์เรียกซ้ำเสมอ — ห้ามเชื่อว่าหน้าจอจัดมาแล้ว */
export function เตรียมบันทึกใบ(p: Partial<DealerPackageProposal>): ใบเสนอที่จะบันทึก {
  return {
    prospectId: Number(p.prospectId),
    // ไม่รู้จัก = ว่าง ให้ตัวตรวจฟ้อง "ต้องเลือกแพ็กเกจ" — ห้ามเลือกให้เอง
    package: (เป็นแพ็กเกจ(p.package) ? p.package : "") as DealerPackage,
    province: ข้อความหรือว่าง(p.province),
    region: ข้อความหรือว่าง(p.region) ?? regionOf(String(p.province ?? "")) ?? null,
    amount: มูลค่าจาก(p.amount),
    terms: ข้อความหรือว่าง(p.terms),
    proposedDate: วันที่หรือว่าง(p.proposedDate),
    validUntil: วันที่หรือว่าง(p.validUntil),
    status: เป็นสถานะใบ(p.status) ? p.status : "draft",
    note: ข้อความหรือว่าง(p.note),
  };
}

/** ตรวจความถูกต้อง — คืนข้อความที่ผู้ใช้อ่านเข้าใจ หรือ null ถ้าผ่าน */
export function ตรวจใบเสนอ(p: ใบเสนอที่จะบันทึก): string | null {
  if (!Number.isInteger(p.prospectId) || p.prospectId <= 0) return "ไม่ได้ระบุว่าเป็นใบของลูกค้าเป้าหมายรายไหน";
  if (!เป็นแพ็กเกจ(p.package)) return "ต้องเลือกแพ็กเกจ (Standard หรือ Exclusive)";
  if (!p.proposedDate) return "ต้องระบุวันที่เสนอ";
  if (p.validUntil && p.validUntil < p.proposedDate) return "วันที่ข้อเสนอมีผลถึง ต้องไม่ก่อนวันที่เสนอ";
  if (p.amount != null && (!Number.isFinite(p.amount) || p.amount < 0)) return "มูลค่าแพ็กเกจต้องเป็นตัวเลขไม่ติดลบ";
  return ตรวจภาคกับจังหวัด(p.region ?? null, p.province ?? null);
}
