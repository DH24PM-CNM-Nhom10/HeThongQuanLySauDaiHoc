import { readStore, saveStore } from "../../shared/system-store.cjs";
export function getStore(_strict = false): Record<string, any[]> { return readStore(); }
export const saveStoreToFile = saveStore;
// Tương thích các bản sao API cũ. Route đang sử dụng phải đọc lại bằng getStore().
export const memoryStore = readStore();
