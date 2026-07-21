// ย่อรูปก่อนเก็บลง localStorage — กัน QuotaExceededError (data URL ดิบของรูปใหญ่กิน quota ~5MB)
// คืน data URL ที่ย่อแล้ว: จำกัดด้านยาวสุด maxSize px · คงพื้นโปร่งใสถ้าเป็น PNG
export function fileToResizedDataURL(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(src); return; }
        ctx.drawImage(img, 0, 0, w, h);
        // PNG → คงพื้นโปร่งใส (โลโก้) · อื่นๆ → JPEG เพื่อขนาดเล็ก
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        try { resolve(canvas.toDataURL(type, quality)); }
        catch { resolve(src); }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
