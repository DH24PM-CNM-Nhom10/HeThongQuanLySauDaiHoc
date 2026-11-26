export const CONTACT_FIELDS: string[];
export function studentCohort(row: Record<string, unknown>): string;
export function filterStudents<T extends Record<string, unknown>>(rows: T[], filters?: {search?: string; major?: string; cohort?: string; classCode?: string; status?: string}): T[];
export function validateContact(record: Record<string, unknown>, previous?: Record<string, unknown>): string | null;
export function expectedGraduation(admission: string, months: string | number): string;
