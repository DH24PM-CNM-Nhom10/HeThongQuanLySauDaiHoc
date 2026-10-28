"use client";

import { ENTITY_SCHEMAS } from "./schemas";

export type StoredRecord = Record<string, unknown>;

function isStoredRecord(value: unknown): value is StoredRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const DB = {
  get(key: string): StoredRecord[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("qldt_" + key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isStoredRecord) : [];
    } catch {
      return [];
    }
  },

  set(key: string, data: StoredRecord[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem("qldt_" + key, JSON.stringify(data));
  },

  async syncFromApi(key: string) {
    if (typeof window === "undefined") return [];
    try {
      const res = await fetch(`/api/${key}?limit=10000`);
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        return this.get(key);
      }

      // CHỈ đè dữ liệu vào LocalStorage nếu API trả về mảng CÓ DỮ LIỆU (> 0 bản ghi)
      if (isStoredRecord(json) && json.success === true && Array.isArray(json.data)) {
        const records = json.data.filter(isStoredRecord);
        if (records.length > 0) {
          this.set(key, records);
          return records;
        }
      }
    } catch (e) {
      console.error(`Lỗi đồng bộ ${key} từ API:`, e);
    }
    return this.get(key);
  },

  // TỰ ĐỘNG ĐỒNG BỘ TOÀN BỘ DANH MỤC TỪ SERVER VỀ LOCALSTORAGE
  async syncAllFromApi() {
    if (typeof window === "undefined") return;
    const keys = Object.keys(ENTITY_SCHEMAS);
    await Promise.all(keys.map((k) => this.syncFromApi(k)));
  },

  remove(key: string) {
    if (typeof window === "undefined") return;
    localStorage.removeItem("qldt_" + key);
  },

  clearAll() {
    if (typeof window === "undefined") return;
    Object.keys(ENTITY_SCHEMAS).forEach((k) =>
      localStorage.removeItem("qldt_" + k)
    );
    localStorage.removeItem("qldt_meta");
    localStorage.removeItem("qldt_custom_columns");
  },

  count(key: string): number {
    return this.get(key).length;
  },
};
