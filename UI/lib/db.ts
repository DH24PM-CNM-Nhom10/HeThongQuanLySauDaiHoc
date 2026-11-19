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
    const all: StoredRecord[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const response = await fetch(`/api/${key}?limit=2000&page=${page}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Không tải được ${key} (HTTP ${response.status}).`);
      const result = await response.json();
      const records = Array.isArray(result) ? result : result.data;
      if (!Array.isArray(records)) throw new Error("Dữ liệu không hợp lệ.");
      all.push(...records.filter(isStoredRecord));
      totalPages = result.pagination?.totalPages ?? 1;
      page++;
    } while (page <= totalPages);
    try { this.set(key, all); } catch { this.remove(key); }
    return all;
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
