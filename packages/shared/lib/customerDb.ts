"use client";

// ─── ฐานข้อมูลลูกค้าทั้งเครือ (Customer Database — หลังปิดการขาย) ──────────────────
// หน้า /hq/customers เป็น "ฐานข้อมูลลูกค้าหลังปิดการขาย" ไม่ใช่ pipeline
// → ข้อมูลอาคาร/วันส่งมอบ ทั้งหมด derive จาก "ใบเสนอราคาที่ปิดการขายได้" เท่านั้น
//
// แหล่งข้อมูล (ไม่มี seed ใหม่ ไม่มีการกุค่า):
//   ลูกค้า        = useNetworkCustomers()   (live CNX + seed สาขาอื่น)
//   ใบเสนอราคา    = useNetworkQuotations()  (live CNX + seed สาขาอื่น)
//   จับคู่ด้วย     ชื่อลูกค้า + รหัสตัวแทน  (ต้องตรงทั้งคู่ กันข้ามสาขาชื่อซ้ำ)
//   วันส่งมอบ     = delivery.ts (วันปิดการขาย + ระยะส่งมอบ)
//
// ลูกค้าที่ไม่มีใบปิดการขายจับคู่ได้ → ไม่มีอาคาร/ส่งมอบ = null → หน้าแสดง "—"
// (ห้ามเดาแทน — ลูกค้า seed หลายรายมี dealsWon แต่ไม่มีใบในระบบ ถือว่าไม่มีข้อมูล)
import { useMemo, useState, useEffect } from "react";
import { mainTemplateOf, fmtISOToThai, type HQCustomer } from "@pms/shared/lib/mock";
import { useNetworkCustomersDb, useNetworkCustomers, useNetworkQuotations } from "@pms/shared/lib/useNetworkData";
import { useSales } from "@pms/shared/context/SalesContext";
import { deliveryDateOf, parseThaiDate } from "@pms/shared/lib/delivery";
import { metrics as metricsRepo } from "@pms/shared/lib/data";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";
import { logRepoRead } from "@pms/shared/lib/repoLog";
import type { WonBuildingRaw } from "@pms/shared/lib/data/ports";

// ─── ภาค (ข้อเท็จจริงทางภูมิศาสตร์ — ไม่ใช่ข้อมูลธุรกิจที่กุขึ้น) ────────────────────
// สะกดให้ตรงกับ dealer.region (mock.ts seed / hq/dealers / hq/pipeline) = "อีสาน" ไม่ใช่ "ตะวันออกเฉียงเหนือ"
//   เดิมสะกดคนละแบบ → ของสองระบบเทียบกันไม่ตรง (regionDisplay ต้อง special-case "อีสาน" อยู่แล้วเพื่อขยายชื่อเต็ม) · 1.4
export const REGIONS = ["เหนือ", "อีสาน", "กลาง", "ตะวันออก", "ตะวันตก", "ใต้"] as const;
export type Region = (typeof REGIONS)[number];

const REGION_OF: Record<string, Region> = {};
const put = (region: Region, provinces: string[]) => provinces.forEach(p => { REGION_OF[p] = region; });

put("เหนือ", ["เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน", "น่าน", "พะเยา", "แพร่", "อุตรดิตถ์"]);
put("อีสาน", ["กาฬสินธุ์", "ขอนแก่น", "ชัยภูมิ", "นครพนม", "นครราชสีมา", "บึงกาฬ", "บุรีรัมย์", "มหาสารคาม", "มุกดาหาร", "ยโสธร", "ร้อยเอ็ด", "เลย", "ศรีสะเกษ", "สกลนคร", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อำนาจเจริญ", "อุดรธานี", "อุบลราชธานี"]);
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
};

export type CustomerDbRow = HQCustomer & {
  region: Region | null;
  buildings: PurchasedBuilding[];
  buildingTypes: string[];      // แม่แบบหลักที่ซื้อ (ไม่ซ้ำ)
  templates: string[];          // แม่แบบย่อยที่ซื้อ (ไม่ซ้ำ)
  /** วันส่งมอบล่าสุด — ลูกค้าซื้อหลายอาคารจะยึดอาคารที่ส่งมอบทีหลังสุด */
  deliveredAt: Date | null;
  lastPurchase: string | null;  // วันปิดการขายล่าสุด (ไทย)
  lastPurchaseAt: Date | null;
  isRepeat: boolean;            // ซื้อซ้ำ = มีอาคารที่ซื้อแล้วมากกว่า 1
};

// ข้อมูลขั้นต่ำที่ใช้สร้าง 1 อาคาร — HQQuotation ก็เข้าได้ (fallback) · rollup จาก DB map มาให้ (M9 Phase 2)
export type BuildingSrc = { quoteNo: string; productLine: string; valueNum: number; createdAt: string; deliveryTime?: string };
export const buildingOf = (q: BuildingSrc): PurchasedBuilding => {
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
  };
};

// จับกลุ่มใบ won ตามลูกค้าที่ DB (M9 Phase 2) — supabase เท่านั้น · local คืน null → ใช้ client group เดิม
// reactive: refetch เมื่อ quotations เปลี่ยน (trigger = อาร์เรย์จาก SalesContext)
function useCustomerRollup(trigger: unknown): Map<string, WonBuildingRaw[]> | null {
  const [rollup, setRollup] = useState<Map<string, WonBuildingRaw[]> | null>(null);
  useEffect(() => {
    if (DATA_SOURCE !== "supabase") { setRollup(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      metricsRepo.customerRollup().then(r => { if (alive) setRollup(r); }).catch(e => logRepoRead("metrics.customerRollup", e));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [trigger]);
  return rollup;
}

/**
 * ลูกค้าทั้งเครือ + ข้อมูลหลังปิดการขายที่ derive จากใบเสนอราคาจริง
 * ไม่มีใบปิดการขาย = buildings ว่าง → ทุกช่องหลังปิดการขายเป็น null
 */
export function useCustomerDb(): CustomerDbRow[] {
  const customers = useNetworkCustomersDb();
  const quotations = useNetworkQuotations();
  const { salesVersion } = useSales();
  const rollup = useCustomerRollup(salesVersion); // supabase: group ที่ DB · local/ยังไม่กลับ: null

  return useMemo(() => {
    // อาคารต่อลูกค้า (BuildingSrc):
    //   supabase → จาก rollup (group ที่ DB) · date(ISO) → createdAt ไทยด้วย fmtISOToThai (เท่า useNetworkQuotations)
    //   local/ยังไม่กลับ → จัดใบ won ฝั่ง client ตาม (รหัสตัวแทน|ชื่อลูกค้า) เหมือนเดิม
    const srcByCustomer = new Map<string, BuildingSrc[]>();
    if (rollup) {
      for (const [key, raws] of rollup) {
        srcByCustomer.set(key, raws.map(r => ({ quoteNo: r.quoteNo, productLine: r.productLine, valueNum: r.valueNum, createdAt: fmtISOToThai(r.date) })));
      }
    } else {
      quotations.forEach(q => {
        if (q.status !== "won") return;
        const key = `${q.dealerCode}|${q.customer}`;
        const b: BuildingSrc = { quoteNo: q.quoteNo, productLine: q.productLine ?? "", valueNum: q.valueNum, createdAt: q.createdAt, deliveryTime: q.deliveryTime };
        const list = srcByCustomer.get(key);
        if (list) list.push(b); else srcByCustomer.set(key, [b]);
      });
    }

    return customers.map((c): CustomerDbRow => {
      const won = srcByCustomer.get(`${c.dealerCode}|${c.name}`) ?? [];
      // เรียงตามวันปิดการขาย เก่า → ใหม่ (ใบที่อ่านวันไม่ได้ไปท้ายสุด)
      const buildings = won
        .map(buildingOf)
        .sort((a, b) => (a.wonAt?.getTime() ?? 0) - (b.wonAt?.getTime() ?? 0));

      // type predicate แทน .filter(b => b.deliveredAt) เฉย ๆ — ให้ TS แคบชนิดจริง ไม่ต้องพึ่ง ! ต่อจากนี้
      const latest = [...buildings]
        .filter((b): b is PurchasedBuilding & { deliveredAt: Date } => !!b.deliveredAt)
        .sort((a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime())
        .pop() ?? null;
      const lastBuy = [...buildings].filter(b => b.wonAt).pop() ?? null;

      return {
        ...c,
        region: regionOf(c.province),
        buildings,
        buildingTypes: [...new Set(buildings.map(b => b.buildingType).filter(Boolean))],
        templates: [...new Set(buildings.map(b => b.template).filter((t): t is string => !!t))],
        deliveredAt: latest?.deliveredAt ?? null,
        lastPurchase: lastBuy?.wonDate ?? null,
        lastPurchaseAt: lastBuy?.wonAt ?? null,
        isRepeat: buildings.length > 1,
      };
    });
    // rollup โหลด async (supabase) — ต้องอยู่ใน deps ไม่งั้น memo คืนผลตอน rollup ยังเป็น null
    // → /hq/customers โชว์อาคาร/ประวัติซื้อว่างทั้งที่มีดีลปิดแล้ว (race กับ salesVersion) · M2
  }, [customers, quotations, rollup]);
}

/**
 * เวอร์ชัน "ไม่ยิง fetch เลย" ของ useCustomerDb() — ใช้ useNetworkCustomers() (ไม่ใช่ useNetworkCustomersDb)
 * และไม่เรียก customerRollup RPC เลย (คำนวณจาก quotations ในเครื่องตรง ๆ เสมอ)
 *
 * เหตุผลที่ต้องมีคู่กัน: หน้าที่มี RPC เฉพาะทางของตัวเองแล้ว (เช่น /hq/customers → hq_customers_page,
 * M9 Phase 6) ไม่ควรมีทางดึงข้อมูลทั้งเครือซ้ำสองทางพร้อมกัน — useCustomerDb() เดิมยิง fetch เองไม่ว่าใครเรียก
 * (useNetworkCustomersDb + customerRollup ยิง RPC ทั้งคู่ทันทีที่ DATA_SOURCE=supabase ไม่สนใจว่าหน้าเรียกจะ
 * ใช้ผลจริงหรือไม่) ถ้าเอามาใช้เป็น fallback เฉย ๆ จะได้ full-network fetch ซ้ำอีกชุดโดยไม่จำเป็น
 *
 * local/demo mode: ได้ค่าจริงปกติ (SalesContext โหลดไว้ในเครื่องอยู่แล้ว ไม่ต้องดึงเพิ่ม)
 * HQ+supabase mode: ว่างเปล่าเสมอ (SalesContext gate ไม่โหลด array ทั้งเครือให้ฝั่ง HQ — ตั้งใจ) — ใช้เป็น
 *   fallback ที่ "ไม่ทำอะไรเลย" ตอนหน้ามี RPC ของตัวเองอยู่แล้ว (pageResult ไม่ null) เหมือน useNetworkQuotations()
 *   ที่ /hq/quotations ใช้เป็น fallback ของ useHQQuotationsSummary/useQuotationsPage
 */
export function useCustomerDbLocal(): CustomerDbRow[] {
  const customers = useNetworkCustomers();
  const quotations = useNetworkQuotations();
  return useMemo(() => {
    const srcByCustomer = new Map<string, BuildingSrc[]>();
    quotations.forEach(q => {
      if (q.status !== "won") return;
      const key = `${q.dealerCode}|${q.customer}`;
      const b: BuildingSrc = { quoteNo: q.quoteNo, productLine: q.productLine ?? "", valueNum: q.valueNum, createdAt: q.createdAt, deliveryTime: q.deliveryTime };
      const list = srcByCustomer.get(key);
      if (list) list.push(b); else srcByCustomer.set(key, [b]);
    });

    return customers.map((c): CustomerDbRow => {
      const won = srcByCustomer.get(`${c.dealerCode}|${c.name}`) ?? [];
      const buildings = won
        .map(buildingOf)
        .sort((a, b) => (a.wonAt?.getTime() ?? 0) - (b.wonAt?.getTime() ?? 0));
      const latest = [...buildings]
        .filter((b): b is PurchasedBuilding & { deliveredAt: Date } => !!b.deliveredAt)
        .sort((a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime())
        .pop() ?? null;
      const lastBuy = [...buildings].filter(b => b.wonAt).pop() ?? null;

      return {
        ...c,
        region: regionOf(c.province),
        buildings,
        buildingTypes: [...new Set(buildings.map(b => b.buildingType).filter(Boolean))],
        templates: [...new Set(buildings.map(b => b.template).filter((t): t is string => !!t))],
        deliveredAt: latest?.deliveredAt ?? null,
        lastPurchase: lastBuy?.wonDate ?? null,
        lastPurchaseAt: lastBuy?.wonAt ?? null,
        isRepeat: buildings.length > 1,
      };
    });
  }, [customers, quotations]);
}
