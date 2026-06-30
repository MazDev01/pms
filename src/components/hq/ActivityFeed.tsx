"use client";

import { Trophy, Inbox, CheckCircle2, ArrowRightLeft, Building2, Receipt } from "lucide-react";
import { hqRecentActivity, ActivityKind } from "@/lib/mock";

const KIND_ICON: Record<ActivityKind, React.ElementType> = {
  win:     Trophy,
  lead:    Inbox,
  approve: CheckCircle2,
  assign:  ArrowRightLeft,
  project: Building2,
  invoice: Receipt,
};

const KIND_COLOR: Record<ActivityKind, { bg: string; color: string }> = {
  win:     { bg: "#e5faf0", color: "#059669" },
  lead:    { bg: "#dce5f0", color: "#003366" },
  approve: { bg: "#dce5f0", color: "#003366" },
  assign:  { bg: "#dce5f0", color: "#003366" },
  project: { bg: "#dce5f0", color: "#003366" },
  invoice: { bg: "#dce5f0", color: "#003366" },
};

export function ActivityFeed() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">กิจกรรมล่าสุด</div>
          <div className="card-desc">ทั้งเครือ · อัปเดตอัตโนมัติ</div>
        </div>
      </div>

      <div>
        {hqRecentActivity.map((item, i) => {
          const style = KIND_COLOR[item.kind];
          const Icon = KIND_ICON[item.kind];
          return (
            <div key={i} className="activity">
              <div className="activity-icon" style={{ background: style.bg, color: style.color }}>
                <Icon size={15} color={style.color} strokeWidth={2} />
              </div>
              <div className="activity-text">
                <div className="activity-title" style={{ fontWeight: 500, lineHeight: 1.4 }}>
                  {item.text}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
                  <span className="badge" style={{
                    fontSize: "0.6rem", padding: "1px 8px",
                    background: style.bg, color: style.color,
                  }}>
                    {item.branch}
                  </span>
                  <span className="activity-meta">{item.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
