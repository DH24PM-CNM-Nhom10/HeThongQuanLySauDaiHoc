import fs from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "db.json");

export function getStore(): Record<string, any[]> {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      return data.trim() ? JSON.parse(data) : { students: [], teachers: [] };
    }
  } catch (error) {
    console.error("Lỗi đọc db.json:", error);
  }
  return { students: [], teachers: [] };
}

// Export thêm alias memoryStore
export const memoryStore = getStore();

export function saveStoreToFile(store: Record<string, any[]>) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), "utf-8");
  } catch (error) {
    console.error("Lỗi ghi db.json:", error);
  }
}