"use client";

// ─── ฐานข้อมูลลูกค้าทั้งเครือ (Customer Database — หลังปิดการขาย) ──────────────────
// หน้า /hq/customers เป็น "ฐานข้อมูลลูกค้าหลังปิดการขาย" ไม่ใช่ pipeline
// → ข้อมูลอาคาร/วันส่งมอบ/ประกัน ทั้งหมด derive จาก "ใบเสนอราคาที่ปิดการขายได้" เท่านั้น
//
// แหล่งข้อมูล (ไม่มี seed ใหม่ ไม่มีการกุค่า):
//   ลูกค้า        = useNetworkCustomers()   (live CNX + seed สาขาอื่น)
//   ใบเสนอราคา    = useNetworkQuotations()  (live CNX + seed สาขาอื่น)
//   จับคู่ด้วย     ชื่อลูกค้า + รหัสตัวแทน  (ต้องตรงทั้งคู่ กันข้ามสาขาชื่อซ้ำ)
//   วันส่งมอบ/ประกัน = warranty.ts (วันปิดการขาย + ระยะส่งมอบ → +10 ปี)
//
// ลูกค้าที่ไม่มีใบปิดการขายจับคู่ได้ → ไม่มีอาคาร/ส่งมอบ/ประกัน = null → หน้าแสดง "—"
// (ห้ามเดาแทน — ลูกค้า seed หลายรายมี dealsWon แต่ไม่มีใบในระบบ ถือว่าไม่มีข้อมูล)
import { useMemo } from "react";
import { mainTemplateOf, type HQCustomer, type HQQuotation } from "@/lib/mock";
import { useNetworkCustomers, useNetworkQuotations } from "@/lib/useNetworkData";
import { warrantyOf, deliveryDateOf, parseThaiDate, TODAY, type Warranty } from "@/lib/warranty";

// ─── ภาค (ข้อเท็จจริงทางภูมิศาสตร์ — ไม่ใช่ข้อมูลธุรกิจที่กุขึ้น) ────────────────────
export const REGIONS = ["เหนือ", "ตะวันออกเฉียงเหนือ", "กลาง", "ตะวันออก", "ตะวันตก", "ใต้"] as const;
export type Region = (typeof REGIONS)[number];

const REGION_OF: Record<string, Region> = {};
const put = (region: Region, provinces: string[]) => provinces.forEach(p => { REGION_OF[p] = region; });

put("เหนือ", ["เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน", "น่าน", "พะเยา", "แพร่", "อุตรดิตถ์"]);
put("ตะวันออกเฉียงเหนือ", ["กาฬสินธุ์", "ขอนแก่น", "ชัยภูมิ", "นครพนม", "นครราชสีมา", "บึงกาฬ", "บุรีรัมย์", "มหาสารคาม", "มุกดาหาร", "ยโสธร", "ร้อยเอ็ด", "เลย", "ศรีสะเกษ", "สกลนคร", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อำนาจเจริญ", "อุดรธานี", "อุบลราชธานี"]);
put("กลาง", ["กรุงเทพมหานคร", "กรุงเทพฯ", "กำแพงเพชร", "ชัยนาท", "นครนายก", "นครปฐม", "นครสวรรค์", "นนทบุรี", "ปทุมธานี", "พระนครศรีอยุธยา", "พิจิตร", "พิษณุโลก", "เพชรบูรณ์", "ลพบุรี", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "อ่างทอง", "อุทัยธานี"]);
put("ตะวันออก", ["จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ตราด", "ปราจีนบุรี", "ระยอง", "สระแก้ว"]);
put("ตะวันตก", ["กาญจนบุรี", "ตาก", "ประจวบคีรีขันธ์", "เพชรบุรี", "ราชบุรี"]);
put("ใต้", ["กระบี่", "ชุมพร", "ตรัง", "นครศรีธรรมราช", "นราธิวาส", "ปัตตานี", "พังงา", "พัทลุง", "ภูเก็ต", "ยะลา", "ระนอง", "สงขลา", "สตูล", "สุราษฎร์ธานี"]);

/** ภาคของจังหวัด · จังหวัดที่ไม่รู้จัก = null (หน้าแสดง "—") */
export const regionOf = (province: string): Region | null => REGION_OF[(province ?? "").trim()] ?? null;

// ─── อาคารที่ลูกค้าซื้อไปแล้ว (1 ใบที่ปิดการขายได้ = 1 อาคาร) ────────────────────
export type PurchasedBuilding = {
  quoteNo: string;
  product: string;          // ชื่อสินค้าบนใบ (อาจเป็นแม่แบบหลักหรือแม่แบบย่อย)
  buildingType: string;     // แม่แบบหลักของ Master Catalog
  template: string | null;  // แม่แบบย่อย — ไม่มี = ใบระบุแค่แม่แบบหลัก
  value: number;
  wonDate: string;          // วันปิดการขาย (ไทย)
  wonAt: Date | null;
  deliveredAt: Date | null; // วันส่งมอบ = วันปิดการขาย + ระยะส่งมอบ
  warranty: Warranty | null;
};

export type CustomerDbRow = HQCustomer & {
  region: Region | null;
  buildings: PurchasedBuilding[];
  buildingTypes: string[];      // แม่แบบหลักที่ซื้อ (ไม่ซ้ำ)
  templates: string[];          // แม่แบบย่อยที่ซื้อ (ไม่ซ้ำ)
  /** วันส่งมอบล่าสุด — ลูกค้าซื้อหลายอาคารจะยึดอาคารที่ส่งมอบทีหลังสุด */
  deliveredAt: Date | null;
  /** ประกันของอาคารที่ส่งมอบล่าสุด */
  warranty: Warranty | null;
  lastPurchase: string | null;  // วันปิดการขายล่าสุด (ไทย)
  lastPurchaseAt: Date | null;
  isRepeat: boolean;            // ซื้อซ้ำ = มีอาคารที่ซื้อแล้วมากกว่า 1
};

/** ประกันใกล้หมด = ยังไม่หมด แต่เหลือไม่ถึง 12 เดือน */
export function isWarrantyExpiringSoon(w: Warranty | null): boolean {
  if (!w || w.status !== "active") return false;
  const exp = parseThaiDate(w.expiry);
  if (!exp) return false;
  const limit = new Date(TODAY);
  limit.setFullYear(limit.getFullYear() + 1);
  return exp <= limit;
}

const buildingOf = (q: HQQuotation): PurchasedBuilding => {
  const product = q.productLine ?? "";
  const main = mainTemplateOf(product) || product;
  return {
    quoteNo: q.quoteNo,
    product,
    buildingType: main,
    template: product && product !== main ? product : null,
    value: q.valueNum,
    wonDate: q.createdAt,
    wonAt: parseThaiDate(q.createdAt),
    deliveredAt: deliveryDateOf(q.createdAt, q.deliveryTime),
    warranty: warrantyOf(q.createdAt, q.deliveryTime),
  };
};

/**
 * ลูกค้าทั้งเครือ + ข้อมูลหลังปิดการขายที่ derive จากใบเสนอราคาจริง
 * ไม่มีใบปิดการขาย = buildings ว่าง → ทุกช่องหลังปิดการขายเป็น null
 */
export function useCustomerDb(): CustomerDbRow[] {
  const customers = useNetworkCustomers();
  const quotations = useNetworkQuotations();

  return useMemo(() => {
    // จัดใบที่ "ปิดการขายได้" เข้ากลุ่มตาม ชื่อลูกค้า + รหัสตัวแทน
    const wonByCustomer = new Map<string, HQQuotation[]>();
    quotations.forEach(q => {
      if (q.status !== "won") return;
      const key = `${q.dealerCode}|${q.customer}`;
      const list = wonByCustomer.get(key);
      if (list) list.push(q);
      else wonByCustomer.set(key, [q]);
    });

    return customers.map((c): CustomerDbRow => {
      const won = wonByCustomer.get(`${c.dealerCode}|${c.name}`) ?? [];
      // เรียงตามวันปิดการขาย เก่า → ใหม่ (ใบที่อ่านวันไม่ได้ไปท้ายสุด)
      const buildings = won
        .map(buildingOf)
        .sort((a, b) => (a.wonAt?.getTime() ?? 0) - (b.wonAt?.getTime() ?? 0));

      const latest = [...buildings]
        .filter(b => b.deliveredAt)
        .sort((a, b) => a.deliveredAt!.getTime() - b.deliveredAt!.getTime())
        .pop() ?? null;
      const lastBuy = [...buildings].filter(b => b.wonAt).pop() ?? null;

      return {
        ...c,
        region: regionOf(c.province),
        buildings,
        buildingTypes: [...new Set(buildings.map(b => b.buildingType).filter(Boolean))],
        templates: [...new Set(buildings.map(b => b.template).filter((t): t is string => !!t))],
        deliveredAt: latest?.deliveredAt ?? null,
        warranty: latest?.warranty ?? null,
        lastPurchase: lastBuy?.wonDate ?? null,
        lastPurchaseAt: lastBuy?.wonAt ?? null,
        isRepeat: buildings.length > 1,
      };
    });
  }, [customers, quotations]);
}
