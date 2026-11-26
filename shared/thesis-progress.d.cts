export const FIELDS: string[];
export function dateISO(value: unknown): string;
export function thesisValues(row: Record<string, unknown>): Record<string, string>;
export function thesisRow(row: Record<string, unknown>, today?: string): { code: string; name: string; classCode: string; major: string; fields: Record<string, string>; hasTitle: boolean; stage: string; inactive: boolean; deadline: string; overdue: boolean; daysOverdue: number | null };
