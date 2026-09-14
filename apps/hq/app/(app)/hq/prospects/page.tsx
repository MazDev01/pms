"use client";

// ─── HQ · ลูกค้าเป้าหมายของสำนักงานใหญ่ (ผู้สนใจเป็นตัวแทนจำหน่าย) ────────────────────
//
// บอสสั่ง 14 ก.ย. 69: "เพิ่มโมดูลลูกค้าเป้าหมายของทางฝั่ง HQ และเมื่อสำเร็จจากลูกค้าเป้าหมาย
//   จะกลายเป็นตัวแทนจำหน่าย"
//
// เส้นทาง: เพิ่มผู้สนใจ → ติดตามตามขั้น → "ตั้งเป็นตัวแทนจำหน่าย"
//   • สร้างตัวแทนใหม่พร้อมบัญชีเข้าระบบ (ใช้ route เดียวกับหน้าตัวแทนจำหน่าย · ผูกรายนี้ในคำขอเดียวกัน)
//   • หรือผูกกับตัวแทนที่มีอยู่แล้ว (ผู้สนใจหลายรายในไฟล์ของเบนจามินถูกสร้างเป็นตัวแทนไปก่อนแล้ว)
//
// ⚠️ คนละเรื่องกับ "ลูกค้าเป้าหมายทั้งเครือ" (/hq/leads = ลูกค้าที่จะซื้ออาคารของตัวแทน)
//    ข้อมูลอยู่คนละตาราง (dealer_prospects · migration 0170) ไม่นับรวมในตัวเลขงานขายใด ๆ
//
// สิทธิ์: ดูได้ทุกบทบาทฝั่งสำนักงานใหญ่ · เพิ่ม/แก้/ลบ/ตั้งเป็นตัวแทน = ผู้มีสิทธิ์จัดการตัวแทน (dealers:manage)
//   RLS ของ 0170 บังคับซ้ำที่ฐานข้อมูล — การซ่อนปุ่มตรงนี้เป็นแค่ความสะดวก ไม่ใช่ด่านจริง
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  UserPlus, Users, AlarmClock, Store, Percent, Search, X, Trash2, Copy, Check,
} from "lucide-react";
import { prospects as prospectsRepo, dealers as dealersRepo, proposals as proposalsRepo } from "@pms/shared/lib/data";
import { invalidateCache } from "@pms/shared/lib/data/dedupe";
import type { DealerPackageProposal, DealerProspect, DealerProspectStatus, DealerRow } from "@pms/shared/lib/data/types";
import {
  PROSPECT_STATUS_ORDER, prospectStatusLabel, prospectStatusColor,
  เตรียมบันทึก, ตรวจผู้สนใจ, ถึงกำหนดติดตาม, สรุปผู้สนใจ, ตรงกับคำค้น,
} from "@pms/shared/lib/dealerProspects";
import { REGIONS, ALL_REGIONS, ALL_PROVINCES, provincesOfRegion, regionOf } from "@pms/shared/lib/provinces";
import { createDealerAccount } from "@pms/shared/lib/adminApi";
import { REAL_BACKEND } from "@pms/shared/lib/data/config";
import { ProspectProposalsPanel } from "@pms/shared/components/hq/ProspectProposalsPanel";
import { มีใบเสนอที่ส่งแล้ว, ใบหลักสำหรับตั้งตัวแทน, มูลค่าอ่านง่าย } from "@pms/shared/lib/dealerProposals";
import { useRole } from "@pms/shared/context/RoleContext";
import { useAuditLogger } from "@pms/shared/lib/useAudit";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { ExportMenu } from "@pms/shared/components/ui/ExportMenu";
import { TopbarActions } from "@pms/shared/components/layout/TopbarActions";
import { ModalCard } from "@pms/shared/components/ui/ModalCard";
import { TablePagination, pageSlice } from "@pms/shared/components/ui/TablePagination";
import { ClickableRow } from "@pms/shared/components/ui/ClickableRow";
import { ยืนยัน, แจ้งพลาด, แจ้งสำเร็จ } from "@pms/shared/components/ui/ConfirmToast";
import { formatPhone } from "@pms/shared/lib/format";
import { fmtISOToThai } from "@pms/shared/lib/mock";
import { friendlyError } from "@pms/shared/lib/friendlyError";
import { logRepoRead } from "@pms/shared/lib/repoLog";

const PRIMARY = "#003366";
const MUTED = "#6b7280";
const HQ_CODE = "HQ";
// ช่องทางที่ทีมใช้จริงในไฟล์ติดตาม — ช่องนี้พิมพ์เองได้ รายการนี้เป็นแค่ตัวช่วยเติมคำ
const ช่องทางแนะนำ = ["Facebook", "LINE OA", "LINE ส่วนตัว", "โทรเข้ามาเอง", "แนะนำต่อ"];

const ร่างว่าง = (): Partial<DealerProspect> => ({ name: "", status: "new", firstContact: APP_NOW_ISO });

type ฟอร์มตัวแทน = { code: string; name: string; region: string; province: string; email: string; password: string; existingCode: string };

export default function HQProspectsPage() {
  const { can } = useRole();
  const จัดการได้ = can("dealers:manage");
  const logAudit = useAuditLogger();

  const [list, setList] = useState<DealerProspect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [dealers, setDealers] = useState<DealerRow[]>([]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "due" | DealerProspectStatus>("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [page, setPage] = useState(0);

  const [editing, setEditing] = useState<DealerProspect | "new" | null>(null);
  const [ร่าง, setร่าง] = useState<Partial<DealerProspect>>(ร่างว่าง());
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [converting, setConverting] = useState<DealerProspect | null>(null);
  const [โหมดตั้ง, setโหมดตั้ง] = useState<"new" | "existing">("new");
  const [ฟอร์ม, setฟอร์ม] = useState<ฟอร์มตัวแทน>({ code: "", name: "", region: "", province: "", email: "", password: "", existingCode: "" });
  const [convErr, setConvErr] = useState("");
  const [convBusy, setConvBusy] = useState(false);
  const [creds, setCreds] = useState<{ name: string; code: string; email: string; password: string } | null>(null);
  // ใบเสนอแพ็กเกจของรายที่เปิดอยู่ (แผงใบเสนอส่งมาให้) — ใช้ตัดสินว่ากดสร้างตัวแทนใหม่ได้หรือยัง
  const [ใบของรายที่เปิด, setใบของรายที่เปิด] = useState<DealerPackageProposal[]>([]);
  const [คัดลอกแล้ว, setคัดลอกแล้ว] = useState("");

  const โหลด = useCallback(async () => {
    try {
      setList(await prospectsRepo.list());
      setLoadErr("");
    } catch (e) {
      // ห้ามปล่อยตารางว่างเงียบ ๆ — ผู้ใช้จะนึกว่ายังไม่มีข้อมูล แล้วกรอกซ้ำ
      setLoadErr(friendlyError(e, "โหลดลูกค้าเป้าหมายไม่สำเร็จ"));
    } finally {
      setLoaded(true);
    }
  }, []);
  const โหลดตัวแทน = useCallback(() => {
    dealersRepo.list().then(setDealers).catch(e => logRepoRead("dealers.list", e));
  }, []);
  useEffect(() => { void โหลด(); โหลดตัวแทน(); }, [โหลด, โหลดตัวแทน]);

  // ?open=ID → เปิดหน้าต่างรายนั้นหลังโหลดรายการเสร็จ (ลิงก์จากหน้าใบเสนอแพ็กเกจ) · ล้างพารามิเตอร์กันเปิดซ้ำตอนรีเฟรช
  //   ไม่พบ = บอกตรง ๆ ไม่เงียบ (รายนั้นอาจถูกลบไปแล้ว)
  const เปิดจากลิงก์แล้ว = useRef(false);
  useEffect(() => {
    if (!loaded || เปิดจากลิงก์แล้ว.current) return;
    เปิดจากลิงก์แล้ว.current = true;
    const รหัส = new URLSearchParams(window.location.search).get("open");
    if (!รหัส) return;
    window.history.replaceState(null, "", "/hq/prospects");
    const ราย = list.find(x => String(x.id) === รหัส);
    if (ราย) เปิดแก้(ราย);
    else if (!loadErr) แจ้งพลาด("ไม่พบลูกค้าเป้าหมายรายนี้ — อาจถูกลบหรือลิงก์ไม่ถูกต้อง");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ทำครั้งเดียวตอนโหลดเสร็จ ไม่ต้องทำซ้ำเมื่อรายการเปลี่ยน
  }, [loaded]);

  const ชื่อตัวแทน = useMemo(() => new Map(dealers.map(d => [d.code, d.name])), [dealers]);
  const จังหวัดในข้อมูล = useMemo(
    () => [...new Set(list.map(p => (p.province ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [list],
  );

  const filtered = useMemo(() => list.filter(p =>
    (statusFilter === "all" || (statusFilter === "due" ? ถึงกำหนดติดตาม(p, APP_NOW_ISO) : p.status === statusFilter))
    && (provinceFilter === "all" || (p.province ?? "").trim() === provinceFilter)
    && ตรงกับคำค้น(p, q),
  ), [list, statusFilter, provinceFilter, q]);

  // การ์ดตัวเลขคิดจาก "ผลที่กรองอยู่" — ตรงกับสิ่งที่ตารางแสดง (กติกาเดียวกับทุกหน้า HQ)
  const สรุป = useMemo(() => สรุปผู้สนใจ(filtered, APP_NOW_ISO), [filtered]);

  // ── เพิ่ม / แก้ไข ──
  function เปิดเพิ่ม() {
    setEditing("new"); setร่าง(ร่างว่าง()); setFormErr("");
  }
  function เปิดแก้(p: DealerProspect) {
    // รายเก่าที่ยังไม่มีภาค แต่จังหวัดเป็นจังหวัดที่ระบบรู้จัก → เติมภาคให้ในฟอร์ม จะได้เลือกจังหวัดต่อได้ทันที
    setEditing(p); setร่าง({ ...p, region: p.region || regionOf(p.province ?? "") }); setFormErr(""); setใบของรายที่เปิด([]);
  }
  const ตั้งค่า = <K extends keyof DealerProspect>(k: K, v: DealerProspect[K]) => setร่าง(r => ({ ...r, [k]: v }));
  // เปลี่ยนภาค → ล้างจังหวัดที่ไม่อยู่ในภาคใหม่ (กันภาค "ใต้" คู่จังหวัด "เชียงใหม่") · "ทุกภาค" = "ทุกจังหวัด" ให้เอง
  const เปลี่ยนภาคร่าง = (region: string) => setร่าง(r => ({
    ...r,
    region: region || null,
    province: region === ALL_REGIONS ? ALL_PROVINCES
      : region && provincesOfRegion(region).includes(r.province ?? "") ? r.province : null,
  }));

  async function บันทึก() {
    if (!editing) return;
    const row = เตรียมบันทึก(ร่าง);
    const ผิด = ตรวจผู้สนใจ(row);
    if (ผิด) { setFormErr(ผิด); return; }
    setSaving(true); setFormErr("");
    try {
      if (editing === "new") {
        const saved = await prospectsRepo.create(row);
        setList(l => [saved, ...l]);
        logAudit("เพิ่มลูกค้าเป้าหมาย (HQ)", saved.name);
        แจ้งสำเร็จ(`เพิ่ม “${saved.name}” แล้ว`);
      } else {
        const saved = await prospectsRepo.update({ ...row, id: editing.id, createdAt: editing.createdAt });
        setList(l => l.map(x => x.id === saved.id ? saved : x));
        logAudit("แก้ไขลูกค้าเป้าหมาย (HQ)", `${saved.name} · ${prospectStatusLabel[saved.status]}`);
      }
      setEditing(null);
    } catch (e) {
      setFormErr(friendlyError(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  }

  async function ลบ(p: DealerProspect) {
    if (!(await ยืนยัน({
      หัวข้อ: `ลบ “${p.name}” ออกจากลูกค้าเป้าหมาย ?`,
      // ลบรายที่เป็นตัวแทนแล้ว = ลบแค่ประวัติการติดตาม ตัวแทนและบัญชีเข้าระบบยังอยู่ครบ — ต้องบอกให้ชัด
      รายละเอียด: p.status === "won" && p.dealerCode
        ? `ตัวแทนจำหน่าย ${p.dealerCode} ที่สร้างไปแล้วจะยังอยู่ครบ — ลบเฉพาะประวัติการติดตามรายนี้ · ย้อนกลับไม่ได้`
        : "การกระทำนี้ย้อนกลับไม่ได้",
      ปุ่มตกลง: "ลบลูกค้าเป้าหมาย", อันตราย: true,
    }))) return;
    try {
      await prospectsRepo.remove(p.id);
      setList(l => l.filter(x => x.id !== p.id));
      logAudit("ลบลูกค้าเป้าหมาย (HQ)", p.name);
      setEditing(null);
    } catch (e) {
      แจ้งพลาด(friendlyError(e, "ลบไม่สำเร็จ"));
    }
  }

  // ── ตั้งเป็นตัวแทนจำหน่าย ──
  function เปิดตั้งตัวแทน(p: DealerProspect) {
    // เดาภาคจากจังหวัดที่บันทึกไว้ให้ก่อน — ถ้าจังหวัดสะกดไม่ตรงรายการ ปล่อยว่างให้เลือกเอง ไม่เดาต่อ
    const ภาค = p.region || regionOf(p.province ?? "") || "";
    const จังหวัดเดิม = (p.province ?? "").trim();
    const จังหวัดใช้ได้ = ภาค === ALL_REGIONS
      ? จังหวัดเดิม === ALL_PROVINCES || provincesOfRegion(ALL_REGIONS).includes(จังหวัดเดิม)
      : !!ภาค && provincesOfRegion(ภาค).includes(จังหวัดเดิม);
    setConverting(p);
    setโหมดตั้ง("new");
    setฟอร์ม({
      code: "", name: p.name, region: ภาค,
      province: จังหวัดใช้ได้ ? จังหวัดเดิม : ภาค === ALL_REGIONS ? ALL_PROVINCES : "",
      email: p.email ?? "", password: "", existingCode: "",
    });
    setConvErr("");
  }

  function เปลี่ยนภาค(region: string) {
    setฟอร์ม(f => ({
      ...f, region,
      province: region === ALL_REGIONS ? ALL_PROVINCES : provincesOfRegion(region).includes(f.province) ? f.province : "",
    }));
  }

  async function ยืนยันตั้งตัวแทน() {
    if (!converting) return;
    setConvErr("");
    if (โหมดตั้ง === "existing") {
      if (!ฟอร์ม.existingCode) { setConvErr("ต้องเลือกตัวแทนจำหน่าย"); return; }
      const row = เตรียมบันทึก({
        ...converting, status: "won", dealerCode: ฟอร์ม.existingCode, convertedAt: new Date().toISOString(), lostReason: null,
      });
      const ผิด = ตรวจผู้สนใจ(row);
      if (ผิด) { setConvErr(ผิด); return; }
      setConvBusy(true);
      try {
        const saved = await prospectsRepo.update({ ...row, id: converting.id, createdAt: converting.createdAt });
        setList(l => l.map(x => x.id === saved.id ? saved : x));
        logAudit("ลูกค้าเป้าหมายเป็นตัวแทนแล้ว", `#${saved.id} → ${ฟอร์ม.existingCode} · ${saved.name}`);
        แจ้งสำเร็จ(`ผูก “${saved.name}” กับตัวแทน ${ฟอร์ม.existingCode} แล้ว`);
        setConverting(null); setEditing(null);
      } catch (e) {
        setConvErr(friendlyError(e, "บันทึกไม่สำเร็จ"));
      } finally {
        setConvBusy(false);
      }
      return;
    }

    // สร้างตัวแทนใหม่ — ตรวจที่หน้าจอก่อนเพื่อบอกตรงช่องที่ผิด (เซิร์ฟเวอร์ตรวจซ้ำเสมอ)
    if (!มีใบเสนอที่ส่งแล้ว(ใบของรายที่เปิด)) { setConvErr("ต้องส่งใบเสนอแพ็กเกจตัวแทนก่อน อย่างน้อย 1 ใบ"); return; }
    const code = ฟอร์ม.code.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(code)) { setConvErr("รหัสตัวแทนต้องเป็นตัวอักษร A–Z 2–5 ตัว (ห้ามมีตัวเลข)"); return; }
    if (dealers.some(d => d.code === code)) { setConvErr(`รหัส “${code}” มีอยู่แล้ว`); return; }
    if (!ฟอร์ม.name.trim()) { setConvErr("ต้องระบุชื่อตัวแทน"); return; }
    if (!ฟอร์ม.region) { setConvErr("ต้องเลือกภาคก่อน — รายการจังหวัดขึ้นกับภาคที่เลือก"); return; }
    if (!ฟอร์ม.province) { setConvErr("ต้องระบุจังหวัด"); return; }
    const อีเมล = ฟอร์ม.email.trim();
    if (อีเมล && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(อีเมล)) { setConvErr("รูปแบบอีเมลไม่ถูกต้อง"); return; }
    if (ฟอร์ม.password && ฟอร์ม.password.length < 8) { setConvErr("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"); return; }

    // โหมดเดโม (ไม่มีระบบยืนยันตัวตนจริง) — สร้างทะเบียนสาขาในเครื่องแล้วผูกรายนี้ ให้เล่นครบวงได้เหมือนของจริง
    //   ปุ่มเพิ่มตัวแทนตรง ๆ ของหน้าทะเบียนถูกถอดแล้ว (บอสสั่ง 14 ก.ย. 69) — ถ้าไม่ทำตรงนี้ เดโมจะสร้างตัวแทนไม่ได้เลย
    //   ⚠️ ตัวเก็บข้อมูลในเครื่อง "เขียนทับทั้งรายการ" ต้องส่งทะเบียนเดิมทั้งหมดไปด้วยเสมอ ไม่งั้นสาขาอื่นหายหมด
    if (!REAL_BACKEND) {
      setConvBusy(true);
      try {
        invalidateCache("dealers.list");
        const ทะเบียน = await dealersRepo.list();
        const แถวใหม่: DealerRow = {
          id: code, code, name: ฟอร์ม.name.trim(), province: ฟอร์ม.province, region: ฟอร์ม.region,
          revenueTarget: ใบหลักสำหรับตั้งตัวแทน(ใบของรายที่เปิด)?.annualTarget ?? 0, status: "active",
        };
        await dealersRepo.save([...ทะเบียน, แถวใหม่]);
        const row = เตรียมบันทึก({ ...converting, status: "won", dealerCode: code, convertedAt: new Date().toISOString(), lostReason: null });
        const saved = await prospectsRepo.update({ ...row, id: converting.id, createdAt: converting.createdAt });
        setList(l => l.map(x => x.id === saved.id ? saved : x));
        invalidateCache("dealers.list");
        โหลดตัวแทน();
        // ใบล่าสุดที่ส่งแล้ว → ตอบรับ (แบบเดียวกับที่เซิร์ฟเวอร์ทำในโหมดจริง)
        if (!ใบของรายที่เปิด.some(x => x.status === "accepted")) {
          const ใบส่งแล้ว = ใบของรายที่เปิด.find(x => x.status === "sent");
          if (ใบส่งแล้ว) await proposalsRepo.setStatus(ใบส่งแล้ว.id, "accepted");
        }
        logAudit("สร้างตัวแทน", `${code} · ${แถวใหม่.name} (จากลูกค้าเป้าหมาย #${saved.id})`);
        แจ้งสำเร็จ(`สร้างตัวแทน ${code} แล้ว (โหมดเดโม — ไม่มีบัญชีเข้าระบบจริง)`);
        setConverting(null); setEditing(null);
      } catch (e) {
        setConvErr(friendlyError(e, "สร้างตัวแทนไม่สำเร็จ"));
      } finally {
        setConvBusy(false);
      }
      return;
    }

    setConvBusy(true);
    const res = await createDealerAccount({
      code, name: ฟอร์ม.name.trim(), province: ฟอร์ม.province, region: ฟอร์ม.region,
      // เป้ายอดขายรายปี = เป้ายอดซื้อต่อปีในใบเสนอแพ็กเกจ (บอสสั่ง 14 ก.ย. 69) · ใบไม่ระบุ = 0 (ห้ามเดา)
      //   เซิร์ฟเวอร์อ่านจากใบด้วยกติกาเดียวกันอีกชั้น — ค่าตรงนี้เป็นแค่ค่าสำรองของคำขอ
      revenueTarget: ใบหลักสำหรับตั้งตัวแทน(ใบของรายที่เปิด)?.annualTarget ?? 0,
      email: อีเมล || undefined, password: ฟอร์ม.password || undefined,
      prospectId: converting.id,
    });
    setConvBusy(false);
    if (!res.ok) { setConvErr(res.error); return; } // ล้มเหลวต้องบอกจริง คงฟอร์มไว้ให้แก้

    // ทะเบียนตัวแทนถูกแคชไว้ 30 วินาที — ต้องล้างทันที ไม่งั้นหน้าตัวแทนจำหน่ายยังไม่เห็นสาขาใหม่
    invalidateCache("dealers.list");
    โหลดตัวแทน();
    await โหลด();
    if (res.prospectLinked === false) {
      // สาขาถูกสร้างแล้วจริง (บัญชีใช้ได้) แต่ผูกกลับมาที่รายนี้ไม่สำเร็จ — บอกทางแก้ที่ทำได้เอง
      แจ้งพลาด(`สร้างตัวแทน ${code} แล้ว แต่ผูกกับลูกค้าเป้าหมายรายนี้ไม่สำเร็จ — เปิดรายนี้อีกครั้ง แล้วเลือก “ผูกกับตัวแทนที่มีอยู่แล้ว” → ${code}`);
    }
    setCreds({ name: ฟอร์ม.name.trim(), code, email: res.email, password: res.password });
    setConverting(null); setEditing(null);
  }

  async function คัดลอก(ข้อความ: string, ช่อง: string) {
    try {
      await navigator.clipboard.writeText(ข้อความ);
      setคัดลอกแล้ว(ช่อง);
      setTimeout(() => setคัดลอกแล้ว(""), 1500);
    } catch {
      แจ้งพลาด("คัดลอกไม่สำเร็จ — เลือกข้อความแล้วคัดลอกเองได้");
    }
  }

  const ดูอย่างเดียว = !จัดการได้;
  // ใบที่จะใช้ตั้งตัวแทน (ตอบรับล่าสุด หรือส่งแล้วล่าสุด) — บอกล่วงหน้าในกล่องว่าเป้ายอดขายจะตั้งตามใบไหน
  const ใบหลัก = ใบหลักสำหรับตั้งตัวแทน(ใบของรายที่เปิด);
  const รายที่เปิด = editing && editing !== "new" ? editing : null;

  return (
    <div className="erp">
      <TopbarActions>
        <ExportMenu
          filename="hq-prospects"
          title="ลูกค้าเป้าหมาย (HQ)"
          headers={["ชื่อ", "ชื่อบนโซเชียล", "เบอร์โทร", "อีเมล", "ภาค", "จังหวัด", "ประเภทธุรกิจ", "ช่องทาง", "เริ่มติดต่อ", "ติดตามครั้งถัดไป", "สถานะ", "เหตุผลที่ไม่สำเร็จ", "ผู้ดูแล", "รหัสตัวแทน", "หมายเหตุ"]}
          rows={filtered.map(p => [
            p.name, p.social ?? "", p.phone ?? "", p.email ?? "", p.region ?? "", p.province ?? "", p.businessType ?? "", p.channel ?? "",
            p.firstContact ?? "", p.followUp ?? "", prospectStatusLabel[p.status], p.lostReason ?? "", p.assigned ?? "",
            p.dealerCode ?? "", p.note ?? "",
          ])}
        />
        {จัดการได้ && (
          <button className="btn btn-primary btn-sm" onClick={เปิดเพิ่ม}>
            <UserPlus size={14} /> เพิ่มลูกค้าเป้าหมาย
          </button>
        )}
      </TopbarActions>
      <div className="page-head"><div /></div>

      {/* สรุป — 4 ใบตามกติกากลาง (globals.css: ทุกหน้าใช้ KPI 4 ใบเท่ากัน ห้ามเพิ่มเป็น 5+)
          "กำลังติดตาม" ไม่ได้ขึ้นการ์ด เพราะหาได้จาก ทั้งหมด − เป็นตัวแทนแล้ว − ไม่สำเร็จ และกรองดูได้จากช่องสถานะ */}
      <div className="kpi-bar">
        <div className="kpi"><div className="kpi-icon kpi-navy"><Users size={16} /></div><div><div className="kpi-val">{สรุป.ทั้งหมด.toLocaleString()}</div><div className="kpi-label">ลูกค้าเป้าหมายที่แสดงอยู่</div></div></div>
        <div className="kpi"><div className="kpi-icon kpi-navy"><AlarmClock size={16} /></div><div><div className="kpi-val">{สรุป.ถึงกำหนด.toLocaleString()}</div><div className="kpi-label">ถึงกำหนดติดตาม</div></div></div>
        <div className="kpi"><div className="kpi-icon kpi-green"><Store size={16} /></div><div><div className="kpi-val">{สรุป.เป็นตัวแทน.toLocaleString()}</div><div className="kpi-label">เป็นตัวแทนแล้ว</div></div></div>
        {/* อัตราสำเร็จคิดจากรายที่จบแล้วเท่านั้น · ยังไม่มีรายที่จบ = "—" ไม่ใช่ 0% */}
        <div className="kpi"><div className="kpi-icon kpi-green"><Percent size={16} /></div><div><div className="kpi-val">{สรุป.อัตราสำเร็จ === null ? "—" : `${สรุป.อัตราสำเร็จ}%`}</div><div className="kpi-label">อัตราสำเร็จ (จากรายที่จบแล้ว)</div></div></div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", marginBottom: 16 }}>
        <div className="search-bar">
          <Search size={14} color="#9ca3af" />
          <input aria-label="ค้นหาลูกค้าเป้าหมาย" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="ค้นหาชื่อ / เบอร์โทร / จังหวัด / ประเภทธุรกิจ..." />
          {q && <button aria-label="ล้างคำค้น" onClick={() => { setQ(""); setPage(0); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}><X size={13} /></button>}
        </div>
        <div style={{ flex: 1 }} />
        <select aria-label="กรองตามสถานะ" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ทุกสถานะ</option>
          <option value="due">ถึงกำหนดติดตาม</option>
          {PROSPECT_STATUS_ORDER.map(s => <option key={s} value={s}>{prospectStatusLabel[s]}</option>)}
        </select>
        <select aria-label="กรองตามจังหวัด" value={provinceFilter} onChange={e => { setProvinceFilter(e.target.value); setPage(0); }} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ทุกจังหวัด</option>
          {จังหวัดในข้อมูล.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loadErr && (
        <div className="card" role="alert" style={{ padding: "10px 14px", marginBottom: 12, fontSize: "0.8rem", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 10 }}>
          {loadErr}
          <button className="btn btn-secondary btn-sm" onClick={() => void โหลด()}>ลองใหม่</button>
        </div>
      )}

      {/* ตาราง */}
      <div className="card">
        <div className="table-wrap" style={{ borderTop: "none" }}>
          <table>
            {/* เพิ่ม/ลบคอลัมน์ต้องแก้ colgroup ด้วย (table-layout: fixed — ใส่ความกว้างที่ th ไม่มีผล)
                minWidth ทุกคอลัมน์ (แบบเดียวกับหน้าตัวแทน/ลูกค้าเป้าหมายทั้งเครือ) — จอแคบให้ตารางเลื่อนซ้ายขวา
                ไม่ใช่บีบทุกช่องจนเหลือ "ZZT… 0… ช…" อ่านไม่ออก (เห็นจากภาพหน้าจอมือถือ 14 ก.ย. 69)
                สถานะกว้างสุด 150 — ป้าย "ส่งข้อมูลบริษัทแล้ว" ยาวที่สุดในชุด ห้ามถูกตัด */}
            <colgroup>
              <col style={{ width: "21%", minWidth: 180 }} />
              <col style={{ width: "11%", minWidth: 112 }} />
              <col style={{ width: "10%", minWidth: 96 }} />
              <col style={{ width: "14%", minWidth: 120 }} />
              <col style={{ width: "9%", minWidth: 88 }} />
              <col style={{ width: "15%", minWidth: 150 }} />
              <col style={{ width: "12%", minWidth: 104 }} />
              <col style={{ width: "8%", minWidth: 72 }} />
            </colgroup>
            <thead>
              <tr><th>ลูกค้าเป้าหมาย</th><th>เบอร์โทร</th><th>จังหวัด</th><th>ประเภทธุรกิจ</th><th>ช่องทาง</th><th>สถานะ</th><th>นัดติดตาม</th><th>ตัวแทน</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "36px 14px", color: "#9ca3af", fontSize: "0.8rem" }}>
                  {!loaded ? "กำลังโหลด…" : list.length === 0 ? "ยังไม่มีลูกค้าเป้าหมาย" : "ไม่พบลูกค้าเป้าหมายตามตัวกรองที่เลือก"}
                </td></tr>
              )}
              {pageSlice(filtered, page).map(p => {
                const สี = prospectStatusColor[p.status];
                const เลยกำหนด = ถึงกำหนดติดตาม(p, APP_NOW_ISO);
                // คีย์ใช้ p.id ได้: id ไม่ซ้ำทั้งระบบ (identity เดียวทั้งตาราง · dealerCode ในแถวนี้คือตัวแทนที่รายนั้นกลายมาเป็น ไม่ใช่สาขาเจ้าของ)
                return (
                  <ClickableRow key={p.id} onActivate={() => เปิดแก้(p)} label={`เปิดรายละเอียดลูกค้าเป้าหมาย ${p.name}`}>
                    <td>
                      <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      {p.social && p.social !== p.name && (
                        <div style={{ fontSize: "0.7rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.social}</div>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{p.phone ? formatPhone(p.phone) || p.phone : "—"}</td>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.province || "—"}</td>
                    <td style={{ fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.businessType || "—"}</td>
                    <td style={{ fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.channel || "—"}</td>
                    <td><span className="badge" style={{ background: สี.bg, color: สี.text }}>{prospectStatusLabel[p.status]}</span></td>
                    <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap", color: เลยกำหนด ? "#b91c1c" : undefined, fontWeight: เลยกำหนด ? 700 : undefined }}>
                      {p.followUp ? fmtISOToThai(p.followUp) : "—"}
                    </td>
                    <td>
                      {p.dealerCode
                        ? <Link href={`/hq/dealers/${p.dealerCode}`} title={ชื่อตัวแทน.get(p.dealerCode) ?? p.dealerCode} style={{ color: PRIMARY, fontWeight: 700 }}>{p.dealerCode}</Link>
                        : "—"}
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} total={filtered.length} onPage={setPage} unit="ราย" />
      </div>

      {/* ── เพิ่ม / แก้ไข ── */}
      {editing && (
        <div onClick={() => !saving && setEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => !saving && setEditing(null)} label="ข้อมูลลูกค้าเป้าหมาย" className="modal-fit"
            style={{ background: "#fff", borderRadius: 16, width: 620, maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#2D2D2D" }}>
                {editing === "new" ? "เพิ่มลูกค้าเป้าหมาย" : ดูอย่างเดียว ? "รายละเอียดลูกค้าเป้าหมาย" : "แก้ไขลูกค้าเป้าหมาย"}
              </h2>
              <button aria-label="ปิด" onClick={() => !saving && setEditing(null)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}><X size={18} /></button>
            </div>
            <div className="modal-fit-body" style={{ padding: "16px 20px" }}>
              {formErr && <div role="alert" style={{ background: "#fee2e2", border: "1px solid #dc262630", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: "0.8rem", color: "#dc2626", fontWeight: 600 }}>{formErr}</div>}

              {รายที่เปิด?.status === "won" && รายที่เปิด.dealerCode && (
                <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: "0.78rem", color: "#15803d", fontWeight: 600 }}>
                  เป็นตัวแทนจำหน่ายแล้ว — <Link href={`/hq/dealers/${รายที่เปิด.dealerCode}`} style={{ color: "#15803d", textDecoration: "underline" }}>
                    {รายที่เปิด.dealerCode} · {ชื่อตัวแทน.get(รายที่เปิด.dealerCode) ?? ""}
                  </Link>
                  {รายที่เปิด.convertedAt && ` (ตั้งเมื่อ ${fmtISOToThai(รายที่เปิด.convertedAt)})`}
                </div>
              )}

              <fieldset disabled={ดูอย่างเดียว || saving} style={{ border: "none", margin: 0, padding: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label" htmlFor="pr-name">ชื่อผู้ติดต่อ / ชื่อบริษัท *</label>
                    <input id="pr-name" className="form-input" value={ร่าง.name ?? ""} onChange={e => ตั้งค่า("name", e.target.value)} placeholder="เช่น คุณสมชาย / หจก. ตัวอย่างสตีล" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-social">ชื่อบนโซเชียล</label>
                    <input id="pr-social" className="form-input" value={ร่าง.social ?? ""} onChange={e => ตั้งค่า("social", e.target.value)} placeholder="ชื่อ Facebook / LINE" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-phone">เบอร์โทร</label>
                    <input id="pr-phone" className="form-input" inputMode="tel" value={ร่าง.phone ?? ""} onChange={e => ตั้งค่า("phone", e.target.value)} placeholder="08x-xxx-xxxx" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-email">อีเมล</label>
                    <input id="pr-email" className="form-input" type="email" value={ร่าง.email ?? ""} onChange={e => ตั้งค่า("email", e.target.value)} placeholder="name@example.com" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-channel">ช่องทางที่เข้ามา</label>
                    <input id="pr-channel" className="form-input" list="pr-channel-list" value={ร่าง.channel ?? ""} onChange={e => ตั้งค่า("channel", e.target.value)} placeholder="เลือกหรือพิมพ์เอง" />
                    <datalist id="pr-channel-list">{ช่องทางแนะนำ.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  {/* ภาคมาก่อนจังหวัด — จังหวัดที่เลือกได้ขึ้นกับภาคที่เลือก (บอสสั่ง 14 ก.ย. 69 · กติกาเดียวกับฟอร์มตัวแทน)
                      "ทุกภาค" = ทั่วประเทศ → จังหวัดเป็น "ทุกจังหวัด" ให้เอง */}
                  <div>
                    <label className="form-label" htmlFor="pr-region">ภาค</label>
                    <select id="pr-region" className="form-select" value={ร่าง.region ?? ""} onChange={e => เปลี่ยนภาคร่าง(e.target.value)} style={{ cursor: "pointer" }}>
                      <option value="">— ยังไม่ระบุ —</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      <option value={ALL_REGIONS}>{ALL_REGIONS} (ทั่วประเทศ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-province">จังหวัด</label>
                    {/* จังหวัดที่บันทึกไว้แต่ไม่อยู่ในรายการ (ข้อมูลเก่าพิมพ์ย่อ เช่น "ปทุม") ต้องยังเห็นค่าเดิม ไม่หายเงียบตอนเปิดมาแก้ */}
                    <select id="pr-province" className="form-select" value={ร่าง.province ?? ""} onChange={e => ตั้งค่า("province", e.target.value || null)} style={{ cursor: "pointer" }}>
                      <option value="">{ร่าง.region ? "— ยังไม่ระบุ —" : "— เลือกภาคก่อน —"}</option>
                      {ร่าง.region === ALL_REGIONS && <option value={ALL_PROVINCES}>{ALL_PROVINCES}</option>}
                      {provincesOfRegion(ร่าง.region ?? "").map(p => <option key={p} value={p}>{p}</option>)}
                      {ร่าง.province && ร่าง.province !== ALL_PROVINCES && !provincesOfRegion(ร่าง.region ?? "").includes(ร่าง.province) && (
                        <option value={ร่าง.province}>{ร่าง.province} (ตามที่บันทึกไว้)</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-type">ประเภทธุรกิจ</label>
                    <input id="pr-type" className="form-input" value={ร่าง.businessType ?? ""} onChange={e => ตั้งค่า("businessType", e.target.value)} placeholder="เช่น ผู้รับเหมา / ขายเหล็ก / สถาปนิก" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-assigned">ผู้ดูแล (สำนักงานใหญ่)</label>
                    <input id="pr-assigned" className="form-input" value={ร่าง.assigned ?? ""} onChange={e => ตั้งค่า("assigned", e.target.value)} placeholder="ชื่อผู้ติดตามรายนี้" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-first">เริ่มติดต่อ</label>
                    <input id="pr-first" className="form-input" type="date" value={ร่าง.firstContact ?? ""} onChange={e => ตั้งค่า("firstContact", e.target.value || null)} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-follow">ติดตามครั้งถัดไป</label>
                    <input id="pr-follow" className="form-input" type="date" value={ร่าง.followUp ?? ""} onChange={e => ตั้งค่า("followUp", e.target.value || null)} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pr-status">สถานะ</label>
                    {/* ต้องมีค่าเสมอ — ลูกค้าเป้าหมายทุกรายต้องอยู่ในขั้นใดขั้นหนึ่ง
                        "เป็นตัวแทนแล้ว" เลือกตรงนี้ไม่ได้ ต้องผ่านปุ่ม "ตั้งเป็นตัวแทนจำหน่าย" เท่านั้น
                        (กันกดเลือกเฉย ๆ แล้วนับเป็นความสำเร็จ ทั้งที่ไม่มีสาขาจริง) */}
                    <select id="pr-status" className="form-select" value={ร่าง.status ?? "new"} disabled={ร่าง.status === "won"}
                      onChange={e => ตั้งค่า("status", e.target.value as DealerProspectStatus)} style={{ cursor: "pointer" }}>
                      {PROSPECT_STATUS_ORDER.filter(s => s !== "won" || ร่าง.status === "won").map(s => <option key={s} value={s}>{prospectStatusLabel[s]}</option>)}
                    </select>
                  </div>
                  {ร่าง.status === "lost" && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="form-label" htmlFor="pr-lost">เหตุผลที่ไม่สำเร็จ</label>
                      <input id="pr-lost" className="form-input" value={ร่าง.lostReason ?? ""} onChange={e => ตั้งค่า("lostReason", e.target.value)} placeholder="เช่น ไม่มีทุน / ไม่สนใจ / ติดต่อไม่ได้" />
                    </div>
                  )}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label" htmlFor="pr-note">หมายเหตุ</label>
                    <textarea id="pr-note" className="form-input" rows={3} value={ร่าง.note ?? ""} onChange={e => ตั้งค่า("note", e.target.value)} placeholder="สิ่งที่คุยไว้ / สิ่งที่ต้องทำต่อ" style={{ resize: "vertical" }} />
                  </div>
                </div>
              </fieldset>

              {/* ใบเสนอแพ็กเกจตัวแทน — "เหมือนใบเสนอราคาของตัวแทน แต่ของ HQ" (บอสสั่ง 14 ก.ย. 69) */}
              {รายที่เปิด && (
                <ProspectProposalsPanel prospect={รายที่เปิด} editable={จัดการได้} onChange={setใบของรายที่เปิด} />
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {จัดการได้ && รายที่เปิด && (
                  <button className="btn btn-sm" disabled={saving} onClick={() => void ลบ(รายที่เปิด)}
                    style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                    <Trash2 size={14} /> ลบ
                  </button>
                )}
                <div style={{ flex: 1 }} />
                {จัดการได้ && รายที่เปิด && รายที่เปิด.status !== "won" && (
                  <button className="btn btn-secondary btn-md" disabled={saving} onClick={() => เปิดตั้งตัวแทน(รายที่เปิด)}>
                    <Store size={14} /> ตั้งเป็นตัวแทนจำหน่าย
                  </button>
                )}
                <button className="btn btn-secondary btn-md" disabled={saving} onClick={() => setEditing(null)}>{ดูอย่างเดียว ? "ปิด" : "ยกเลิก"}</button>
                {จัดการได้ && (
                  <button className="btn btn-primary btn-md" disabled={saving} onClick={() => void บันทึก()}
                    style={saving ? { opacity: .6, cursor: "not-allowed" } : undefined}>
                    {saving ? "กำลังบันทึก…" : editing === "new" ? "เพิ่มลูกค้าเป้าหมาย" : "บันทึก"}
                  </button>
                )}
              </div>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── ตั้งเป็นตัวแทนจำหน่าย ── */}
      {converting && (
        <div onClick={() => !convBusy && setConverting(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => !convBusy && setConverting(null)} label="ตั้งเป็นตัวแทนจำหน่าย" className="modal-fit"
            style={{ background: "#fff", borderRadius: 16, width: 520, maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.3)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "14px 20px", fontWeight: 800, borderRadius: "16px 16px 0 0" }}>
              ตั้ง “{converting.name}” เป็นตัวแทนจำหน่าย
            </div>
            <div className="modal-fit-body" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {convErr && <div role="alert" style={{ background: "#fee2e2", border: "1px solid #dc262630", borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem", color: "#dc2626", fontWeight: 600 }}>{convErr}</div>}

              <div role="radiogroup" aria-label="วิธีตั้งเป็นตัวแทน" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.82rem" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" name="convert-mode" checked={โหมดตั้ง === "new"} onChange={() => { setโหมดตั้ง("new"); setConvErr(""); }} disabled={convBusy} />
                  สร้างตัวแทนจำหน่ายใหม่ พร้อมบัญชีเข้าระบบ
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input type="radio" name="convert-mode" checked={โหมดตั้ง === "existing"} onChange={() => { setโหมดตั้ง("existing"); setConvErr(""); }} disabled={convBusy} />
                  ผูกกับตัวแทนจำหน่ายที่มีอยู่แล้ว
                </label>
              </div>

              {/* ด่านเดียวกับที่เซิร์ฟเวอร์บังคับ — บอกก่อนกด ไม่ต้องให้ผู้ใช้กรอกครบแล้วค่อยโดนปฏิเสธ
                  ผูกกับตัวแทนที่มีอยู่แล้วไม่ต้องมีใบ (บันทึกประวัติรายที่เป็นตัวแทนมาก่อนระบบนี้) */}
              {โหมดตั้ง === "new" && !มีใบเสนอที่ส่งแล้ว(ใบของรายที่เปิด) && (
                <div role="note" style={{ background: "#fff8e6", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: "0.78rem", color: "#92400e", fontWeight: 600, lineHeight: 1.6 }}>
                  ยังสร้างตัวแทนใหม่ไม่ได้ — ต้องมี “ใบเสนอแพ็กเกจตัวแทน” ที่ส่งแล้วหรือตอบรับอย่างน้อย 1 ใบ
                  (ออกใบได้ในหน้าต่างรายละเอียดของรายนี้) · ถ้าเป็นตัวแทนอยู่แล้ว เลือก “ผูกกับตัวแทนจำหน่ายที่มีอยู่แล้ว”
                </div>
              )}

              {โหมดตั้ง === "existing" ? (
                <div>
                  <label className="form-label" htmlFor="cv-existing">ตัวแทนจำหน่าย</label>
                  <select id="cv-existing" className="form-select" value={ฟอร์ม.existingCode} disabled={convBusy}
                    onChange={e => setฟอร์ม(f => ({ ...f, existingCode: e.target.value }))} style={{ cursor: "pointer" }}>
                    <option value="">— เลือกตัวแทนจำหน่าย —</option>
                    {dealers.filter(d => d.code !== HQ_CODE).map(d => <option key={d.code} value={d.code}>{d.code} · {d.name}{d.province ? ` (${d.province})` : ""}</option>)}
                  </select>
                </div>
              ) : (
                <fieldset disabled={convBusy} style={{ border: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                  <div>
                    <label className="form-label" htmlFor="cv-code">รหัสตัวแทน *</label>
                    <input id="cv-code" className="form-input" value={ฟอร์ม.code} placeholder="เช่น CNXB"
                      onChange={e => setฟอร์ม(f => ({ ...f, code: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 5) }))}
                      style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="cv-name">ชื่อตัวแทน *</label>
                    <input id="cv-name" className="form-input" value={ฟอร์ม.name} onChange={e => setฟอร์ม(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อที่จะใช้ในระบบ" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="cv-region">ภาค *</label>
                    <select id="cv-region" className="form-select" value={ฟอร์ม.region} onChange={e => เปลี่ยนภาค(e.target.value)} style={{ cursor: "pointer" }}>
                      <option value="">— ยังไม่ระบุ —</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      {/* ทุกภาค = ทั่วประเทศ (แบบเดียวกับฟอร์มตัวแทน) → จังหวัดเป็น "ทุกจังหวัด" ให้เอง */}
                      <option value={ALL_REGIONS}>{ALL_REGIONS} (ทั่วประเทศ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="cv-province">จังหวัดที่ตั้ง *</label>
                    <select id="cv-province" className="form-select" value={ฟอร์ม.province} onChange={e => setฟอร์ม(f => ({ ...f, province: e.target.value }))} style={{ cursor: "pointer" }}>
                      <option value="">{ฟอร์ม.region ? "— ยังไม่ระบุ —" : "— เลือกภาคก่อน —"}</option>
                      {ฟอร์ม.region === ALL_REGIONS && <option value={ALL_PROVINCES}>{ALL_PROVINCES}</option>}
                      {provincesOfRegion(ฟอร์ม.region).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label" htmlFor="cv-email">อีเมลเข้าระบบ</label>
                    <input id="cv-email" className="form-input" type="email" value={ฟอร์ม.email}
                      onChange={e => setฟอร์ม(f => ({ ...f, email: e.target.value.replace(/\s/g, "") }))}
                      placeholder={ฟอร์ม.code ? `${ฟอร์ม.code.toLowerCase()}@partner-agent.co.th` : "เว้นว่าง = ระบบตั้งให้"} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label" htmlFor="cv-password">รหัสผ่าน</label>
                    <input id="cv-password" className="form-input" type="text" value={ฟอร์ม.password}
                      onChange={e => setฟอร์ม(f => ({ ...f, password: e.target.value.replace(/\s/g, "") }))}
                      placeholder="เว้นว่าง = ระบบสุ่มให้ (อย่างน้อย 8 ตัวอักษร)" />
                  </div>
                  <div style={{ gridColumn: "1 / -1", fontSize: "0.7rem", color: MUTED, lineHeight: 1.6 }}>
                    {ใบหลัก?.annualTarget != null
                      ? `เป้ายอดขายรายปีของสาขาจะตั้งตามใบเสนอ ${ใบหลัก.proposalNo ?? ""}: ${มูลค่าอ่านง่าย(ใบหลัก.annualTarget)}`
                      : "ใบเสนอยังไม่ได้ระบุเป้ายอดซื้อต่อปี — เป้ายอดขายตั้งเป็น 0 ไว้ก่อน แก้ได้ที่หน้าตัวแทนจำหน่าย"}
                  </div>
                </fieldset>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button className="btn btn-secondary btn-md" disabled={convBusy} onClick={() => setConverting(null)}>ยกเลิก</button>
                <button className="btn btn-primary btn-md" disabled={convBusy || (โหมดตั้ง === "new" && !มีใบเสนอที่ส่งแล้ว(ใบของรายที่เปิด))} onClick={() => void ยืนยันตั้งตัวแทน()}
                  style={convBusy ? { opacity: .6, cursor: "not-allowed" } : undefined}>
                  {convBusy ? "กำลังดำเนินการ…" : โหมดตั้ง === "new" ? "สร้างตัวแทนจำหน่าย" : "ผูกกับตัวแทนนี้"}
                </button>
              </div>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── บัญชีเข้าระบบของตัวแทนใหม่ (โชว์ครั้งเดียวให้คัดลอกไปแจ้ง) ── */}
      {creds && (
        <div onClick={() => setCreds(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1150, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setCreds(null)} label="บัญชีเข้าระบบของตัวแทนใหม่"
            style={{ background: "#fff", borderRadius: 16, width: 440, maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.3)", padding: 22 }}>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "#15803d", marginBottom: 4 }}>สร้างตัวแทนจำหน่ายสำเร็จ</div>
            <div style={{ fontSize: "0.8rem", color: MUTED, marginBottom: 14 }}>{creds.code} · {creds.name} — คัดลอกบัญชีไปแจ้งตัวแทน</div>
            {[["อีเมลเข้าระบบ", creds.email, "email"], ["รหัสผ่าน", creds.password, "password"]].map(([ป้าย, ค่า, ช่อง]) => (
              <div key={ช่อง} style={{ marginBottom: 10 }}>
                <div className="form-label">{ป้าย}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <code style={{ flex: 1, background: "#f3f4f6", borderRadius: 8, padding: "8px 10px", fontSize: "0.82rem", wordBreak: "break-all" }}>{ค่า}</code>
                  <button className="btn btn-secondary btn-sm" aria-label={`คัดลอก${ป้าย}`} onClick={() => void คัดลอก(ค่า, ช่อง)}>
                    {คัดลอกแล้ว === ช่อง ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ fontSize: "0.72rem", color: MUTED, margin: "8px 0 14px", lineHeight: 1.6 }}>
              เปิดดูรหัสย้อนหลังหรือรีเซ็ตได้ที่หน้าตัวแทนจำหน่าย · ตัวแทนเปลี่ยนอีเมล/รหัสผ่านเองได้ภายหลัง
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Link href={`/hq/dealers/${creds.code}`} className="btn btn-secondary btn-md">ไปที่ตัวแทน {creds.code}</Link>
              <button className="btn btn-primary btn-md" onClick={() => setCreds(null)}>เสร็จแล้ว</button>
            </div>
          </ModalCard>
        </div>
      )}
    </div>
  );
}
