"use client";

// ─── HQ · ใบเสนอแพ็กเกจตัวแทน (หน้ารวมทุกลูกค้าเป้าหมาย) ─────────────────────────────
//
// บอสสั่ง 14 ก.ย. 69: "ทำหน้า ใบเสนอแพ็กเกจ ด้วย" — แบบเดียวกับหน้าใบเสนอราคา แต่เป็นของสำนักงานใหญ่
//   ดูใบของทุกรายในที่เดียว · กรอง/ค้นหา · กดแถวเปิดแผงใบเสนอของรายนั้น (พิมพ์/เปลี่ยนสถานะ/แก้ร่าง/ออกใบใหม่)
//
// ⚠️ ห้ามเขียนฟอร์ม/ตัวเปลี่ยนสถานะซ้ำในหน้านี้ — ใช้ ProspectProposalsPanel ตัวเดียวกับหน้าต่างลูกค้าเป้าหมาย
//    ถ้าแยกเขียนสองที่ วันหนึ่งกติกา (ล็อกใบที่ส่งแล้ว / ช่องตัวเลข) จะไม่ตรงกันระหว่างสองหน้า
//
// สิทธิ์: ดูได้ทุกบทบาทฝั่งสำนักงานใหญ่ · ออกใบ/เปลี่ยนสถานะ = ผู้มีสิทธิ์จัดการตัวแทน (RLS 0172 บังคับซ้ำ)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Send, CheckCircle2, Percent, Search, X, Plus } from "lucide-react";
import { proposals as proposalsRepo, prospects as prospectsRepo } from "@pms/shared/lib/data";
import type { DealerPackage, DealerPackageProposal, DealerProposalStatus, DealerProspect } from "@pms/shared/lib/data/types";
import {
  PACKAGE_ORDER, PROPOSAL_STATUS_ORDER, packageLabel, proposalStatusLabel, proposalStatusColor,
  มูลค่าอ่านง่าย, ระยะสัญญาอ่านง่าย, หมดอายุแล้ว,
} from "@pms/shared/lib/dealerProposals";
import { ยังติดตามอยู่ } from "@pms/shared/lib/dealerProspects";
import { ProspectProposalsPanel } from "@pms/shared/components/hq/ProspectProposalsPanel";
import { useRole } from "@pms/shared/context/RoleContext";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { ExportMenu } from "@pms/shared/components/ui/ExportMenu";
import { TopbarActions } from "@pms/shared/components/layout/TopbarActions";
import { ModalCard } from "@pms/shared/components/ui/ModalCard";
import { TablePagination, pageSlice } from "@pms/shared/components/ui/TablePagination";
import { ClickableRow } from "@pms/shared/components/ui/ClickableRow";
import { fmtISOToThai } from "@pms/shared/lib/mock";
import { friendlyError } from "@pms/shared/lib/friendlyError";

const PRIMARY = "#003366";
const MUTED = "#6b7280";

/** ข้อความพื้นที่ในตาราง — ทุกภาค = ทั่วประเทศ */
const พื้นที่ของใบ = (p: DealerPackageProposal) =>
  p.region === "ทุกภาค" ? "ทั่วประเทศ" : [p.province, p.region ? `ภาค${p.region}` : ""].filter(Boolean).join(" · ") || "—";

export default function HQProposalsPage() {
  const { can } = useRole();
  const จัดการได้ = can("dealers:manage");

  const [ใบ, setใบ] = useState<DealerPackageProposal[]>([]);
  const [ราย, setราย] = useState<DealerProspect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "expired" | DealerProposalStatus>("all");
  const [packageFilter, setPackageFilter] = useState<"all" | DealerPackage>("all");
  const [page, setPage] = useState(0);

  // แผงใบเสนอของรายที่เปิดอยู่ (กดแถว หรือเลือกรายตอนออกใบใหม่)
  const [เปิดราย, setเปิดราย] = useState<DealerProspect | null>(null);
  const [เปิดฟอร์มทันที, setเปิดฟอร์มทันที] = useState(false);
  // กล่องเลือกลูกค้าเป้าหมายก่อนออกใบใหม่
  const [เลือกราย, setเลือกราย] = useState(false);
  const [รายที่เลือก, setรายที่เลือก] = useState("");

  const โหลด = useCallback(async () => {
    try {
      const [ใบทั้งหมด, รายทั้งหมด] = await Promise.all([proposalsRepo.list(), prospectsRepo.list()]);
      setใบ(ใบทั้งหมด);
      setราย(รายทั้งหมด);
      setLoadErr("");
    } catch (e) {
      // ห้ามปล่อยตารางว่างเงียบ ๆ — ผู้ใช้จะนึกว่ายังไม่เคยออกใบ
      setLoadErr(friendlyError(e, "โหลดใบเสนอแพ็กเกจไม่สำเร็จ"));
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => { void โหลด(); }, [โหลด]);

  const รายตามรหัส = useMemo(() => new Map(ราย.map(r => [r.id, r])), [ราย]);

  const filtered = useMemo(() => {
    const คำ = q.trim().toLowerCase();
    return ใบ.filter(p => {
      if (statusFilter === "expired" ? !หมดอายุแล้ว(p, APP_NOW_ISO) : statusFilter !== "all" && p.status !== statusFilter) return false;
      if (packageFilter !== "all" && p.package !== packageFilter) return false;
      if (!คำ) return true;
      const r = รายตามรหัส.get(p.prospectId);
      return [p.proposalNo, r?.name, r?.social, p.province, p.region, packageLabel[p.package]]
        .some(v => String(v ?? "").toLowerCase().includes(คำ));
    });
  }, [ใบ, statusFilter, packageFilter, q, รายตามรหัส]);

  // การ์ดคิดจาก "ผลที่กรองอยู่" — ตรงกับตาราง · อัตราตอบรับคิดจากใบที่ได้คำตอบแล้วเท่านั้น (ยังไม่มี = "—")
  const สรุป = useMemo(() => {
    const ตอบรับ = filtered.filter(p => p.status === "accepted").length;
    const ปฏิเสธ = filtered.filter(p => p.status === "rejected").length;
    return {
      ทั้งหมด: filtered.length,
      รอคำตอบ: filtered.filter(p => p.status === "sent").length,
      ตอบรับ,
      อัตราตอบรับ: ตอบรับ + ปฏิเสธ > 0 ? Math.round((ตอบรับ / (ตอบรับ + ปฏิเสธ)) * 100) : null,
    };
  }, [filtered]);

  // ออกใบได้เฉพาะรายที่ยังติดตามอยู่ — รายที่เป็นตัวแทนแล้วหรือจบว่าไม่สำเร็จ ไม่มีเหตุให้เสนอแพ็กเกจอีก
  const รายที่ออกใบได้ = useMemo(
    () => ราย.filter(r => ยังติดตามอยู่(r.status)).sort((a, b) => a.name.localeCompare(b.name, "th")),
    [ราย],
  );

  function เปิดแผงของ(r: DealerProspect, ฟอร์มทันที = false) {
    setเปิดฟอร์มทันที(ฟอร์มทันที);
    setเปิดราย(r);
  }
  function ปิดแผง() {
    setเปิดราย(null);
    setเปิดฟอร์มทันที(false);
    void โหลด();   // แผงแก้/ออกใบไปแล้ว — ดึงชุดจริงใหม่ ไม่เดาเอาเอง
  }

  return (
    <div className="erp">
      <TopbarActions>
        <ExportMenu
          filename="hq-dealer-package-proposals"
          title="ใบเสนอแพ็กเกจตัวแทน"
          headers={["เลขที่", "ลูกค้าเป้าหมาย", "แพ็กเกจ", "ภาค", "จังหวัด", "ค่าแรกเข้า (บาท)", "ระยะสัญญา (เดือน)", "เป้ายอดซื้อต่อปี (บาท)", "สถานะ", "วันที่เสนอ", "มีผลถึง", "เงื่อนไข"]}
          rows={filtered.map(p => [
            p.proposalNo ?? "", รายตามรหัส.get(p.prospectId)?.name ?? "", packageLabel[p.package], p.region ?? "", p.province ?? "",
            p.amount ?? "", p.contractMonths ?? "", p.annualTarget ?? "", proposalStatusLabel[p.status],
            p.proposedDate ?? "", p.validUntil ?? "", p.terms ?? "",
          ])}
        />
        {จัดการได้ && (
          <button className="btn btn-primary btn-sm" onClick={() => { setรายที่เลือก(""); setเลือกราย(true); }}>
            <Plus size={14} /> ออกใบเสนอแพ็กเกจ
          </button>
        )}
      </TopbarActions>
      <div className="page-head"><div /></div>

      {/* สรุป — 4 ใบตามกติกากลาง (globals.css: ทุกหน้าใช้ KPI 4 ใบเท่ากัน) */}
      <div className="kpi-bar">
        <div className="kpi"><div className="kpi-icon kpi-navy"><FileText size={16} /></div><div><div className="kpi-val">{สรุป.ทั้งหมด.toLocaleString()}</div><div className="kpi-label">ใบที่แสดงอยู่</div></div></div>
        <div className="kpi"><div className="kpi-icon kpi-navy"><Send size={16} /></div><div><div className="kpi-val">{สรุป.รอคำตอบ.toLocaleString()}</div><div className="kpi-label">ส่งแล้ว รอคำตอบ</div></div></div>
        <div className="kpi"><div className="kpi-icon kpi-green"><CheckCircle2 size={16} /></div><div><div className="kpi-val">{สรุป.ตอบรับ.toLocaleString()}</div><div className="kpi-label">ตอบรับ</div></div></div>
        <div className="kpi"><div className="kpi-icon kpi-green"><Percent size={16} /></div><div><div className="kpi-val">{สรุป.อัตราตอบรับ === null ? "—" : `${สรุป.อัตราตอบรับ}%`}</div><div className="kpi-label">อัตราตอบรับ (จากใบที่ได้คำตอบแล้ว)</div></div></div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", marginBottom: 16 }}>
        <div className="search-bar">
          <Search size={14} color="#9ca3af" />
          <input aria-label="ค้นหาใบเสนอแพ็กเกจ" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="ค้นหาเลขที่ / ลูกค้าเป้าหมาย / จังหวัด..." />
          {q && <button aria-label="ล้างคำค้น" onClick={() => { setQ(""); setPage(0); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}><X size={13} /></button>}
        </div>
        <div style={{ flex: 1 }} />
        <select aria-label="กรองตามสถานะใบ" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ทุกสถานะ</option>
          {PROPOSAL_STATUS_ORDER.map(s => <option key={s} value={s}>{proposalStatusLabel[s]}</option>)}
          <option value="expired">ส่งแล้ว · เลยวันมีผล</option>
        </select>
        <select aria-label="กรองตามแพ็กเกจ" value={packageFilter} onChange={e => { setPackageFilter(e.target.value as typeof packageFilter); setPage(0); }} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ทุกแพ็กเกจ</option>
          {PACKAGE_ORDER.map(k => <option key={k} value={k}>{packageLabel[k]}</option>)}
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
            {/* เพิ่ม/ลบคอลัมน์ต้องแก้ colgroup ด้วย (table-layout: fixed) · minWidth ให้จอแคบเลื่อนซ้ายขวาได้ ไม่บีบจนอ่านไม่ออก
                8 คอลัมน์พอดีกรอบจอคอม (เซลล์มีระยะขอบข้างละ 1rem) — เคยมี 9 คอลัมน์ เลขที่/แพ็กเกจโดนตัด "DP-2026-00…"
                และคอลัมน์สุดท้ายล้นกรอบ (ภาพหน้าจอ 14 ก.ย. 69) → ย้าย "วันที่เสนอ · มีผลถึง" ไปบรรทัดล่างใต้ชื่อ */}
            <colgroup>
              <col style={{ width: "14%", minWidth: 132 }} />
              <col style={{ width: "22%", minWidth: 180 }} />
              <col style={{ width: "11%", minWidth: 100 }} />
              <col style={{ width: "12%", minWidth: 100 }} />
              <col style={{ width: "11%", minWidth: 104 }} />
              <col style={{ width: "9%", minWidth: 90 }} />
              <col style={{ width: "12%", minWidth: 116 }} />
              <col style={{ width: "9%", minWidth: 84 }} />
            </colgroup>
            <thead>
              <tr><th>เลขที่</th><th>ลูกค้าเป้าหมาย</th><th>แพ็กเกจ</th><th>พื้นที่</th><th>ค่าแรกเข้า</th><th>ระยะสัญญา</th><th>เป้ายอดซื้อต่อปี</th><th>สถานะ</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "36px 14px", color: "#9ca3af", fontSize: "0.8rem" }}>
                  {!loaded ? "กำลังโหลด…" : ใบ.length === 0 ? "ยังไม่มีใบเสนอแพ็กเกจ" : "ไม่พบใบเสนอแพ็กเกจตามตัวกรองที่เลือก"}
                </td></tr>
              )}
              {pageSlice(filtered, page).map(p => {
                const r = รายตามรหัส.get(p.prospectId);
                const สี = proposalStatusColor[p.status];
                const เลยกำหนด = หมดอายุแล้ว(p, APP_NOW_ISO);
                // คีย์ใช้ p.id ได้: id ไม่ซ้ำทั้งระบบ (identity เดียวทั้งตาราง dealer_package_proposals)
                return (
                  <ClickableRow key={p.id} onActivate={() => r && เปิดแผงของ(r)} label={`เปิดใบเสนอแพ็กเกจ ${p.proposalNo ?? ""} ของ ${r?.name ?? ""}`}>
                    <td style={{ fontWeight: 800, color: PRIMARY, whiteSpace: "nowrap" }}>{p.proposalNo ?? "—"}</td>
                    <td>
                      <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r?.name ?? "—"}</div>
                      {/* วันที่เสนอ · มีผลถึง — ส่งแล้วแต่เลยวันมีผล ขึ้นแดง (ตามไปถามคำตอบ หรือออกใบใหม่) */}
                      {(p.proposedDate || p.validUntil) && (
                        <div style={{ fontSize: "0.7rem", color: เลยกำหนด ? "#b91c1c" : MUTED, fontWeight: เลยกำหนด ? 700 : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[p.proposedDate && `เสนอ ${fmtISOToThai(p.proposedDate)}`, p.validUntil && `ถึง ${fmtISOToThai(p.validUntil)}`].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td>{packageLabel[p.package]}</td>
                    <td style={{ fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={พื้นที่ของใบ(p)}>{พื้นที่ของใบ(p)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{มูลค่าอ่านง่าย(p.amount)}</td>
                    {/* ในตารางโชว์แค่เดือน (เต็มรูป "24 เดือน (2 ปี)" กว้างเกินคอลัมน์) — ชี้ค้างเห็นแบบเต็ม */}
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }} title={ระยะสัญญาอ่านง่าย(p.contractMonths)}>
                      {p.contractMonths != null ? `${p.contractMonths} เดือน` : "—"}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{มูลค่าอ่านง่าย(p.annualTarget)}</td>
                    <td><span className="badge" style={{ background: สี.bg, color: สี.text }}>{proposalStatusLabel[p.status]}</span></td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} total={filtered.length} onPage={setPage} unit="ใบ" />
      </div>

      {/* ── เลือกลูกค้าเป้าหมายก่อนออกใบใหม่ ── */}
      {เลือกราย && (
        <div onClick={() => setเลือกราย(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setเลือกราย(false)} label="เลือกลูกค้าเป้าหมาย"
            style={{ background: "#fff", borderRadius: 16, width: 460, maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.28)", padding: 20 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: "#2D2D2D" }}>ออกใบเสนอแพ็กเกจให้ใคร</h2>
            <div style={{ fontSize: "0.74rem", color: MUTED, marginBottom: 12 }}>เลือกได้เฉพาะลูกค้าเป้าหมายที่ยังติดตามอยู่ (ยังไม่เป็นตัวแทน และยังไม่ปิดว่าไม่สำเร็จ)</div>
            <label className="form-label" htmlFor="pick-prospect">ลูกค้าเป้าหมาย</label>
            <select id="pick-prospect" className="form-select" value={รายที่เลือก} onChange={e => setรายที่เลือก(e.target.value)} style={{ cursor: "pointer" }}>
              <option value="">— เลือกลูกค้าเป้าหมาย —</option>
              {รายที่ออกใบได้.map(r => <option key={r.id} value={String(r.id)}>{r.name}{r.province ? ` · ${r.province}` : ""}</option>)}
            </select>
            {loaded && รายที่ออกใบได้.length === 0 && (
              <div style={{ fontSize: "0.76rem", color: "#92400e", marginTop: 8 }}>
                ยังไม่มีลูกค้าเป้าหมายที่ติดตามอยู่ — เพิ่มได้ที่หน้า <Link href="/hq/prospects" style={{ color: PRIMARY, textDecoration: "underline" }}>ลูกค้าเป้าหมาย (HQ)</Link>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setเลือกราย(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" disabled={!รายที่เลือก}
                onClick={() => {
                  const r = ราย.find(x => String(x.id) === รายที่เลือก);
                  if (!r) return;
                  setเลือกราย(false);
                  เปิดแผงของ(r, true);
                }}>
                ต่อไป
              </button>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── ใบเสนอแพ็กเกจของรายที่เลือก — แผงเดียวกับในหน้าต่างลูกค้าเป้าหมาย ── */}
      {เปิดราย && (
        <div onClick={ปิดแผง} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={ปิดแผง} label="ใบเสนอแพ็กเกจของลูกค้าเป้าหมาย" className="modal-fit"
            style={{ background: "#fff", borderRadius: 16, width: 640, maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{เปิดราย.name}</h2>
                <div style={{ fontSize: "0.72rem", color: MUTED }}>
                  {[เปิดราย.phone, เปิดราย.province].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link href={`/hq/prospects?open=${เปิดราย.id}`} className="btn btn-secondary btn-sm">ไปที่ลูกค้าเป้าหมาย</Link>
                <button aria-label="ปิด" onClick={ปิดแผง} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}><X size={18} /></button>
              </div>
            </div>
            <div className="modal-fit-body" style={{ padding: "0 20px 18px" }}>
              <ProspectProposalsPanel key={เปิดราย.id} prospect={เปิดราย} editable={จัดการได้} เปิดฟอร์มทันที={เปิดฟอร์มทันที} />
            </div>
          </ModalCard>
        </div>
      )}
    </div>
  );
}
