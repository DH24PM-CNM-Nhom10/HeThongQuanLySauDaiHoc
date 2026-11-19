export function projectRoot(): string;
export function readStore(): Record<string, any[]>;
export function saveStore(store: Record<string, any[]>): void;
export function normalize(value: unknown): string;
export function studentCode(row: Record<string, any>): string;
export function studentStatus(row: Record<string, any>): string;
export type CatalogEntry = { id: string; kind: string; code: string; name?: string; majorCode?: string };
export function catalogFromStudents(students: Record<string, any>[], saved?: CatalogEntry[]): CatalogEntry[];
