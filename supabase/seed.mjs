// Benjamin PMS — Seed ข้อมูลตั้งต้นเข้า Supabase (ครั้งเดียว)
// สร้าง: ตาราง dealers + auth users + profiles (role/dealer_code) สำหรับทุกสาขา + HQ
// ต้องใช้ service_role key (ข้าม RLS + สร้าง auth user ได้) — ห้าม commit / ห้ามใส่ฝั่ง client
//
// รัน (Git Bash):   SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed.mjs
// รัน (PowerShell): $env:SUPABASE_SERVICE_ROLE_KEY="..."; node supabase/seed.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || "https://yhhhcrvhkforwsagojho.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("❌ ต้องตั้ง SUPABASE_SERVICE_ROLE_KEY (เอาจาก Supabase → Settings → API → service_role)");
  process.exit(1);
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── ข้อมูลสาขา (จาก dealerLeaderboard) ──
const DEALERS = [
  { code:"RYG", name:"บจ. ระยองสตีลเวิร์คส์",     province:"ระยอง",           region:"ตะวันออก", revenueActual:5400000,  revenueTarget:6000000,  winRate:48, activeProjects:6, onTimePct:91, status:"active",   email:"sales@rayongsteel.co.th",     password:"PEB-RYG-4821" },
  { code:"CNX", name:"บจ. เชียงใหม่สตีลบิลด์",    province:"เชียงใหม่",       region:"เหนือ",    revenueActual:22438650, revenueTarget:45000000, winRate:50, activeProjects:5, onTimePct:78, status:"active",   email:"sales@cmsteelbuild.co.th",    password:"PEB-CNX-3317" },
  { code:"MST", name:"หจก. แม่สอดเมทัลเวิร์ค",     province:"ตาก",             region:"ตะวันตก", revenueActual:3800000,  revenueTarget:5000000,  winRate:52, activeProjects:4, onTimePct:85, status:"active",   email:"sales@maesotmetal.co.th",     password:"PEB-MST-7749" },
  { code:"CRI", name:"บจ. เชียงรายสตรัคเจอร์",    province:"เชียงราย",        region:"เหนือ",    revenueActual:3100000,  revenueTarget:5800000,  winRate:41, activeProjects:3, onTimePct:72, status:"active",   email:"sales@crstructure.co.th",     password:"PEB-CRI-5563" },
  { code:"NSN", name:"บจ. นครสวรรค์เอ็นจิเนียริ่ง", province:"นครสวรรค์",       region:"กลาง",     revenueActual:1900000,  revenueTarget:5000000,  winRate:29, activeProjects:2, onTimePct:61, status:"active",   email:"sales@nsn-engineering.co.th", password:"PEB-NSN-2294" },
  { code:"HYI", name:"บจ. หาดใหญ่สตีลกรุ๊ป",     province:"สงขลา",           region:"ใต้",      revenueActual:920000,   revenueTarget:4000000,  winRate:18, activeProjects:1, onTimePct:0,  status:"inactive", email:"sales@hatyaisteel.co.th",     password:"PEB-HYI-1108" },
  { code:"AYA", name:"บจ. อยุธยาเมทัลบิลด์",      province:"พระนครศรีอยุธยา", region:"กลาง",     revenueActual:4650000,  revenueTarget:5200000,  winRate:47, activeProjects:5, onTimePct:90, status:"active",   email:"sales@ayametalbuild.co.th",   password:"PEB-AYA-6612" },
  { code:"KKN", name:"หจก. ขอนแก่นโครงเหล็ก",    province:"ขอนแก่น",         region:"อีสาน",    revenueActual:3450000,  revenueTarget:4800000,  winRate:44, activeProjects:4, onTimePct:88, status:"active",   email:"sales@kksteelframe.co.th",    password:"PEB-KKN-9034" },
  { code:"UBN", name:"บจ. อุบลสตีลกรุ๊ป",        province:"อุบลราชธานี",     region:"อีสาน",    revenueActual:2750000,  revenueTarget:4500000,  winRate:33, activeProjects:3, onTimePct:74, status:"active",   email:"sales@ubonsteel.co.th",       password:"PEB-UBN-4478" },
  { code:"PKT", name:"บจ. ภูเก็ตสตรัคเจอรัล",    province:"ภูเก็ต",          region:"ใต้",      revenueActual:2300000,  revenueTarget:3500000,  winRate:38, activeProjects:2, onTimePct:81, status:"active",   email:"sales@phuketstructural.co.th", password:"PEB-PKT-2851" },
];

// ── บัญชีผู้ใช้ = ทุกสาขา (DEALER_ADMIN) + HQ + demo ──
const USERS = [
  ...DEALERS.map(d => ({ email:d.email, password:d.password, role:"DEALER_ADMIN", dealer_code:d.code, name:d.name })),
  { email:"admin@benjamin.com", password:"benjamin", role:"SUPER_ADMIN",  dealer_code:"",    name:"ผู้ดูแลสำนักงานใหญ่" },
  { email:"cnx@dealer.com",     password:"benjamin", role:"DEALER_ADMIN", dealer_code:"CNX", name:"ตัวแทนเชียงใหม่ (demo)" },
];

async function main() {
  // 1) ตาราง dealers
  const rows = DEALERS.map(d => ({
    code:d.code, name:d.name, province:d.province, region:d.region,
    revenue_actual:d.revenueActual, revenue_target:d.revenueTarget, win_rate:d.winRate,
    active_projects:d.activeProjects, on_time_pct:d.onTimePct, status:d.status,
  }));
  const { error: de } = await admin.from("dealers").upsert(rows, { onConflict: "code" });
  if (de) throw new Error("dealers: " + de.message);
  console.log(`✓ dealers: upsert ${rows.length} สาขา`);

  // 2) auth users + profiles (idempotent — มีอยู่แล้วใช้ id เดิม)
  const existing = new Map();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("listUsers: " + error.message);
    data.users.forEach(u => existing.set(u.email, u.id));
    if (data.users.length < 1000) break;
    page++;
  }
  for (const u of USERS) {
    let id = existing.get(u.email);
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({ email:u.email, password:u.password, email_confirm:true });
      if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
      id = data.user.id;
    }
    const { error: pe } = await admin.from("profiles").upsert(
      { id, role:u.role, dealer_code:u.dealer_code, name:u.name, status:"active" },
      { onConflict: "id" },
    );
    if (pe) throw new Error(`profile ${u.email}: ${pe.message}`);
    console.log(`✓ user+profile: ${u.email} (${u.role}${u.dealer_code ? " · " + u.dealer_code : ""})`);
  }
  console.log("\n🎉 seed เสร็จ — dealers + " + USERS.length + " บัญชีพร้อมล็อกอิน");
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
