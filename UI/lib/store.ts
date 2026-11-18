import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";

const dbPath = path.join(process.cwd(), "db.json");

export function getStore(strict = false): Record<string, any[]> {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      if (!data.trim() && !strict) return { students: [], teachers: [] };
      const store = JSON.parse(data);
      if (!store || typeof store !== "object" || Array.isArray(store)) {
        throw new Error("Kho dữ liệu không hợp lệ");
      }
      return store;
    }
  } catch (error) {
    if (strict) throw error;
    console.error("Lỗi đọc db.json:", error);
  }
  return { students: [], teachers: [] };
}

// Export thêm alias memoryStore
export const memoryStore = getStore();

export function saveStoreToFile(store: Record<string, any[]>) {
  const temporaryPath = `${dbPath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(temporaryPath, dbPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}
