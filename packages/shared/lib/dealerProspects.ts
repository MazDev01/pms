// ── ลูกค้าเป้าหมายของสำนักงานใหญ่ = ผู้สนใจเป็นตัวแทนจำหน่าย (บอสสั่ง 14 ก.ย. 69) ──────────
//
// เส้นทาง: ผู้สนใจ → ติดตามตามขั้น → สำเร็จ = กลายเป็น "ตัวแทนจำหน่าย" (ผูก dealerCode)
//
// ⚠️ คนละเรื่องกับ "ลูกค้าเป้าหมายทั้งเครือ" (/hq/leads = ลูกค้าที่จะซื้ออาคารของตัวแทน)
//    ห้ามเอาไปรวมในตาราง leads — ดูเหตุผลเต็มใน migration 0170
//
// ไฟล์นี้เป็นตรรกะล้วน (ไม่แตะหน้าจอ/ฐานข้อมูล) — หน้าจอ ตัวเชื่อมข้อมูลทั้งสามแบบ และเซิร์ฟเวอร์ใช้ชุดเดียวกัน
import type { DealerProspect, DealerProspectStatus } from "./data/types";
import { REGIONS, ALL_REGIONS, ALL_PROVINCES, regionOf } from "./provinces";

/** ขั้นตอนตามที่ทีมเบนจามินใช้จริงในไฟล์ติดตาม (โทรแล้ว → ส่ง Company Profile → นัดคุย → รอพิจารณา) */
export const PROSPECT_STATUS_ORDER: readonly DealerProspectStatus[] =
  ["new", "contacted", "profile_sent", "meeting", "considering", "won", "lost"];

export const prospectStatusLabel: Record<DealerProspectStatus, string> = {
  new: "รอติดต่อ",
  contacted: "ติดต่อแล้ว",
  profile_sent: "ส่งข้อมูลบริษัทแล้ว",
  meeting: "นัดคุยแล้ว",
  considering: "รอตัดสินใจ",
  won: "เป็นตัวแทนแล้ว",
  lost: "ไม่สำเร็จ",
};

export const prospectStatusColor: Record<DealerProspectStatus, { bg: string; text: string }> = {
  new:          { bg: "#f3f4f6", text: "#4b5563" },
  contacted:    { bg: "#eef2f7", text: "#003366" },
  profile_sent: { bg: "#dce5f0", text: "#003366" },
  meeting:      { bg: "#fff3cd", text: "#92400e" },
  considering:  { bg: "#fef3c7", text: "#b45309" },
  won:          { bg: "#dcfce7", text: "#15803d" },
  lost:         { bg: "#fee2e2", text: "#b91c1c" },
};

export const เป็นสถานะที่รู้จัก = (s: unknown): s is DealerProspectStatus =>
  typeof s === "string" && (PROSPECT_STATUS_ORDER as readonly string[]).includes(s);

/** ยังอยู่ระหว่างติดตาม (ยังไม่จบเป็นตัวแทน และยังไม่ปิดว่าไม่สำเร็จ) */
export const ยังติดตามอยู่ = (s: DealerProspectStatus) => s !== "won" && s !== "lost";

/** ข้อมูลที่ส่งไปบันทึกได้ — ไม่มี id / created_at / updated_at (ฐานข้อมูลเป็นคนตั้ง) */
export type ผู้สนใจที่จะบันทึก = Omit<DealerProspect, "id" | "createdAt" | "updatedAt">;

const ข้อความหรือว่าง = (v?: string | null): string | null => {
  const t = String(v ?? "").trim();
  return t || null;
};
// ช่องวันที่ในฐานข้อมูลเป็นชนิด date — ส่ง "" ไปจะถูกปฏิเสธทั้งแถว จึงต้องแปลงเป็น null ก่อนเสมอ
const วันที่หรือว่าง = (v?: string | null): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null;

/** จัดข้อมูลก่อนบันทึก: ตัดช่องว่าง · ช่องว่างเป็น null · เก็บเฉพาะช่องที่ตารางมีจริง
 *  ⚠️ เซิร์ฟเวอร์เรียกซ้ำเสมอ — ห้ามเชื่อว่าหน้าจอจัดมาแล้ว (ใครยิง API ตรงก็ถึง) */
export function เตรียมบันทึก(p: Partial<DealerProspect>): ผู้สนใจที่จะบันทึก {
  const status = เป็นสถานะที่รู้จัก(p.status) ? p.status : "new";
  return {
    name: String(p.name ?? "").trim(),
    social: ข้อความหรือว่าง(p.social),
    phone: ข้อความหรือว่าง(p.phone),
    email: ข้อความหรือว่าง(p.email)?.toLowerCase() ?? null,
    province: ข้อความหรือว่าง(p.province),
    // ภาคว่างแต่รู้จังหวัด → เติมภาคจากจังหวัดให้ (ข้อเท็จจริงทางภูมิศาสตร์ ไม่ใช่การเดา)
    //   จังหวัดที่ระบบไม่รู้จัก (ข้อมูลเก่าพิมพ์ย่อ เช่น "ปทุม") = ปล่อยภาคว่าง ไม่เดาให้
    region: ข้อความหรือว่าง(p.region) ?? regionOf(String(p.province ?? "")) ?? null,
    businessType: ข้อความหรือว่าง(p.businessType),
    channel: ข้อความหรือว่าง(p.channel),
    firstContact: วันที่หรือว่าง(p.firstContact),
    followUp: วันที่หรือว่าง(p.followUp),
    note: ข้อความหรือว่าง(p.note),
    status,
    // เหตุผลเก็บเฉพาะตอนไม่สำเร็จ — เปลี่ยนกลับไปติดตามต่อแล้วเหตุผลเก่าต้องไม่ค้าง
    lostReason: status === "lost" ? ข้อความหรือว่าง(p.lostReason) : null,
    assigned: ข้อความหรือว่าง(p.assigned),
    dealerCode: ข้อความหรือว่าง(p.dealerCode)?.toUpperCase() ?? null,
    convertedAt: p.convertedAt ?? null,
  };
}

/** ตรวจความถูกต้อง — คืนข้อความที่ผู้ใช้อ่านเข้าใจ หรือ null ถ้าผ่าน */
export function ตรวจผู้สนใจ(p: ผู้สนใจที่จะบันทึก): string | null {
  if (!p.name) return "ต้องระบุชื่อลูกค้าเป้าหมาย";
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (p.firstContact && p.followUp && p.followUp < p.firstContact) return "วันติดตามต้องไม่ก่อนวันเริ่มติดต่อ";
  // ภาค/จังหวัด (บอสสั่ง 14 ก.ย. 69: เลือกภาคก่อน แล้วค่อยเลือกจังหวัด · มี "ทุกภาค")
  if (p.region && p.region !== ALL_REGIONS && !(REGIONS as readonly string[]).includes(p.region)) return "ภาคไม่ถูกต้อง";
  if (p.province === ALL_PROVINCES && p.region !== ALL_REGIONS) return "“ทุกจังหวัด” ใช้คู่กับภาค “ทุกภาค” เท่านั้น";
  //   เช็กเฉพาะจังหวัดที่ระบบรู้จัก — ข้อมูลเก่าที่พิมพ์ย่อต้องไม่ถูกบล็อกจนแก้อะไรไม่ได้เลย
  const ภาคของจังหวัด = p.province ? regionOf(p.province) : null;
  if (p.region && p.region !== ALL_REGIONS && ภาคของจังหวัด && ภาคของจังหวัด !== p.region) {
    return `จังหวัด${p.province} ไม่ได้อยู่ในภาค${p.region}`;
  }
  // "เป็นตัวแทนแล้ว" ต้องรู้ว่าเป็นตัวแทนรหัสไหน — ไม่งั้นกดเลือกสถานะเฉย ๆ แล้วนับเป็นความสำเร็จได้ทั้งที่ไม่มีสาขาจริง
  if (p.status === "won" && !p.dealerCode) return "สถานะ “เป็นตัวแทนแล้ว” ต้องผูกกับตัวแทนจำหน่าย — ใช้ปุ่ม “ตั้งเป็นตัวแทนจำหน่าย”";
  if (p.dealerCode && !/^[A-Z]{2,5}$/.test(p.dealerCode)) return "รหัสตัวแทนต้องเป็นตัวอักษร A–Z 2–5 ตัว";
  return null;
}

/** ถึงกำหนดติดตามแล้ว (วันนัดติดตาม ≤ วันนี้) และยังไม่จบ */
export function ถึงกำหนดติดตาม(p: Pick<DealerProspect, "status" | "followUp">, วันนี้ISO: string): boolean {
  return ยังติดตามอยู่(p.status) && !!p.followUp && p.followUp <= วันนี้ISO;
}

/** ตัวเลขสรุปบนหัวหน้า — อัตราสำเร็จคิดจากรายที่ "จบแล้ว" เท่านั้น
 *  (เอารายที่ยังติดตามอยู่มาหารด้วย จะดูเหมือนทีมทำได้แย่ทั้งที่ยังไม่ถึงเวลาตัดสิน)
 *  ยังไม่มีรายที่จบ = null → หน้าจอขึ้น "—" ไม่ใช่ 0% */
export function สรุปผู้สนใจ(list: DealerProspect[], วันนี้ISO: string) {
  const เป็นตัวแทน = list.filter(p => p.status === "won").length;
  const ไม่สำเร็จ = list.filter(p => p.status === "lost").length;
  const จบแล้ว = เป็นตัวแทน + ไม่สำเร็จ;
  return {
    ทั้งหมด: list.length,
    กำลังติดตาม: list.filter(p => ยังติดตามอยู่(p.status)).length,
    ถึงกำหนด: list.filter(p => ถึงกำหนดติดตาม(p, วันนี้ISO)).length,
    เป็นตัวแทน,
    ไม่สำเร็จ,
    อัตราสำเร็จ: จบแล้ว > 0 ? Math.round((เป็นตัวแทน / จบแล้ว) * 100) : null,
  };
}

/** ค้นหาแบบพิมพ์คำเดียวเจอทุกช่องที่คนมักจำได้ — เบอร์โทรเทียบเฉพาะตัวเลข (พิมพ์ขีด/เว้นวรรคต่างกันก็เจอ) */
export function ตรงกับคำค้น(p: DealerProspect, คำค้น: string): boolean {
  const q = คำค้น.trim().toLowerCase();
  if (!q) return true;
  const เลขในคำค้น = q.replace(/\D/g, "");
  if (เลขในคำค้น.length >= 3 && String(p.phone ?? "").replace(/\D/g, "").includes(เลขในคำค้น)) return true;
  return [p.name, p.social, p.region, p.province, p.businessType, p.channel, p.note, p.dealerCode, p.assigned]
    .some(v => String(v ?? "").toLowerCase().includes(q));
}
