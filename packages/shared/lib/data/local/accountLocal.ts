// ── บัญชีเข้าระบบของตัวแทน — ฉบับโหมดเดโม (ทำงานในเครื่องผู้ใช้ ไม่ต่อฐานข้อมูล) ──
//
// โหมดเดโมไม่มีระบบยืนยันตัวตนจริง จึงจำลอง "กติกา" ให้ครบเพื่อให้ทดลองใช้ได้เหมือนของจริง:
//   • ตัวแทนแก้เองได้ 2 ครั้งตลอดอายุบัญชี · ครั้งที่ 3 ขึ้นไปต้องรอสำนักงานใหญ่อนุมัติ
//   • ทุกครั้งที่เปลี่ยน สำนักงานใหญ่เห็นในหน้าตัวแทน (คำขอ/ประวัติ) และเปิดดูรหัสได้
//
// ⚠️ ที่นี่เก็บรหัสไว้ในเครื่องของผู้ใช้เอง (localStorage) เพราะเดโมไม่มีเซิร์ฟเวอร์
//    โหมดจริง (supabase/api) จะยิงไปที่ API ของสำนักงานใหญ่แทน — ดู accountRemote.ts

import type { AccountChangeResult, AccountRequest, AccountState } from "../ports";

const CHANGES_KEY = "dealer_account_changes_v1";
const REQUESTS_KEY = "dealer_account_requests_v1";
const SECRETS_KEY = "dealer_account_secrets_v1";
const EMAILS_KEY = "dealer_account_emails_v1";
export const ACCOUNT_EVENT = "bpms-account-updated";

/** เพดานจำนวนครั้งที่ตัวแทนแก้เองได้ — เกินนี้ต้องขออนุมัติทุกครั้ง */
export const SELF_CHANGE_LIMIT = 2;

type ChangeRow = { dealerCode: string; kind: AccountRequest["kind"]; at: string; bySelf: boolean; newEmail?: string };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* เต็มโควตา = ไม่ล้มทั้งหน้า */ }
  try { window.dispatchEvent(new Event(ACCOUNT_EVENT)); } catch { /* SSR */ }
}

const changes = () => read<ChangeRow[]>(CHANGES_KEY, []);
const requests = () => read<AccountRequest[]>(REQUESTS_KEY, []);
const secrets = () => read<Record<string, string>>(SECRETS_KEY, {});
const emails = () => read<Record<string, string>>(EMAILS_KEY, {});

/** รหัสผ่านของสาขาในโหมดเดโม — ยังไม่เคยตั้ง = ค่าตั้งต้นเดโม (ตรงกับที่หน้าเข้าสู่ระบบใช้) */
export function localDealerPassword(dealerCode: string): string {
  return secrets()[dealerCode] ?? "demo1234";
}
/** อีเมลเข้าระบบของสาขาในโหมดเดโม (ถ้าเคยเปลี่ยนไว้) */
export function localDealerEmail(dealerCode: string, ค่าเดิม: string): string {
  return emails()[dealerCode] ?? ค่าเดิม;
}

function ชนิดของการแก้(email?: string, password?: string): AccountRequest["kind"] {
  if (email && password) return "both";
  return email ? "email" : "password";
}

function ใช้ผล(dealerCode: string, email?: string, password?: string) {
  if (email) write(EMAILS_KEY, { ...emails(), [dealerCode]: email });
  if (password) write(SECRETS_KEY, { ...secrets(), [dealerCode]: password });
}

export const accountLocal = {
  async state(dealerCode: string, อีเมลปัจจุบัน = ""): Promise<AccountState> {
    const ของสาขา = changes().filter(c => c.dealerCode === dealerCode && c.bySelf);
    const ค้าง = requests().find(r => r.dealerCode === dealerCode && r.status === "pending") ?? null;
    return {
      email: localDealerEmail(dealerCode, อีเมลปัจจุบัน),
      selfChangesUsed: ของสาขา.length,
      selfChangesLimit: SELF_CHANGE_LIMIT,
      pending: ค้าง,
    };
  },

  async change(input: { dealerCode: string; currentPassword: string; email?: string; password?: string }): Promise<AccountChangeResult> {
    const { dealerCode, currentPassword, email, password } = input;
    if (!email && !password) throw new Error("ยังไม่ได้กรอกอีเมลหรือรหัสผ่านใหม่");
    // ยืนยันตัวตนก่อนเสมอ — คนที่นั่งหน้าจอที่เปิดค้างไว้ต้องเปลี่ยนบัญชีของสาขาไม่ได้
    if (currentPassword !== localDealerPassword(dealerCode)) throw new Error("รหัสผ่านปัจจุบันไม่ถูกต้อง");
    if (password && password.length < 8) throw new Error("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร");

    const ค้างอยู่ = requests().find(r => r.dealerCode === dealerCode && r.status === "pending");
    if (ค้างอยู่) throw new Error("มีคำขอที่รอสำนักงานใหญ่อนุมัติอยู่แล้ว — รอผลก่อนส่งคำขอใหม่");

    const kind = ชนิดของการแก้(email, password);
    const ใช้ไป = changes().filter(c => c.dealerCode === dealerCode && c.bySelf).length;
    const at = new Date().toISOString();

    if (ใช้ไป < SELF_CHANGE_LIMIT) {
      ใช้ผล(dealerCode, email, password);
      write(CHANGES_KEY, [...changes(), { dealerCode, kind, at, bySelf: true, newEmail: email }]);
      return {
        applied: true, pending: false,
        message: `เปลี่ยนเรียบร้อย — เหลือสิทธิ์แก้เองอีก ${Math.max(0, SELF_CHANGE_LIMIT - ใช้ไป - 1)} ครั้ง · สำนักงานใหญ่จะเห็นการเปลี่ยนนี้`,
      };
    }

    // เกินโควตา → เก็บเป็นคำขอ ยังไม่มีผลจนกว่าสำนักงานใหญ่จะอนุมัติ
    const id = `REQ-${Date.now()}`;
    write(REQUESTS_KEY, [
      { id, dealerCode, kind, newEmail: email, status: "pending" as const, requestedAt: at },
      ...requests(),
    ]);
    // เก็บรหัสที่ขอไว้แยก (ไม่ส่งไปหน้าจอ HQ) — ใช้ตอนอนุมัติเท่านั้น
    write(`${SECRETS_KEY}:pending`, { ...read<Record<string, string>>(`${SECRETS_KEY}:pending`, {}), [id]: password ?? "" });
    return {
      applied: false, pending: true,
      message: "ใช้สิทธิ์แก้เองครบแล้ว — ส่งคำขอให้สำนักงานใหญ่อนุมัติแล้ว การเปลี่ยนจะมีผลเมื่อได้รับอนุมัติ",
    };
  },

  async listRequests(): Promise<AccountRequest[]> {
    return requests();
  },

  async decide(id: string, action: "approve" | "reject", reason?: string): Promise<void> {
    const ทั้งหมด = requests();
    const ใบ = ทั้งหมด.find(r => r.id === id);
    if (!ใบ || ใบ.status !== "pending") throw new Error("ไม่พบคำขอนี้ หรือถูกตัดสินไปแล้ว");
    const at = new Date().toISOString();
    if (action === "approve") {
      const รหัสที่ขอ = read<Record<string, string>>(`${SECRETS_KEY}:pending`, {})[id];
      ใช้ผล(ใบ.dealerCode, ใบ.newEmail, รหัสที่ขอ || undefined);
      write(CHANGES_KEY, [...changes(), { dealerCode: ใบ.dealerCode, kind: ใบ.kind, at, bySelf: false, newEmail: ใบ.newEmail }]);
    }
    write(REQUESTS_KEY, ทั้งหมด.map(r => r.id !== id ? r : {
      ...r, status: action === "approve" ? "approved" : "rejected", decidedAt: at, reason,
    }));
  },
};
