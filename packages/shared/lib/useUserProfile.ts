"use client";

// โปรไฟล์ของผู้ใช้ที่ล็อกอินอยู่ — ชื่อ/อีเมลติดต่อ/เบอร์/รูป
//
// เดิม loadUserProfile() อ่าน localStorage คีย์ bpms_profile_{dealerCode}:
//   • ผูกกับ "สาขา" ไม่ใช่ "คน" → ผู้ใช้หลายคนในสาขาเดียวกันเขียนทับโปรไฟล์กันเอง
//   • ล้างเบราว์เซอร์/ย้ายเครื่อง = ชื่อกับรูปหาย จอกลับไปแสดงอีเมลแทนชื่อ
// ตอนนี้อ่าน/เขียนผ่าน repository → โหมด supabase เก็บที่ตาราง profiles ผูกกับบัญชีผู้ใช้
import { useCallback, useEffect, useState } from "react";
import { logRepoRead } from "./repoLog";
import { profile as repo } from "./data";
import { useRole } from "@pms/shared/context/RoleContext";
import { defaultProfileEmail, PROFILE_UPDATED_EVENT, type UserProfile } from "./mock";
import { useAuthReady } from "./useAuthReady";

export type UseUserProfile = {
  profile: UserProfile;
  loaded: boolean;
  save: (p: UserProfile) => Promise<void>;
};

export function useUserProfile(): UseUserProfile {
  const ready = useAuthReady();   // ยังไม่ล็อกอิน = ห้ามยิงคำขอ (ดู useAuthReady.ts)
  const { session } = useRole();
  // ยังไม่มีโปรไฟล์บันทึกไว้ → ใช้ชื่อ/อีเมลจาก session ไปก่อน (ไม่ปล่อยให้ช่องว่างเปล่า)
  const fallback: UserProfile = {
    name: session.name,
    email: defaultProfileEmail(session.dealerCode),
    phone: "",
  };
  const [profile, setProfile] = useState<UserProfile>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const read = () => {
      repo.get()
        .then(p => { if (alive) { if (p) setProfile({ ...fallback, ...p }); setLoaded(true); } })
        .catch(e => { if (alive) logRepoRead("profile.get", e); });
    };
    read();
    window.addEventListener(PROFILE_UPDATED_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      alive = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, read);
      window.removeEventListener("storage", read);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session.dealerCode, session.name]);

  const save = useCallback(async (p: UserProfile) => {
    setProfile(p);
    await repo.save(p);
    try { window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT)); } catch {}
  }, []);

  return { profile, loaded, save };
}
