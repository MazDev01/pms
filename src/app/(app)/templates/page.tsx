"use client";

import { TemplatesEditor } from "@/components/TemplatesEditor";

export default function TemplatesPage() {
  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>แม่แบบงาน</h2>
          <p>ชุดงานย่อยมาตรฐานสำหรับเริ่มโอกาสการขายใหม่ให้รวดเร็วและเป็นระบบ</p>
        </div>
      </div>
      <TemplatesEditor />
    </div>
  );
}
