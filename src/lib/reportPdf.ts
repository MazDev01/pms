// ── Export รายงานเป็น PDF (frontend-only) — เปิดหน้าต่างพิมพ์ → ผู้ใช้ Save as PDF ──
// ใช้แบรนด์ Benjamin · CI navy · ไม่มี dependency (ใช้ window.print ของเบราว์เซอร์)

export type ReportSection = { heading: string; columns?: string[]; rows: (string | number)[][] };

const esc = (v: string | number) =>
  String(v).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

export function exportReportPDF(title: string, subtitle: string, sections: ReportSection[]) {
  const sectionHtml = sections
    .filter(s => s.rows.length > 0)
    .map(s => `
      <h2>${esc(s.heading)}</h2>
      <table>
        ${s.columns ? `<thead><tr>${s.columns.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>` : ""}
        <tbody>
          ${s.rows.map(r => `<tr>${r.map((c, i) => `<td class="${i === 0 ? "l" : "r"}">${esc(c)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>`)
    .join("");

  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)} — Benjamin</title>
<style>
  *{box-sizing:border-box}
  body{font-family:"Noto Sans Thai","Sarabun",system-ui,sans-serif;color:#2D2D2D;margin:0;padding:32px 36px;font-size:12px}
  .brand{font-size:22px;font-weight:800;color:#003366;letter-spacing:.02em}
  .brand small{display:block;font-size:11px;font-weight:600;color:#8a929c;margin-top:2px}
  h1{font-size:16px;font-weight:800;color:#003366;margin:18px 0 2px}
  .sub{font-size:11px;color:#6b7280;margin-bottom:4px}
  h2{font-size:12.5px;font-weight:800;color:#2D2D2D;margin:18px 0 7px;padding-bottom:5px;border-bottom:2px solid #003366}
  table{width:100%;border-collapse:collapse;margin-bottom:6px}
  th{background:#f0f4f8;color:#6b7280;font-weight:700;text-align:left;padding:6px 9px;font-size:10.5px;border-bottom:1px solid #e5e7eb}
  td{padding:6px 9px;border-bottom:1px solid #f0f4f8;font-size:11px}
  td.r{text-align:right;font-weight:700;color:#003366;white-space:nowrap}
  td.l{color:#2D2D2D}
  .foot{margin-top:22px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
  @media print{@page{size:A4;margin:14mm}body{padding:0}}
</style></head><body>
  <div class="brand">Benjamin<small>ระบบบริหารงานขาย (Sales CRM) · Pre-Engineered Building</small></div>
  <h1>${esc(title)}</h1>
  <div class="sub">${esc(subtitle)}</div>
  ${sectionHtml}
  <div class="foot">เอกสารสร้างจากระบบ Benjamin PMS · ข้อมูลตามช่วงเวลาที่เลือก</div>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
