"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRole } from "@pms/shared/context/RoleContext";
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, ChevronLeft } from "lucide-react";

const LABEL: React.CSSProperties = {
  fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D",
  display: "block", marginBottom: 6,
};

export default function HQLoginPage() {
  const { login, signIn } = useRole();
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    border: `1px solid ${focused === field ? "#2D2D2D" : "#e5e7eb"}`,
    borderRadius: 12,
    background: "#f7f8fa",
    padding: "10px 14px 10px 36px",
    fontSize: "0.86rem",
    color: "#2D2D2D",
    outline: "none",
    boxShadow: focused === field ? "0 0 0 3px rgba(45,45,45,.12)" : "none",
    transition: "all .15s",
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setTimeout(() => {
      const r = signIn(email, password);
      if (r.ok) router.push(r.session.scopeAll ? "/hq/dashboard" : "/dashboard");
      else { setError(r.error); setLoading(false); }
    }, 500);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ width: "100%", maxWidth: 380 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/benjamin-logo.png" alt="Benjamin Pre-Engineered Building"
          style={{ height: 52, objectFit: "contain", marginBottom: 16 }} />
        <p style={{ fontSize: "0.65rem", color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          ระบบบริหารสำนักงานใหญ่
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: "#fff",
        borderRadius: 20,
        border: "1px solid #e5e7eb",
        boxShadow: "0 4px 24px rgba(45,45,45,.10)",
        overflow: "hidden",
      }}>
        {/* HQ header stripe */}
        <div style={{
          background: "#2D2D2D",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <ShieldCheck size={18} color="#C0C0C0" />
          <div>
            <p style={{ fontSize: "0.72rem", fontWeight: 800, color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              HQ — สำนักงานใหญ่
            </p>
            <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.45)", marginTop: 2 }}>
เข้าถึงจำกัด · เฉพาะผู้มีสิทธิ์เท่านั้น
            </p>
          </div>
        </div>

        <div style={{ padding: "24px 28px 0 28px", marginBottom: 20 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "#2D2D2D" }}>เข้าสู่ระบบ HQ</h2>
          <p style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 4 }}>
            สำหรับทีมงานสำนักงานใหญ่เท่านั้น
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Email */}
          <div>
            <label style={LABEL}>อีเมลองค์กร</label>
            <div style={{ position: "relative" }}>
              <Mail size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#6b7280", pointerEvents: "none" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                placeholder="name@benjaminpebsteel.com"
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
            <button type="button" onClick={() => alert("กรุณาติดต่อฝ่ายไอทีของ Benjamin เพื่อรีเซ็ตรหัสผ่าน\nอีเมล: it@benjamin.co.th")} style={{ fontSize: "0.72rem", color: "#2D2D2D", background: "none", border: "none", cursor: "pointer" }}>
              ลืมรหัสผ่าน?
            </button>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "9px 12px", fontSize: "0.76rem", fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 0",
              background: "#2D2D2D",
              color: "#fff", borderRadius: 12, border: "none",
              fontWeight: 700, fontSize: "0.86rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(45,45,45,.25)",
            }}
          >
            {loading
              ? <span className="animate-spin" style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />
              : <><span>เข้าสู่ระบบ HQ</span><ArrowRight size={15} /></>
            }
          </button>
        </form>
      </div>

      {/* Demo HQ account */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          <span style={{ fontSize: "0.65rem", color: "#C0C0C0", fontWeight: 600, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Demo — เข้าระบบด่วน</span>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        </div>
        <button type="button"
          onClick={() => { login("hq"); router.push("/hq/dashboard"); }}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", cursor: "pointer", textAlign: "left", width: "100%" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C0C0C0"; (e.currentTarget as HTMLButtonElement).style.background = "#f8f9fb"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#2D2D2D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#C0C0C0", fontSize: "0.65rem", fontWeight: 800 }}>HQ</span>
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D" }}>ผู้ดูแลสำนักงานใหญ่</div>
            <div style={{ fontSize: "0.65rem", color: "#6b7280" }}>Benjamin HQ Management · admin@benjamin.com</div>
          </div>
        </button>
      </div>

      {/* Demo password hint */}
      <p style={{ textAlign: "center", fontSize: "0.65rem", color: "#9ca3af", marginTop: 10 }}>
        ล็อกอินเอง: <b style={{ color: "#6b7280" }}>admin@benjamin.com</b> + รหัส demo <b style={{ color: "#6b7280" }}>benjamin</b>
      </p>

      {/* Back to dealer */}
      <p style={{ textAlign: "center", marginTop: 24 }}>
        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "#6b7280", textDecoration: "none" }}>
          <ChevronLeft size={13} /> กลับไปหน้าเข้าสู่ระบบตัวแทน
        </Link>
      </p>
      <p style={{ textAlign: "center", fontSize: "0.65rem", color: "#C0C0C0", marginTop: 12 }}>
        © 2569 Benjamin PEB Steel Co., Ltd.
      </p>
    </div>
    </div>
  );
}
