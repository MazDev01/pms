"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRole } from "@/context/RoleContext";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";

const CARD: React.CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5e7eb",
  boxShadow: "0 4px 24px rgba(0,0,0,.10)",
  overflow: "hidden",
};

const LABEL: React.CSSProperties = {
  fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D",
  display: "block", marginBottom: 6,
};

export default function DealerLoginPage() {
  const { login } = useRole();
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    border: `1px solid ${focused === field ? "#003366" : "#e5e7eb"}`,
    borderRadius: 12,
    background: "#f7f8fa",
    padding: "10px 14px 10px 36px",
    fontSize: "0.86rem",
    color: "#2D2D2D",
    outline: "none",
    boxShadow: focused === field ? "0 0 0 3px rgba(0,0,0,.12)" : "none",
    transition: "all .15s",
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      login("dealer");
      router.push("/dashboard");
    }, 700);
  };

  return (
    <div style={{ width: "100%", maxWidth: 380 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/benjamin-logo.png" alt="Benjamin Pre-Engineered Building"
          style={{ height: 52, objectFit: "contain", marginBottom: 16 }} />
        <p style={{ fontSize: "0.65rem", color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          ระบบบริหารงานขาย
        </p>
      </div>

      {/* Card */}
      <div style={CARD}>
        <div style={{ padding: "24px 28px 0 28px", marginBottom: 20 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "#2D2D2D" }}>เข้าสู่ระบบ — ตัวแทน</h2>
          <p style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 4 }}>
            สำหรับตัวแทนจำหน่ายทั่วประเทศ
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Email */}
          <div>
            <label style={LABEL}>อีเมล / รหัสผู้ใช้</label>
            <div style={{ position: "relative" }}>
              <Mail size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }} />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                placeholder="dealer@example.com"
                required
                style={inputStyle("email")}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={LABEL}>รหัสผ่าน</label>
            <div style={{ position: "relative" }}>
              <Lock size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }} />
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("pass")}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                required
                style={{ ...inputStyle("pass"), paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Forgot */}
          <div style={{ textAlign: "right", marginTop: -8 }}>
            <button type="button" onClick={() => alert("กรุณาติดต่อผู้ดูแลระบบ (HQ) เพื่อรีเซ็ตรหัสผ่าน\nอีเมล: support@benjamin.co.th")} style={{ fontSize: "0.72rem", color: "#003366", background: "none", border: "none", cursor: "pointer" }}>
              ลืมรหัสผ่าน?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 0",
              background: "#003366",
              color: "#fff", borderRadius: 12, border: "none",
              fontWeight: 700, fontSize: "0.86rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(0,0,0,.3)",
            }}
          >
            {loading
              ? <span className="animate-spin" style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
              : <><span>เข้าสู่ระบบ</span><ArrowRight size={15} /></>
            }
          </button>
        </form>
      </div>

      {/* Demo accounts */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          <span style={{ fontSize: "0.65rem", color: "#C0C0C0", fontWeight: 600, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Demo — เข้าระบบด่วน</span>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "ผู้ดูแลสำนักงานใหญ่", sub: "Benjamin HQ Management · admin@benjamin.com", role: "hq" as const, redirect: "/hq/dashboard", color: "#2D2D2D" },
            { label: "ตัวแทนเชียงใหม่", sub: "ตัวแทน CNX · cnx@dealer.com", role: "dealer" as const, redirect: "/dashboard", color: "#003366" },
            { label: "ตัวแทนระยอง สตีล", sub: "ตัวแทน RYG · ryg@dealer.com", role: "dealer" as const, redirect: "/dashboard", color: "#003366" },
            { label: "ตัวแทนเชียงราย เมทัล", sub: "ตัวแทน CRI · cri@dealer.com", role: "dealer" as const, redirect: "/dashboard", color: "#003366" },
          ].map((d, i) => (
            <button key={i} type="button"
              onClick={() => { login(d.role); router.push(d.redirect); }}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", cursor: "pointer", textAlign: "left", width: "100%" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C0C0C0"; (e.currentTarget as HTMLButtonElement).style.background = "#f8f9fb"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: d.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 800 }}>{d.role === "hq" ? "HQ" : "D"}</span>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D" }}>{d.label}</div>
                <div style={{ fontSize: "0.65rem", color: "#6b7280" }}>{d.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* HQ link */}
      <p style={{ textAlign: "center", fontSize: "0.72rem", color: "#6b7280", marginTop: 24 }}>
        เป็นทีม HQ?{" "}
        <Link href="/login/hq" style={{ color: "#003366", fontWeight: 700, textDecoration: "none" }}>
          เข้าสู่ระบบ HQ →
        </Link>
      </p>
      <p style={{ textAlign: "center", fontSize: "0.65rem", color: "#C0C0C0", marginTop: 12 }}>
        © 2569 Benjamin PEB Steel Co., Ltd.
      </p>
    </div>
  );
}
