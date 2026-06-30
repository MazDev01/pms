"use client";

import { hqKpis, hqSalesByMonth } from "@/lib/mock";
import { KpiCard } from "@/components/ui/KpiCard";
import { LineChartCard } from "@/components/ui/LineChart";
import { LeaderboardCard } from "@/components/hq/LeaderboardCard";
import { LeadPoolWidget } from "@/components/hq/LeadPoolWidget";
import { ProjectHealthWidget } from "@/components/hq/ProjectHealthWidget";
import { ServiceLineWidget } from "@/components/hq/ServiceLineWidget";
import { ActivityFeed } from "@/components/hq/ActivityFeed";
import { FilterBar } from "@/components/filters/FilterBar";
import { AlertBanner } from "@/components/hq/AlertBanner";
import { DealSummaryStrip } from "@/components/hq/DealSummaryStrip";
import { useFilters } from "@/context/FilterContext";

function scaledKpis(factor: number) {
  return hqKpis.map(k => {
    const cur  = Math.round(k.currentNum * factor * 10) / 10;
    const tgt  = Math.round(k.targetNum  * factor * 10) / 10;
    const val  = k.unit === "M"  ? `฿${cur}M`
               : k.unit === "%" ? `${cur}%`
               : `${cur}`;
    const tgtLabel = k.unit === "M" ? `฿${tgt}M`
                   : k.unit === "%" ? `${tgt}%`
                   : k.targetLabel;
    return { ...k, currentNum: cur, targetNum: tgt, value: val, targetLabel: tgtLabel };
  });
}

export default function HQDashboardPage() {
  const { timeRange } = useFilters();
  const kpis = scaledKpis(timeRange.factor);

  const scaledSales = hqSalesByMonth.map(d => ({
    ...d,
    value:     Math.round(d.value     * timeRange.factor * 10) / 10,
    prevValue: d.prevValue ? Math.round(d.prevValue * timeRange.factor * 10) / 10 : undefined,
  }));

  return (
    <div className="erp space-y-4">
      {/* Page header */}
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>แดชบอร์ด HQ</h2>
          <p>สรุปภาพรวมทั้งเครือ · {timeRange.subtitle}</p>
        </div>
        <FilterBar dims={[]} />
      </div>

      {/* Alert banner */}
      <AlertBanner />

      {/* Deal summary strip */}
      <DealSummaryStrip />

      {/* KPI row */}
      <div className="stat-grid" style={{ marginBottom: 0 }}>
        {kpis.map((k) => (
          <KpiCard key={k.key} label={k.label} value={k.value} delta={k.delta} icon={k.icon}
            currentNum={k.currentNum} targetNum={k.targetNum} targetLabel={k.targetLabel} />
        ))}
      </div>

      {/* Revenue chart — full-width hero (matches reference layout) */}
      <LineChartCard
        data={scaledSales}
        title="ยอดขายรวมทั้งเครือ รายเดือน"
        subtitle="มูลค่าทุกสาขารวมกัน (ล้านบาท)"
        target={Math.round(22 * timeRange.factor * 10) / 10}
      />

      {/* Main content + right rail — balanced, no stretched voids */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5" style={{ alignItems: "start" }}>
        {/* Main column: action cards + service-line breakdown */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ alignItems: "start" }}>
            <LeadPoolWidget />
            <ProjectHealthWidget />
          </div>
          <ServiceLineWidget />
        </div>

        {/* Right rail: ranking + activity feed (both tall list cards) */}
        <div className="space-y-5">
          <LeaderboardCard />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
