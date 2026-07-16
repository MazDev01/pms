import { chromium } from "playwright";
const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await pg.goto("http://localhost:3000/");
await pg.evaluate(() => { localStorage.setItem("pms_session_key", "hq"); localStorage.setItem("pms_logged_in", "true"); });
await pg.goto("http://localhost:3000/hq/quotations", { waitUntil: "networkidle" });
await pg.waitForTimeout(2000);

const r = await pg.evaluate(() => {
  // ตารางใบเสนอราคา = ตารางที่มีหัวคอลัมน์ "เลขที่"
  const tbl = [...document.querySelectorAll("table")].find(t => t.innerText.startsWith("เลขที่"));
  if (!tbl) return { err: "ไม่เจอตารางใบเสนอราคา" };
  const wrap = tbl.closest(".table-wrap") || tbl.parentElement;
  // scrollWidth บน td เชื่อไม่ได้ — โคลนเนื้อหาไปวัดในกล่อง nowrap ที่ฟอนต์/padding เท่ากัน
  const need = cell => {
    const cs = getComputedStyle(cell);
    const d = document.createElement("div");
    d.style.cssText = `position:absolute;left:-9999px;top:0;white-space:nowrap;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
    d.innerHTML = cell.innerHTML;
    document.body.appendChild(d);
    const w = Math.ceil(d.getBoundingClientRect().width) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    d.remove();
    return w;
  };
  const ths = [...tbl.querySelectorAll("thead th")];
  const rows = [...tbl.querySelectorAll("tbody tr")];
  return {
    avail: Math.round(wrap.clientWidth), tableW: Math.round(tbl.getBoundingClientRect().width), n: rows.length,
    cols: ths.map((th, i) => {
      // ต้องวัดทั้งหัวตารางและตัวข้อมูล — เคยพลาดเพราะวัดแต่ tbody แล้วหัวตารางโดนตัด
      const head = need(th);
      const body = Math.max(0, ...rows.map(tr => tr.children[i] ? need(tr.children[i]) : 0));
      return { name: th.innerText.trim() || "(ปุ่ม)", head, body, need: Math.max(head, body), now: Math.round(th.getBoundingClientRect().width) };
    }),
  };
});
if (r.err) { console.log(r.err); await b.close(); process.exit(1); }
console.log(`กรอบ ${r.avail}px · ตาราง ${r.tableW}px · ${r.n} แถว → ${r.tableW > r.avail ? `ล้น ${r.tableW - r.avail}px` : "ไม่ล้น"}`);
console.log("คอลัมน์".padEnd(14), "หัว".padStart(4), "ข้อมูล".padStart(6), "ต้องการ".padStart(7), "ตอนนี้".padStart(6));
let sum = 0;
r.cols.forEach(c => { sum += c.need; console.log(c.name.padEnd(14), String(c.head).padStart(4), String(c.body).padStart(6), String(c.need).padStart(7), String(c.now).padStart(6), c.now < c.need ? `✂ ตัด ${c.need - c.now}` : "ok"); });
console.log("รวมที่ต้องการ", sum, "· กรอบ", r.avail, sum > r.avail ? `→ ขาด ${sum - r.avail}px` : `→ เหลือ ${r.avail - sum}px`);
await b.close();
