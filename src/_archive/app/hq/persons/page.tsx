"use client";

import { useState, useEffect, useMemo } from "react";
import { responsiblePersons, leads, RP_STORAGE_KEY, type ResponsiblePerson } from "@/lib/mock";

function parseValueBaht(v: string): number {
  const m = v.match(/([\d.]+)/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (v.includes("M")) return n * 1_000_000;
  if (v.includes("K")) return n * 1_000;
  return n;
}

type PersonStats = ResponsiblePerson & {
  totalLeads: number;
  won: number;
  lost: number;
  open: number;
  winRate: number;
  pipeline: number;
};

export default function HQPersonsPage() {
  const [persons, setPersons] = useState<ResponsiblePerson[]>(responsiblePersons);
  const [filterActive, setFilterActive] = useState<"active" | "all">("active");

  useEffect(() => {
    const s = localStorage.getItem(RP_STORAGE_KEY);
    if (s) try { setPersons(JSON.parse(s)); } catch {}
  }, []);

  const stats = useMemo<PersonStats[]>(() =>
    persons.map(p => {
      const myLeads = leads.filter(l => l.assigned === p.name);
      const won  = myLeads.filter(l => l.status === "PAID");
      const lost = myLeads.filter(l => l.status === "CANCELLED");
      const open = myLeads.filter(l => l.status !== "PAID" && l.status !== "CANCELLED");
      const closed = won.length + lost.length;
      const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0;
      const pipeline = open.reduce((s, l) => s + parseValueBaht(l.value), 0);
      return { ...p, totalLeads: myLeads.length, won: won.length, lost: lost.length, open: open.length, winRate, pipeline };
    }),
    [persons],
  );

  const filtered = filterActive === "active" ? stats.filter(p => p.active) : stats;

  const totalActive  = persons.filter(p => p.active).length;
  const totalWon     = filtered.reduce((s, p) => s + p.won, 0);
  const avgWinRate   = filtered.length > 0
    ? Math.round(filtered.reduce((s, p) => s + p.winRate, 0) / filtered.length)
    : 0;
  const totalPipeline = filtered.reduce((s, p) => s + p.pipeline, 0);

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>ผู้รับผิดชอบ</h2>
          <p>รายงานประสิทธิภาพทีมขายทุกสาขา — ผู้รับผิดชอบคือข้อมูลธุรกิจ ไม่ใช่ผู้ใช้ระบบ</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-bar" style={{ marginBottom: 20 }}>
        <div className="kpi-item">
          <span className="kpi-label">ผู้รับผิดชอบ (กำลังดำเนินการ)</span>
          <span className="kpi-val">{totalActive}</span>
        </div>
        <div className="kpi-sep" />
        <div className="kpi-item">
          <span className="kpi-label">โอกาสการขายที่ชนะรวม</span>
          <span className="kpi-val" style={{ color: "#059669" }}>{totalWon}</span>
        </div>
        <div className="kpi-sep" />
        <div className="kpi-item">
          <span className="kpi-label">อัตราปิดการขายเฉลี่ย</span>
          <span className="kpi-val">{avgWinRate}%</span>
        </div>
        <div className="kpi-sep" />
        <div className="kpi-item">
          <span className="kpi-label">โอกาสการขายรวม</span>
          <span className="kpi-val">
            {totalPipeline > 0 ? `฿${(totalPipeline / 1_000_000).toFixed(1)}M` : "—"}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 className="card-title">รายชื่อผู้รับผิดชอบ</h3>
            <p className="card-desc">ข้อมูลรวมจากผู้สนใจทุกสาขาในเครือ</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className={`btn btn-sm ${filterActive === "active" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterActive("active")}>
              กำลังดำเนินการเท่านั้น
            </button>
            <button
              className={`btn btn-sm ${filterActive === "all" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilterActive("all")}>
              ทั้งหมด
            </button>
          </div>
        </div>

        <div className="card-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ชื่อ - ตำแหน่ง</th>
                  <th>สถานะ</th>
                  <th style={{ textAlign: "center" }}>ผู้สนใจทั้งหมด</th>
                  <th style={{ textAlign: "center" }}>ชนะ</th>
                  <th style={{ textAlign: "center" }}>แพ้</th>
                  <th style={{ textAlign: "center" }}>เปิดอยู่</th>
                  <th style={{ textAlign: "center" }}>อัตราปิดการขาย</th>
                  <th style={{ textAlign: "right" }}>โอกาสการขาย</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: "#003366", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.78rem", fontWeight: 800, flexShrink: 0,
                        }}>
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#1e293b" }}>{p.name}</div>
                          <div style={{ fontSize: "0.68rem", color: "#6b7280" }}>{p.title}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: "2px 10px", borderRadius: 99, fontSize: "0.68rem", fontWeight: 700,
                        background: p.active ? "#d1fae5" : "#f3f4f6",
                        color: p.active ? "#059669" : "#9ca3af",
                      }}>
                        {p.active ? "กำลังดำเนินการ" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "#1e293b" }}>{p.totalLeads}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "#059669" }}>{p.won}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "#dc2626" }}>{p.lost}</td>
                    <td style={{ textAlign: "center", color: "#475569" }}>{p.open}</td>
                    <td style={{ textAlign: "center" }}>
                      {p.totalLeads === 0 ? (
                        <span style={{ color: "#9ca3af", fontSize: "0.78rem" }}>—</span>
                      ) : (
                        <span style={{
                          fontWeight: 700, fontSize: "0.82rem",
                          color: p.winRate >= 50 ? "#059669" : p.winRate >= 30 ? "#d97706" : "#dc2626",
                        }}>
                          {p.winRate}%
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontSize: "0.82rem" }}>
                      {p.pipeline > 0 ? `฿${(p.pipeline / 1_000_000).toFixed(1)}M` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: "0.85rem" }}>
              ไม่พบผู้รับผิดชอบ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
