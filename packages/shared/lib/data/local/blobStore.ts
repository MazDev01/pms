// ไบต์จริงของไฟล์ในโหมด local (เดโม — ไม่ต่อฐานข้อมูล) เก็บไว้ใน IndexedDB ของเบราว์เซอร์ผู้ใช้เอง
//
// ทำไมต้อง IndexedDB: localStorage เก็บได้แต่ข้อความ และโควตาราว 5MB — เพดานอัปโหลดของระบบคือ
// 25MB ต่อไฟล์ (uploadLimits.ts) จึงยัดลง localStorage ไม่ได้ · IndexedDB เก็บ Blob ได้ตรง ๆ
//
// ⚠️ ไฟล์ชุดตัวอย่าง (DEFAULT_DEALER_FILES) ไม่มีไบต์จริงอยู่ที่ไหนเลย — จึงไม่มี storagePath
//    หน้าจอต้องไม่ขึ้นปุ่มเปิด/ดาวน์โหลดให้ไฟล์พวกนี้ ห้ามสร้างเนื้อไฟล์ปลอมขึ้นมาแทน

const DB_NAME  = "bpms-local-files";
const STORE    = "blobs";
const DB_VER   = 1;

// เบราว์เซอร์บางโหมด (private mode เก่า ๆ) หรือสภาพแวดล้อมทดสอบ (jsdom) ไม่มี indexedDB
// → คืน null ทุกฟังก์ชัน แล้วปล่อยให้หน้าจอทำตัวเหมือนโหมดที่ไม่มี Storage เหมือนเดิม
function openDB(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve(null);
    } catch { resolve(null); }
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDB().then(db => {
    if (!db) return null;
    return new Promise<T | null>(resolve => {
      try {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror   = () => resolve(null);
      } catch { resolve(null); }
    }).finally(() => db.close());
  });
}

// ตั้งชื่อพาธให้หน้าตาเหมือนฝั่ง Supabase Storage (dealerCode/ไฟล์) จะได้อ่านออกเวลาดูข้อมูลดิบ
// counter กันชื่อชนกันเมื่ออัปโหลดไฟล์ชื่อเดียวกันติด ๆ กันในวินาทีเดียว
let seq = 0;
function newPath(dealerCode: string, name: string): string {
  seq += 1;
  const safe = name.replace(/[^\w.\-ก-๙]+/g, "_");
  return `local/${dealerCode}/${Date.now()}-${seq}-${safe}`;
}

/** เก็บไบต์ → คืน storagePath (null = เบราว์เซอร์เก็บให้ไม่ได้ → บันทึกแค่ metadata เหมือนเดิม) */
export async function putLocalBlob(dealerCode: string, file: File): Promise<string | null> {
  const path = newPath(dealerCode, file.name);
  const saved = await tx<IDBValidKey>("readwrite", s => s.put(file, path));
  return saved === null ? null : path;
}

/** คืนลิงก์เปิด/ดาวน์โหลดไฟล์จริง (blob: URL) — null ถ้าไม่มีไบต์เก็บไว้ */
export async function localBlobUrl(path: string): Promise<string | null> {
  const blob = await tx<Blob>("readonly", s => s.get(path) as IDBRequest<Blob>);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function removeLocalBlob(path: string): Promise<void> {
  await tx<undefined>("readwrite", s => s.delete(path) as IDBRequest<undefined>);
}
