"use client";

// ── แผง "ใบเสนอแพ็กเกจตัวแทน" ของลูกค้าเป้าหมายหนึ่งราย (อยู่ในหน้าต่างรายละเอียดของ /hq/prospects) ──
//
// บอสสั่ง 14 ก.ย. 69: "ต้องทำเหมือนดีลเลอร์ที่ต้องมีใบเสนอราคา แต่อันนี้ของ HQ"
//   ออกใบ (ร่าง) → พิมพ์ส่งให้ → เปลี่ยนเป็น "ส่งแล้ว" → ตอบรับ / ปฏิเสธ
//   ต้องมีใบที่ส่งแล้วหรือตอบรับอย่างน้อย 1 ใบ ถึงจะสร้างตัวแทนใหม่จากรายนี้ได้ (หน้าแม่รับรายการผ่าน onChange)
//
// ส่งแล้วแก้เนื้อหา/ลบไม่ได้ — ฐานข้อมูลบังคับ (0172) หน้าจอแค่ไม่เปิดปุ่มให้กด
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Plus, Printer, Pencil, Trash2, X } from "lucide-react";
import { proposals as proposalsRepo, hqCompany as hqCompanyRepo } from "@pms/shared/lib/data";
import type { DealerPackage, DealerPackageProposal, DealerProposalStatus, DealerProspect } from "@pms/shared/lib/data/types";
import {
  PACKAGE_ORDER, packageLabel, proposalStatusLabel, proposalStatusColor,
  สถานะที่เปลี่ยนไปได้, ใบล็อกแล้ว, เตรียมบันทึกใบ, ตรวจใบเสนอ, มูลค่าอ่านง่าย, หมดอายุแล้ว, ระยะสัญญาอ่านง่าย,
} from "@pms/shared/lib/dealerProposals";
import { เขียนใบเสนอลงหน้าต่าง } from "@pms/shared/lib/dealerProposalPrint";
import { REGIONS, ALL_REGIONS, ALL_PROVINCES, provincesOfRegion, regionOf } from "@pms/shared/lib/provinces";
import { formatMoneyInput, parseMoneyInput } from "@pms/shared/lib/format";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { fmtISOToThai } from "@pms/shared/lib/mock";
import { friendlyError } from "@pms/shared/lib/friendlyError";
import { ModalCard } from "@pms/shared/components/ui/ModalCard";
import { ยืนยัน, แจ้งพลาด, แจ้งสำเร็จ } from "@pms/shared/components/ui/ConfirmToast";
import { useAuditLogger } from "@pms/shared/lib/useAudit";

const PRIMARY = "#003366";
const MUTED = "#6b7280";

// ร่างในฟอร์ม — มูลค่าเก็บเป็นข้อความที่มีลูกน้ำระหว่างพิมพ์ (บอสสั่ง 26 ส.ค. 69: ช่องเงินต้องเห็นลูกน้ำ)
type ร่างใบ = Partial<DealerPackageProposal> & { มูลค่าที่พิมพ์: string; ระยะที่พิมพ์: string; เป้าที่พิมพ์: string };

export function ProspectProposalsPanel({ prospect, editable, onChange, เปิดฟอร์มทันที = false }: {
  prospect: DealerProspect;
  /** ผู้มีสิทธิ์จัดการตัวแทน — ไม่มีสิทธิ์ = ดู/พิมพ์ได้อย่างเดียว */
  editable: boolean;
  /** แจ้งรายการใบล่าสุดให้หน้าแม่ (ใช้ตัดสินว่ากดสร้างตัวแทนใหม่ได้หรือยัง) */
  onChange?: (list: DealerPackageProposal[]) => void;
  /** เปิดฟอร์มออกใบใหม่ให้ครั้งเดียวหลังโหลดรายการเสร็จ (หน้ารวมใบเสนอแพ็กเกจ /hq/proposals) */
  เปิดฟอร์มทันที?: boolean;
}) {
  const logAudit = useAuditLogger();
  const [list, setList] = useState<DealerPackageProposal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [ร่าง, setร่าง] = useState<ร่างใบ | null>(null);
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  const ตั้งรายการ = useCallback((next: DealerPackageProposal[]) => {
    setList(next);
    onChange?.(next);
  }, [onChange]);

  const โหลด = useCallback(async () => {
    try {
      ตั้งรายการ(await proposalsRepo.list(prospect.id));
      setLoadErr("");
    } catch (e) {
      // ห้ามปล่อยว่างเงียบ ๆ — ผู้ใช้จะนึกว่ายังไม่เคยออกใบ แล้วออกซ้ำ
      setLoadErr(friendlyError(e, "โหลดใบเสนอแพ็กเกจไม่สำเร็จ"));
    } finally {
      setLoaded(true);
    }
  }, [prospect.id, ตั้งรายการ]);
  useEffect(() => { void โหลด(); }, [โหลด]);

  // รอรายการโหลดเสร็จก่อนค่อยเปิด — เปิดก่อนแล้วโหลดพังจะมีฟอร์มค้างทับข้อความผิดพลาด · เปิดแค่ครั้งเดียว ปิดแล้วไม่เด้งกลับ
  const เปิดฟอร์มไปแล้ว = useRef(false);
  useEffect(() => {
    if (!เปิดฟอร์มทันที || !editable || !loaded || loadErr || เปิดฟอร์มไปแล้ว.current) return;
    เปิดฟอร์มไปแล้ว.current = true;
    เปิดออกใบใหม่();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เปิดออกใบใหม่ อ่านแค่ prospect ที่ผูกกับแผงนี้ตลอดอายุแผง
  }, [เปิดฟอร์มทันที, editable, loaded, loadErr]);

  function เปิดออกใบใหม่() {
    setFormErr("");
    setร่าง({
      prospectId: prospect.id,
      // พื้นที่เติมจากลูกค้าเป้าหมายให้ก่อน — แก้ได้
      region: prospect.region || regionOf(prospect.province ?? "") || null,
      province: prospect.province ?? null,
      proposedDate: APP_NOW_ISO,
      status: "draft",
      มูลค่าที่พิมพ์: "", ระยะที่พิมพ์: "", เป้าที่พิมพ์: "",
    });
  }
  function เปิดแก้ใบ(p: DealerPackageProposal) {
    setFormErr("");
    setร่าง({
      ...p,
      มูลค่าที่พิมพ์: p.amount != null ? formatMoneyInput(String(p.amount)) : "",
      ระยะที่พิมพ์: p.contractMonths != null ? String(p.contractMonths) : "",
      เป้าที่พิมพ์: p.annualTarget != null ? formatMoneyInput(String(p.annualTarget)) : "",
    });
  }
  const ตั้งค่า = <K extends keyof ร่างใบ>(k: K, v: ร่างใบ[K]) => setร่าง(r => (r ? { ...r, [k]: v } : r));
  const เปลี่ยนภาค = (region: string) => setร่าง(r => r ? {
    ...r,
    region: region || null,
    province: region === ALL_REGIONS ? ALL_PROVINCES
      : region && provincesOfRegion(region).includes(r.province ?? "") ? r.province : null,
  } : r);

  async function บันทึกใบ() {
    if (!ร่าง) return;
    const { มูลค่าที่พิมพ์, ระยะที่พิมพ์, เป้าที่พิมพ์, ...ค่าอื่น } = ร่าง;
    const row = เตรียมบันทึกใบ({
      ...ค่าอื่น,
      amount: มูลค่าที่พิมพ์.trim() ? parseMoneyInput(มูลค่าที่พิมพ์) : null,
      contractMonths: ระยะที่พิมพ์.trim() ? Number(ระยะที่พิมพ์) : null,
      annualTarget: เป้าที่พิมพ์.trim() ? parseMoneyInput(เป้าที่พิมพ์) : null,
    });
    const ผิด = ตรวจใบเสนอ(row);
    if (ผิด) { setFormErr(ผิด); return; }
    setBusy(true); setFormErr("");
    try {
      if (ร่าง.id) {
        const saved = await proposalsRepo.update({ ...row, id: ร่าง.id, proposalNo: ร่าง.proposalNo, createdAt: ร่าง.createdAt });
        ตั้งรายการ(list.map(x => x.id === saved.id ? saved : x));
        logAudit("แก้ไขใบเสนอแพ็กเกจตัวแทน", `${saved.proposalNo ?? ""} · ${prospect.name}`);
      } else {
        const saved = await proposalsRepo.create(row);
        ตั้งรายการ([saved, ...list]);
        logAudit("ออกใบเสนอแพ็กเกจตัวแทน", `${saved.proposalNo ?? ""} · ${prospect.name} · ${packageLabel[saved.package]}`);
        แจ้งสำเร็จ(`ออกใบ ${saved.proposalNo ?? ""} แล้ว (ร่าง)`);
      }
      setร่าง(null);
    } catch (e) {
      setFormErr(friendlyError(e, "บันทึกใบเสนอแพ็กเกจไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  }

  async function เปลี่ยนสถานะ(p: DealerPackageProposal, status: DealerProposalStatus) {
    if (status === p.status) return;
    if (!(await ยืนยัน({
      หัวข้อ: `เปลี่ยนใบ ${p.proposalNo ?? ""} เป็น “${proposalStatusLabel[status]}” ?`,
      รายละเอียด: status === "sent"
        ? "ส่งแล้วจะแก้เนื้อหาในใบและลบใบไม่ได้อีก (เปลี่ยนได้แค่สถานะ) — ใบนี้คือหลักฐานว่าเสนออะไรไป"
        : "เปลี่ยนแล้วย้อนกลับไม่ได้",
      ปุ่มตกลง: `เปลี่ยนเป็น${proposalStatusLabel[status]}`,
    }))) return;
    try {
      const saved = await proposalsRepo.setStatus(p.id, status);
      ตั้งรายการ(list.map(x => x.id === saved.id ? saved : x));
      logAudit("เปลี่ยนสถานะใบเสนอแพ็กเกจตัวแทน", `${p.proposalNo ?? ""} · ${prospect.name} → ${proposalStatusLabel[status]}`);
    } catch (e) {
      แจ้งพลาด(friendlyError(e, "เปลี่ยนสถานะไม่สำเร็จ"));
    }
  }

  async function ลบใบ(p: DealerPackageProposal) {
    if (!(await ยืนยัน({
      หัวข้อ: `ลบใบร่าง ${p.proposalNo ?? ""} ?`,
      รายละเอียด: "ลบได้เฉพาะใบร่าง · ย้อนกลับไม่ได้",
      ปุ่มตกลง: "ลบใบร่าง", อันตราย: true,
    }))) return;
    try {
      await proposalsRepo.remove(p.id);
      ตั้งรายการ(list.filter(x => x.id !== p.id));
      logAudit("ลบใบเสนอแพ็กเกจตัวแทน (ร่าง)", `${p.proposalNo ?? ""} · ${prospect.name}`);
    } catch (e) {
      แจ้งพลาด(friendlyError(e, "ลบใบไม่สำเร็จ"));
    }
  }

  async function พิมพ์(p: DealerPackageProposal) {
    // เปิดหน้าต่างทันทีตอนกด — เปิดหลังรอโหลดข้อมูลบริษัท เบราว์เซอร์จะบล็อกเป็นป๊อปอัป
    const w = window.open("", "_blank");
    if (!w) { แจ้งพลาด("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — อนุญาตป๊อปอัปของเว็บนี้แล้วลองใหม่"); return; }
    try {
      เขียนใบเสนอลงหน้าต่าง(w, p, prospect, await hqCompanyRepo.get());
    } catch (e) {
      w.close();
      แจ้งพลาด(friendlyError(e, "เปิดหน้าพิมพ์ไม่สำเร็จ"));
    }
  }

  const วันนี้ = APP_NOW_ISO;

  return (
    <div style={{ marginTop: 18, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <FileText size={15} color={PRIMARY} />
        <div style={{ fontWeight: 800, color: "#2D2D2D", fontSize: "0.88rem" }}>ใบเสนอแพ็กเกจตัวแทน</div>
        <span style={{ fontSize: "0.72rem", color: MUTED }}>{loaded ? `${list.length} ใบ` : ""}</span>
        <div style={{ flex: 1 }} />
        {editable && (
          <button className="btn btn-secondary btn-sm" onClick={เปิดออกใบใหม่}>
            <Plus size={13} /> ออกใบเสนอแพ็กเกจ
          </button>
        )}
      </div>
      <div style={{ fontSize: "0.7rem", color: MUTED, marginBottom: 10, lineHeight: 1.6 }}>
        สร้างตัวแทนใหม่จากรายนี้ได้ ต่อเมื่อมีใบที่ “ส่งแล้ว” หรือ “ตอบรับ” อย่างน้อย 1 ใบ · ส่งแล้วแก้เนื้อหาไม่ได้
      </div>

      {loadErr && (
        <div role="alert" style={{ fontSize: "0.78rem", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
          {loadErr}
          <button className="btn btn-secondary btn-sm" onClick={() => void โหลด()}>ลองใหม่</button>
        </div>
      )}
      {!loadErr && (!loaded
        ? <div style={{ fontSize: "0.78rem", color: MUTED }}>กำลังโหลด…</div>
        : list.length === 0
          ? <div style={{ fontSize: "0.78rem", color: "#9ca3af", padding: "10px 0" }}>ยังไม่มีใบเสนอแพ็กเกจ</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map(p => {
                const สี = proposalStatusColor[p.status];
                const หมดอายุ = หมดอายุแล้ว(p, วันนี้);
                return (
                  <div key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                      <div style={{ fontWeight: 800, color: PRIMARY, fontSize: "0.82rem" }}>{p.proposalNo ?? "—"}</div>
                      <div style={{ fontSize: "0.74rem", color: "#374151" }}>
                        {packageLabel[p.package]} · ค่าแรกเข้า {มูลค่าอ่านง่าย(p.amount)}
                        {p.proposedDate ? ` · เสนอ ${fmtISOToThai(p.proposedDate)}` : ""}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: MUTED }}>
                        ระยะสัญญา {ระยะสัญญาอ่านง่าย(p.contractMonths)} · เป้ายอดซื้อต่อปี {มูลค่าอ่านง่าย(p.annualTarget)}
                      </div>
                      {p.validUntil && (
                        <div style={{ fontSize: "0.7rem", color: หมดอายุ ? "#b91c1c" : MUTED, fontWeight: หมดอายุ ? 700 : 400 }}>
                          มีผลถึง {fmtISOToThai(p.validUntil)}{หมดอายุ ? " · เลยกำหนดแล้ว" : ""}
                        </div>
                      )}
                    </div>
                    {editable && สถานะที่เปลี่ยนไปได้(p.status).length > 1 ? (
                      <>
                        {/* ต้องมีค่าเสมอ — ใบทุกใบต้องมีสถานะ · ตัวเลือกมีเฉพาะขั้นที่เดินหน้าได้จริง (ฐานข้อมูลบังคับซ้ำ) */}
                        <select aria-label={`สถานะใบ ${p.proposalNo ?? ""}`} className="form-select" value={p.status}
                          onChange={e => void เปลี่ยนสถานะ(p, e.target.value as DealerProposalStatus)}
                          style={{ width: "auto", cursor: "pointer", fontSize: "0.76rem", padding: "5px 28px 5px 10px" }}>
                          {สถานะที่เปลี่ยนไปได้(p.status).map(s => <option key={s} value={s}>{proposalStatusLabel[s]}</option>)}
                        </select>
                      </>
                    ) : (
                      <span className="badge" style={{ background: สี.bg, color: สี.text }}>{proposalStatusLabel[p.status]}</span>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" aria-label={`พิมพ์ใบ ${p.proposalNo ?? ""}`} title="พิมพ์" onClick={() => void พิมพ์(p)}>
                        <Printer size={13} />
                      </button>
                      {editable && !ใบล็อกแล้ว(p.status) && (
                        <>
                          <button className="btn btn-secondary btn-sm" aria-label={`แก้ไขใบ ${p.proposalNo ?? ""}`} title="แก้ไข" onClick={() => เปิดแก้ใบ(p)}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-sm" aria-label={`ลบใบ ${p.proposalNo ?? ""}`} title="ลบ" onClick={() => void ลบใบ(p)}
                            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

      {/* ฟอร์มออก/แก้ใบ — ส่งไปวางที่ body (portal) เพราะแผงนี้อยู่ในหน้าต่างรายละเอียดอีกชั้น
          ⚠️ เหตุการณ์จาก portal ยังไหลขึ้นไปหาหน้าต่างแม่ตามโครง React — คลิกฉากหลังต้องหยุดไว้ ไม่งั้นหน้าต่างแม่ปิดตาม */}
      {ร่าง && typeof document !== "undefined" && createPortal(
        <div onClick={e => { e.stopPropagation(); if (!busy) setร่าง(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => !busy && setร่าง(null)} label="ใบเสนอแพ็กเกจตัวแทน" className="modal-fit"
            style={{ background: "#fff", borderRadius: 16, width: 560, maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.3)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "#2D2D2D" }}>
                {ร่าง.id ? `แก้ไขใบ ${ร่าง.proposalNo ?? ""}` : "ออกใบเสนอแพ็กเกจตัวแทน"}
                <span style={{ display: "block", fontSize: "0.72rem", color: MUTED, fontWeight: 600 }}>{prospect.name}</span>
              </h2>
              <button aria-label="ปิด" onClick={() => !busy && setร่าง(null)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}><X size={18} /></button>
            </div>
            <div className="modal-fit-body" style={{ padding: "14px 20px" }}>
              {formErr && <div role="alert" style={{ background: "#fee2e2", border: "1px solid #dc262630", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: "0.8rem", color: "#dc2626", fontWeight: 600 }}>{formErr}</div>}
              <fieldset disabled={busy} style={{ border: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div>
                  <label className="form-label" htmlFor="pp-package">แพ็กเกจ *</label>
                  <select id="pp-package" className="form-select" value={ร่าง.package ?? ""} onChange={e => ตั้งค่า("package", (e.target.value || undefined) as DealerPackage | undefined)} style={{ cursor: "pointer" }}>
                    <option value="">— เลือกแพ็กเกจ —</option>
                    {PACKAGE_ORDER.map(k => <option key={k} value={k}>{packageLabel[k]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="pp-amount">ค่าแรกเข้า (บาท · จ่ายครั้งเดียว)</label>
                  {/* ช่องเงินใช้ text + ใส่ลูกน้ำเอง (บอสสั่ง 26 ส.ค. 69) · ไม่บังคับ — ไม่กรอก = "—" ห้ามเติมตัวเลขให้ */}
                  <input id="pp-amount" className="form-input" type="text" inputMode="numeric" value={ร่าง.มูลค่าที่พิมพ์}
                    onChange={e => ตั้งค่า("มูลค่าที่พิมพ์", formatMoneyInput(e.target.value))} placeholder="เว้นว่างได้" />
                </div>
                <div>
                  <label className="form-label" htmlFor="pp-months">ระยะสัญญา (เดือน)</label>
                  {/* จำนวนเต็มเดือน 1–120 — กรองเหลือแค่ตัวเลขตั้งแต่ตอนพิมพ์ ตัวตรวจฟ้องถ้าเกินช่วง */}
                  <input id="pp-months" className="form-input" type="text" inputMode="numeric" value={ร่าง.ระยะที่พิมพ์}
                    onChange={e => ตั้งค่า("ระยะที่พิมพ์", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="เช่น 12 · เว้นว่างได้" />
                </div>
                <div>
                  <label className="form-label" htmlFor="pp-target">เป้ายอดซื้อต่อปี (บาท)</label>
                  <input id="pp-target" className="form-input" type="text" inputMode="numeric" value={ร่าง.เป้าที่พิมพ์}
                    onChange={e => ตั้งค่า("เป้าที่พิมพ์", formatMoneyInput(e.target.value))} placeholder="เว้นว่างได้" />
                  <div style={{ fontSize: "0.66rem", color: MUTED, marginTop: 3 }}>ตั้งเป็นตัวแทนแล้ว ใช้เป็นเป้ายอดขายรายปีของสาขา</div>
                </div>
                {/* ภาคมาก่อนจังหวัด — กติกาเดียวกับฟอร์มลูกค้าเป้าหมาย · "ทุกภาค" = ทุกจังหวัด */}
                <div>
                  <label className="form-label" htmlFor="pp-region">ภาค (พื้นที่ที่ได้สิทธิ์)</label>
                  <select id="pp-region" className="form-select" value={ร่าง.region ?? ""} onChange={e => เปลี่ยนภาค(e.target.value)} style={{ cursor: "pointer" }}>
                    <option value="">— ยังไม่ระบุ —</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    <option value={ALL_REGIONS}>{ALL_REGIONS} (ทั่วประเทศ)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="pp-province">จังหวัด</label>
                  <select id="pp-province" className="form-select" value={ร่าง.province ?? ""} onChange={e => ตั้งค่า("province", e.target.value || null)} style={{ cursor: "pointer" }}>
                    <option value="">{ร่าง.region ? "— ยังไม่ระบุ —" : "— เลือกภาคก่อน —"}</option>
                    {ร่าง.region === ALL_REGIONS && <option value={ALL_PROVINCES}>{ALL_PROVINCES}</option>}
                    {provincesOfRegion(ร่าง.region ?? "").map(p => <option key={p} value={p}>{p}</option>)}
                    {ร่าง.province && ร่าง.province !== ALL_PROVINCES && !provincesOfRegion(ร่าง.region ?? "").includes(ร่าง.province) && (
                      <option value={ร่าง.province}>{ร่าง.province} (ตามที่บันทึกไว้)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="pp-date">วันที่เสนอ *</label>
                  <input id="pp-date" className="form-input" type="date" value={ร่าง.proposedDate ?? ""} onChange={e => ตั้งค่า("proposedDate", e.target.value || null)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="pp-valid">ข้อเสนอมีผลถึง</label>
                  <input id="pp-valid" className="form-input" type="date" value={ร่าง.validUntil ?? ""} onChange={e => ตั้งค่า("validUntil", e.target.value || null)} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" htmlFor="pp-terms">เงื่อนไข</label>
                  <textarea id="pp-terms" className="form-input" rows={4} value={ร่าง.terms ?? ""} onChange={e => ตั้งค่า("terms", e.target.value)}
                    placeholder="พิมพ์ทีละบรรทัด — แต่ละบรรทัดขึ้นเป็นหนึ่งข้อในเอกสาร" style={{ resize: "vertical" }} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label" htmlFor="pp-note">หมายเหตุภายใน (ไม่พิมพ์ลงเอกสาร)</label>
                  <input id="pp-note" className="form-input" value={ร่าง.note ?? ""} onChange={e => ตั้งค่า("note", e.target.value)} placeholder="เช่น คุยรายละเอียดทาง LINE แล้ว" />
                </div>
              </fieldset>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button className="btn btn-secondary btn-md" disabled={busy} onClick={() => setร่าง(null)}>ยกเลิก</button>
                <button className="btn btn-primary btn-md" disabled={busy} onClick={() => void บันทึกใบ()}
                  style={busy ? { opacity: .6, cursor: "not-allowed" } : undefined}>
                  {busy ? "กำลังบันทึก…" : "บันทึกใบ"}
                </button>
              </div>
            </div>
          </ModalCard>
        </div>,
        document.body,
      )}
    </div>
  );
}
