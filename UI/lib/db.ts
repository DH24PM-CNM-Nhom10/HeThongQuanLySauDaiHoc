"use client";

import { ENTITY_SCHEMAS } from "./schemas";

export const DB = {
  get(key: string): any[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("qldt_" + key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  set(key: string, data: any[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem("qldt_" + key, JSON.stringify(data));
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
