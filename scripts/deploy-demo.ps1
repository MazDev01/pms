# ── อัปเว็บ demo ทั้งสองตัวขึ้นใหม่ (บอสรันเอง) ────────────────────────────────
#
# ทำไมต้องรันมือ: เว็บ demo ไม่ได้ผูกกับ GitHub เหมือนเว็บจริง (เว็บจริง push แล้วขึ้นเอง)
#   และคำสั่ง deploy ถูกบล็อกในเครื่องของผู้ช่วย จึงต้องให้เจ้าของเครื่องเป็นคนสั่ง
#
# วิธีใช้ — เปิด PowerShell ที่โฟลเดอร์โปรเจกต์แล้วพิมพ์:
#     powershell -ExecutionPolicy Bypass -File scripts\deploy-demo.ps1
#
# ⚠️ ไฟล์นี้ต้องบันทึกเป็น UTF-8 "แบบมี BOM" เท่านั้น
#    Windows PowerShell 5.1 อ่านไฟล์ที่ไม่มี BOM เป็นรหัสภาษาเครื่อง ตัวอักษรไทยจะเพี้ยนทั้งไฟล์
#    แล้วพังตั้งแต่บรรทัดแรก (เจอจริง 2 ก.ย. 69) — ชื่อตัวแปรจึงใช้อังกฤษล้วน ไทยเฉพาะข้อความ
#
# ⚠️ demo ทั้งสองตัวไม่มีคีย์ฐานข้อมูล (ตั้งใจ · บอสตัดสิน 24 ส.ค. 69)
#    จึงรันเป็นข้อมูลตัวอย่างในเครื่องคนดู ไม่แตะข้อมูลจริงแม้แต่นิดเดียว

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:VERCEL_ORG_ID = "team_AmIIuAi4uLHzKgDReFDaKqrG"

$targets = @(
  @{ name = "demo สำนักงานใหญ่ (pms-demo)";  id = "prj_AqShmJOemtNP7v0B5TU7HjOY5JVq"; url = "https://pms-demo-two.vercel.app" },
  @{ name = "demo ตัวแทน (pms-demo-dealer)"; id = "prj_tiI3ME7dobNChSXpRVGw6UruDPcO"; url = "https://pms-demo-dealer.vercel.app" }
)

foreach ($t in $targets) {
  Write-Host ""
  Write-Host "=== กำลังอัป $($t.name) ===" -ForegroundColor Cyan
  $env:VERCEL_PROJECT_ID = $t.id
  npx vercel --prod --yes
  if ($LASTEXITCODE -ne 0) {
    Write-Host "!! อัป $($t.name) ไม่สำเร็จ - หยุดไว้ตรงนี้ ยังไม่ได้ทำตัวถัดไป" -ForegroundColor Red
    exit 1
  }
  Write-Host "เสร็จ: $($t.url)" -ForegroundColor Green
}

Write-Host ""
Write-Host "อัป demo ครบทั้งสองตัวแล้ว - เปิดดูได้เลย:" -ForegroundColor Green
foreach ($t in $targets) { Write-Host "  $($t.url)" }
