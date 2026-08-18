import { describe, it, expect } from "vitest";
import {
  normalizeLeadTaskTemplate, buildLeadTasks, stageFromTasks, syncTasksToStage,
  LEAD_TASK_TEMPLATE, CLOSE_TASK_KEY,
  type LeadTaskDef,
} from "../../packages/shared/lib/mock";

// ── งานมาตรฐานรายขั้นที่ HQ ตั้งเองได้ (13 ส.ค. 69) ───────────────────────────────
//
// ชุดงานนี้ไม่ใช่ข้อความประดับ: มันคือตัวขับสถานะของลูกค้าเป้าหมายทุกใบ (เช็กงาน → เลื่อนขั้นเอง)
// ค่าที่ HQ ตั้งจึงต้องผ่านการตรวจก่อนใช้เสมอ — ของเพี้ยนจาก DB/หน้าจอห้ามทำให้ระบบขายพัง
describe("ตรวจ/ซ่อมชุดงานมาตรฐานก่อนใช้", () => {
  it("ข้อมูลว่าง/ไม่ใช่รายการ → ใช้ชุดเริ่มต้นในโค้ด", () => {
    expect(normalizeLeadTaskTemplate(null)).toEqual(LEAD_TASK_TEMPLATE);
    expect(normalizeLeadTaskTemplate([])).toEqual(LEAD_TASK_TEMPLATE);
    expect(normalizeLeadTaskTemplate("ไม่ใช่รายการ")).toEqual(LEAD_TASK_TEMPLATE);
  });

  it("ทิ้งงานที่ไม่มีชื่อ / ขั้นไม่ถูกต้อง / คีย์ซ้ำ", () => {
    const out = normalizeLeadTaskTemplate([
      { key: "a", label: "ติดต่อ", stage: "WAITING" },
      { key: "b", label: "   ", stage: "WAITING" },      // ไม่มีชื่อ
      { key: "c", label: "งาน", stage: "ไม่มีขั้นนี้" },   // ขั้นไม่ถูกต้อง
      { key: "a", label: "ซ้ำ", stage: "BULLET" },        // คีย์ซ้ำ — เก็บตัวแรก
    ]);
    expect(out.map(t => t.key)).toEqual(["a", CLOSE_TASK_KEY]);
    expect(out[0].label).toBe("ติดต่อ");
  });

  it("งาน “ปิดการขาย” หายไป → เติมกลับให้เสมอ (ไม่งั้นปิดดีลไม่ได้ทั้งระบบ)", () => {
    const out = normalizeLeadTaskTemplate([{ key: "x", label: "งานเดียว", stage: "WAITING" }]);
    expect(out.some(t => t.key === CLOSE_TASK_KEY)).toBe(true);
    expect(out[out.length - 1].key).toBe(CLOSE_TASK_KEY); // อยู่ท้ายสุดเสมอ (ขั้น PAID)
  });

  it("เรียงตามลำดับขั้นเสมอ แม้ HQ บันทึกมาสลับ", () => {
    const out = normalizeLeadTaskTemplate([
      { key: "n", label: "เจรจา", stage: "NEGO" },
      { key: "w", label: "ติดต่อ", stage: "WAITING" },
      { key: "q", label: "ออกใบ", stage: "QUOTED" },
    ]);
    expect(out.map(t => t.stage)).toEqual(["WAITING", "QUOTED", "NEGO", "PAID"]);
  });
});

describe("ลูกค้าเป้าหมายใช้ชุดงานที่ HQ ตั้ง ไม่ใช่ชุดเริ่มต้นในโค้ด", () => {
  const tpl: LeadTaskDef[] = [
    { key: "w1", label: "โทรหาลูกค้า", stage: "WAITING" },
    { key: "b1", label: "ถามความต้องการ", stage: "BULLET" },
    { key: CLOSE_TASK_KEY, label: "ปิดการขาย", stage: "PAID" },
  ];

  it("สร้าง checklist จากชุดที่ส่งมา", () => {
    expect(buildLeadTasks(tpl).map(t => t.label)).toEqual(["โทรหาลูกค้า", "ถามความต้องการ", "ปิดการขาย"]);
  });

  it("เช็กงานของขั้นไหน สถานะเลื่อนไปขั้นนั้น", () => {
    const tasks = buildLeadTasks(tpl).map(t => t.key === "w1" ? { ...t, done: true } : t);
    expect(stageFromTasks(tasks, tpl)).toBe("WAITING");
    const more = tasks.map(t => t.key === "b1" ? { ...t, done: true } : t);
    expect(stageFromTasks(more, tpl)).toBe("BULLET");
  });

  it("ย้ายสถานะ → ติ๊กงานให้ถึงขั้นนั้น ตามชุดของ HQ", () => {
    const out = syncTasksToStage(undefined, "BULLET", "ผู้ทดสอบ", tpl);
    expect(out.map(t => `${t.label}:${t.done}`))
      .toEqual(["โทรหาลูกค้า:true", "ถามความต้องการ:true", "ปิดการขาย:false"]);
  });

  it("ไม่ส่งชุดมา → ยังใช้ชุดเริ่มต้นเหมือนเดิม (ของเก่าไม่พัง)", () => {
    expect(buildLeadTasks().length).toBe(LEAD_TASK_TEMPLATE.length);
  });
});

// ── ลำดับงานมาตรฐานที่บอสสั่งเอง (17 ส.ค. 69) ───────────────────────────────────
// ล็อกไว้ทั้งชื่อและลำดับ — เคยมีคนเข้าใจว่า "ส่งแม่แบบให้ลูกค้า" ควรอยู่ก่อนออกใบ
// แต่บอสยืนยันว่าให้อยู่หลัง "ส่งใบเสนอราคา" · ถ้าตั้ง stage ผิดเป็น BULLET
// normalize จะเรียงตามขั้นแล้วเด้งกลับไปอยู่ก่อนออกใบเอง = ผิดคำสั่งโดยไม่มีใครรู้
describe("ลำดับงานมาตรฐานตามที่บอสสั่ง", () => {
  it("ชื่อและลำดับต้องตรงเป๊ะ 9 งาน", () => {
    expect(buildLeadTasks().map(t => t.label)).toEqual([
      "ติดต่อแล้ว",
      "เก็บข้อมูลลูกค้า",
      "นัดหมาย",
      "จัดทำใบเสนอราคา",
      "ส่งใบเสนอราคา",
      "ส่งแม่แบบให้ลูกค้า",
      "ติดตามผล",
      "เจรจา",
      "ปิดการขาย / ไม่สำเร็จ",
    ]);
  });

  it("ผ่าน normalize แล้วลำดับต้องไม่สลับ (เรียงตามขั้นแต่คงลำดับในขั้นเดียวกัน)", () => {
    expect(normalizeLeadTaskTemplate(LEAD_TASK_TEMPLATE).map(t => t.key)).toEqual([
      "contact", "collect", "appointment", "makeQuote", "sendQuote", "catalog", "followup", "negotiate", "close",
    ]);
  });

  it("ไม่มีงาน 'รวบรวมความต้องการ' (บอสส่งรายการยืนยันซ้ำแบบไม่มี · ชื่อ 'ขั้น' ยังเป็นคำนี้อยู่)", () => {
    expect(buildLeadTasks().some(t => t.label === "รวบรวมความต้องการ")).toBe(false);
  });
});

