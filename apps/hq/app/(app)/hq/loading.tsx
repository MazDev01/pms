export default function HQLoading() {
  return (
    <div className="erp" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 18 }}>
      <style>{`@keyframes hq-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "3.5px solid #e5e7eb",
          borderTopColor: "#003366",
          animation: "hq-spin 0.8s linear infinite",
        }}
      />
      <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280" }}>กำลังโหลดแดชบอร์ด HQ…</p>
    </div>
  );
}
