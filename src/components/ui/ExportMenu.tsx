"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { Download, ChevronDown, FileText, FileSpreadsheet, Printer } from "lucide-react";

type Cell = string | number;

/** รายการเสริมท้ายเมนู (เช่น นำเข้า) — แสดงใต้ตัวเลือก Export พร้อมเส้นคั่น */
export type ExtraAction = { label: string; desc?: string; icon?: ReactNode; onClick: () => void };

export type ExportMenuProps = {
  /** ชื่อไฟล์ (ไม่ต้องใส่นามสกุล) */
  filename: string;
  /** หัวข้อที่โชว์บนหน้า PDF */
  title?: string;
  headers: string[];
  rows: Cell[][];
  /** ปรับสไตล์ปุ่ม trigger */
  small?: boolean;
  /** รายการเสริมท้ายเมนู (เช่น นำเข้า CSV / เพิ่มลูกค้าเดิม) */
  extraActions?: ExtraAction[];
  /** หัวข้อกลุ่มรายการเสริม (เช่น "นำเข้า") */
  extraLabel?: string;
};

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const esc = (c: Cell) => String(c ?? "");

/** Export ตาราง — CSV / Excel / PDF (frontend-only, ไม่ง้อ backend) */
export function ExportMenu({ filename, title, headers, rows, small, extraActions, extraLabel }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function exportCSV() {
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${esc(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    setOpen(false);
  }

  function exportExcel() {
    const thead = `<tr>${headers.map(h => `<th style="background:#003366;color:#fff;padding:6px 10px;text-align:left">${esc(h)}</th>`).join("")}</tr>`;
    const tbody = rows.map(r => `<tr>${r.map(c => `<td style="padding:5px 10px;border:1px solid #e5e7eb">${esc(c)}</td>`).join("")}</tr>`).join("");
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>${thead}${tbody}</table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), `${filename}.xls`);
    setOpen(false);
  }

  function exportPDF() {
    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win) { setOpen(false); return; }
    const thead = `<tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr>`;
    const tbody = rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title ?? filename)}</title>
      <style>
        *{font-family:"Noto Sans Thai","Sarabun",system-ui,sans-serif;box-sizing:border-box}
        body{margin:28px;color:#2D2D2D}
        h1{font-size:18px;color:#003366;margin:0 0 2px}
        .sub{font-size:11px;color:#6b7280;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:#003366;color:#fff;text-align:left;padding:7px 10px}
        td{padding:6px 10px;border-bottom:1px solid #e5e7eb}
        tr:nth-child(even) td{background:#f8f9fb}
      </style></head><body>
      <h1>${esc(title ?? filename)}</h1>
      <div class="sub">ระบบ PMS · ${rows.length} รายการ</div>
      <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    win.document.close();
    setOpen(false);
  }

  const OPTS = [
    { label: "PDF", desc: "พิมพ์ / บันทึกเป็น PDF", Icon: Printer, fn: exportPDF },
    { label: "Excel", desc: "ไฟล์ .xls", Icon: FileSpreadsheet, fn: exportExcel },
    { label: "CSV", desc: "ไฟล์ .csv", Icon: FileText, fn: exportCSV },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={`btn btn-secondary ${small ? "btn-sm" : "btn-md"}`} onClick={() => setOpen(o => !o)} style={{ gap: 6 }}>
        <Download size={14} /> Export
        <ChevronDown size={13} style={{ opacity: 0.55, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, minWidth: 200, boxShadow: "var(--shadow-lg, 0 12px 36px rgba(0,0,0,.14))", overflow: "hidden", padding: 4 }}>
          {OPTS.map(o => (
            <button key={o.label} onClick={o.fn}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f8f9fb"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "#dce5f0", color: "#003366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><o.Icon size={15} /></span>
              <span>
                <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{o.label}</span>
                <span style={{ display: "block", fontSize: "0.65rem", color: "#6b7280" }}>{o.desc}</span>
              </span>
            </button>
          ))}
          {extraActions && extraActions.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid #eef0f4", margin: "4px 0" }} />
              {extraLabel && <div style={{ padding: "4px 10px 2px", fontSize: "0.62rem", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.04em" }}>{extraLabel}</div>}
              {extraActions.map(a => (
                <button key={a.label} onClick={() => { setOpen(false); a.onClick(); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f8f9fb"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: "#dce5f0", color: "#003366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.icon}</span>
                  <span>
                    <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{a.label}</span>
                    {a.desc && <span style={{ display: "block", fontSize: "0.65rem", color: "#6b7280" }}>{a.desc}</span>}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
