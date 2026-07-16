"use client";

// ─── แผงรายละเอียดลูกค้า (HQ ดูอย่างเดียว) ──────────────────────────────────────
// แท็บทั้งหมดอ่านจากข้อมูลจริง: ใบที่ปิดการขายได้ + รูปแม่แบบจาก Master Catalog
// ไม่มีแท็บสัญญา / ใบส่งมอบ / แบบก่อสร้าง — ระบบไม่มีที่เก็บข้อมูลเหล่านั้น
import { Building2, ShieldCheck, ShieldOff } from "lucide-react";
import { RightDrawer, type DrawerTab } from "@/components/ui/RightDrawer";
import { customerCode } from "@/lib/mock";
import { fmtBaht } from "@/lib/format";
import { toThaiDate } from "@/lib/warranty";
import { useMasterCatalog } from "@/lib/useMasterCatalog";
import { isWarrantyExpiringSoon, type CustomerDbRow, type PurchasedBuilding } from "@/lib/customerDb";

const PRIMARY = "#003366";
const DASH = <span style={{ color: "#9ca3af" }}>—</span>;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: "#f8f9fb", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: "0.65rem", color: "#6b7280", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{value}</div>
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
);

const Empty = ({ text }: { text: string }) => (
  <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)", padding: "8px 2px" }}>{text}</div>
);

/** รูปแม่แบบจาก Master Catalog — แม่แบบย่อยใช้รูปของตัวเอง ไม่มีก็ใช้รูปแม่แบบหลัก */
function BuildingThumb({ b }: { b: PurchasedBuilding }) {
  const catalog = useMasterCatalog();
  const product = catalog.find(p => p.name === b.buildingType);
  const src = (b.template && product?.subtypeImages?.[b.template]) || product?.image;

  if (!src) {
    return (
      <div style={{ width: 56, height: 56, borderRadius: 8, background: "#eef1f5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Building2 size={20} color="#9ca3af" />
      </div>
    );
  }
  // รูปเป็น data URL ที่ย่อขนาดแล้วใน Master Catalog — ใช้ <img> ตรง ๆ (next/image ไม่รองรับ data URL แบบนี้)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={b.template ?? b.buildingType} style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />;
}

function BuildingCard({ b }: { b: PurchasedBuilding }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: 10, border: "1px solid #e9edf2", borderRadius: 10 }}>
      <BuildingThumb b={b} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2D2D2D" }}>{b.template ?? b.buildingType}</div>
        <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 2 }}>
          {b.buildingType} · {b.quoteNo}
        </div>
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: PRIMARY, marginTop: 4 }}>{fmtBaht(b.value)}</div>
        <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 2 }}>
          ส่งมอบ {b.deliveredAt ? toThaiDate(b.deliveredAt) : "—"}
        </div>
      </div>
    </div>
  );
}

export function CustomerDrawer({ row, onClose }: { row: CustomerDbRow | null; onClose: () => void }) {
  if (!row) return null;

  const totalBought = row.buildings.reduce((s, b) => s + b.value, 0);

  const tabs: DrawerTab[] = [
    {
      key: "profile",
      label: "โปรไฟล์",
      content: (
        <Grid>
          <Field label="รหัสลูกค้า" value={customerCode(row.dealerCode, row.localId ?? row.id)} />
          <Field label="จังหวัด" value={row.province || DASH} />
          <Field label="ภาค" value={row.region ?? DASH} />
          <Field label="ตัวแทนที่ดูแล" value={`${row.dealerCode} · ${row.dealerName}`} />
          <Field label="อาคารที่ซื้อแล้ว" value={row.buildings.length ? `${row.buildings.length} อาคาร` : DASH} />
          <Field label="ลูกค้าซื้อซ้ำ" value={row.isRepeat ? "ใช่" : "ไม่ใช่"} />
          <Field label="ยอดซื้อรวม" value={row.totalRevenue > 0 ? fmtBaht(row.totalRevenue) : DASH} />
          <Field label="ซื้อล่าสุด" value={row.lastPurchase ?? DASH} />
        </Grid>
      ),
    },
    {
      key: "buildings",
      label: `อาคารที่ซื้อ (${row.buildings.length})`,
      content: row.buildings.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {row.buildings.map(b => <BuildingCard key={b.quoteNo} b={b} />)}
        </div>
      ) : <Empty text="ยังไม่มีอาคารที่ปิดการขายในระบบสำหรับลูกค้ารายนี้" />,
    },
    {
      key: "history",
      label: "ประวัติการซื้อ",
      content: row.buildings.length ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...row.buildings].reverse().map(b => (
              <div key={b.quoteNo} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 11px", border: "1px solid #e9edf2", borderRadius: 9 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#2D2D2D" }}>{b.quoteNo}</div>
                  <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 2 }}>{b.template ?? b.buildingType} · ปิดการขาย {b.wonDate}</div>
                </div>
                <div style={{ fontSize: "0.74rem", fontWeight: 700, color: PRIMARY, whiteSpace: "nowrap" }}>{fmtBaht(b.value)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: "0.76rem", fontWeight: 800, color: PRIMARY }}>
            <span>รวมจากใบที่ปิดการขาย</span><span>{fmtBaht(totalBought)}</span>
          </div>
        </>
      ) : <Empty text="ไม่มีใบเสนอราคาที่ปิดการขายได้ผูกกับลูกค้ารายนี้" />,
    },
    {
      key: "warranty",
      label: "การส่งมอบ · ประกัน",
      content: row.buildings.some(b => b.warranty) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {row.buildings.filter(b => b.warranty).map(b => {
            const w = b.warranty!;
            const soon = isWarrantyExpiringSoon(w);
            const ok = w.status === "active";
            const color = !ok ? "#9ca3af" : soon ? "#D97706" : "#059669";
            return (
              <div key={b.quoteNo} style={{ border: "1px solid #e9edf2", borderRadius: 10, padding: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  {ok ? <ShieldCheck size={15} color={color} /> : <ShieldOff size={15} color={color} />}
                  <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#2D2D2D" }}>{b.template ?? b.buildingType}</span>
                  <span style={{ fontSize: "0.66rem", fontWeight: 700, color, marginLeft: "auto" }}>{w.remainingLabel}</span>
                </div>
                <Grid>
                  <Field label="วันส่งมอบ" value={w.delivered} />
                  <Field label="ประกันถึง" value={w.expiry} />
                </Grid>
              </div>
            );
          })}
          <div style={{ fontSize: "0.63rem", color: "#9ca3af" }}>
            ประกันโครงสร้าง 10 ปีนับจากวันส่งมอบ · วันส่งมอบ = วันปิดการขาย + ระยะเวลาส่งมอบของใบนั้น
          </div>
        </div>
      ) : <Empty text="ยังไม่มีการส่งมอบ — ประกันเริ่มนับเมื่อส่งมอบแล้วเท่านั้น" />,
    },
    {
      key: "timeline",
      label: "ไทม์ไลน์",
      content: row.buildings.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {row.buildings.flatMap(b => [
            { at: b.wonAt, label: `ปิดการขาย ${b.quoteNo}`, sub: `${b.template ?? b.buildingType} · ${fmtBaht(b.value)}`, color: PRIMARY },
            ...(b.deliveredAt ? [{ at: b.deliveredAt, label: `ส่งมอบ ${b.template ?? b.buildingType}`, sub: b.warranty ? `ประกันถึง ${b.warranty.expiry}` : "", color: "#059669" }] : []),
          ])
            .filter((e): e is { at: Date; label: string; sub: string; color: string } => !!e.at)
            .sort((a, b) => b.at.getTime() - a.at.getTime())
            .map((e, i, arr) => (
              <div key={`${e.label}-${i}`} style={{ display: "flex", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: e.color, marginTop: 5 }} />
                  {i < arr.length - 1 && <span style={{ flex: 1, width: 2, background: "#e9edf2" }} />}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? 14 : 0, minWidth: 0 }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#2D2D2D" }}>{e.label}</div>
                  <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 1 }}>
                    {toThaiDate(e.at)}{e.sub && ` · ${e.sub}`}
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : <Empty text="ยังไม่มีเหตุการณ์ — ไทม์ไลน์เริ่มจากใบที่ปิดการขายได้" />,
    },
  ];

  return (
    <RightDrawer
      open={!!row}
      onClose={onClose}
      title={row.name}
      subtitle={`${row.dealerCode} · ${row.dealerName} · ${row.province}`}
      tabs={tabs}
      width={520}
    />
  );
}
