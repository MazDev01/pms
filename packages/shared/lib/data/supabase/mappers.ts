// Row ↔ Type mapper — DB ใช้ snake_case (dealer_code, num_id) · type ในแอปใช้ camelCase (dealerCode, numId)
// แปลงเฉพาะ "คีย์ระดับบนสุด" (คอลัมน์) · ค่าใน jsonb (เช่น lineItems, tasks) ปล่อยผ่านคงรูปเดิม

function snakeToCamel(k: string): string {
  return k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
function camelToSnake(k: string): string {
  return k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

/** DB row (snake_case) → object (camelCase) — shallow */
export function toCamel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k in row) out[snakeToCamel(k)] = row[k];
  return out as T;
}

/** object (camelCase) → DB row (snake_case) — shallow */
export function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k in obj) out[camelToSnake(k)] = obj[k];
  return out;
}

export const toCamelList = <T>(rows: Record<string, unknown>[]): T[] => rows.map((r) => toCamel<T>(r));
export const toSnakeList = (objs: Record<string, unknown>[]): Record<string, unknown>[] => objs.map(toSnake);
