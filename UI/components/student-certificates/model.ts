export type CertificateKind = "language" | "informatics" | "other";
export type CertificateStatus = "draft" | "reviewing" | "supplement" | "recognized" | "rejected";

export const STATUS_LABELS: Record<CertificateStatus, string> = {
  draft: "Bản nháp",
  reviewing: "Đang xét duyệt",
  supplement: "Yêu cầu bổ sung",
  recognized: "Đã công nhận",
  rejected: "Không được công nhận",
};

export const CATEGORIES = [
  { key: "language" as const, title: "Ngoại ngữ", description: "Chứng chỉ và đơn đề nghị công nhận" },
  { key: "informatics" as const, title: "Tin học", description: "Văn bằng, chứng chỉ ứng dụng CNTT" },
  { key: "other" as const, title: "Khác", description: "Các văn bằng, chứng chỉ bổ sung" },
];

export type CertificateForm = {
  title: string; level: string; issuer: string; issuedAt: string; serial: string;
  fullName: string; birthDate: string; birthPlace: string; phone: string;
  studentCode: string; className: string; major: string; faculty: string;
  course: string; identityNumber: string; identityIssuedAt: string; note: string;
};

export type Attachment = { id: string; file: File; purpose: "certificate" | "application" };
export type CertificateRecord = {
  id: string; kind: CertificateKind; status: CertificateStatus;
  form: CertificateForm; attachments: Attachment[]; updatedAt: string;
};

export function categoryName(kind: CertificateKind) {
  return CATEGORIES.find(category => category.key === kind)!.title;
}

export function formatDate(value: string) {
  if (!value) return "Chưa bổ sung";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function inputDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const serial = Number(value);
  if (serial > 15000 && serial < 70000) {
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}

export function fileError(file: File): string | null {
  const types: Record<string, string[]> = {
    pdf: ["application/pdf"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"],
  };
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!types[extension] || (file.type && !types[extension].includes(file.type))) {
    return `${file.name}: chỉ nhận PDF, JPG hoặc PNG.`;
  }
  if (!file.size) return `${file.name}: tệp đang trống.`;
  if (file.size > 10 * 1024 * 1024) return `${file.name}: dung lượng vượt quá 10 MB.`;
  return null;
}

export function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type CertificateFilters = {
  kind: CertificateKind | "all";
  status: CertificateStatus | "all";
  from: string;
  to: string;
  search: string;
  order: "newest" | "oldest";
};

// Date filters use local calendar days, including both endpoints.
export function localDateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function queryCertificates(records: CertificateRecord[], filters: CertificateFilters, requestedPage: number, requestedSize: number) {
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const search = filters.search.trim().toLocaleLowerCase("vi-VN");
  const filtered = invalidRange ? [] : records.filter(record => {
    const day = localDateKey(record.updatedAt);
    return (filters.kind === "all" || record.kind === filters.kind)
      && (filters.status === "all" || record.status === filters.status)
      && (!filters.from || day >= filters.from)
      && (!filters.to || day <= filters.to)
      && (!search || (record.form.title + " " + record.form.serial).toLocaleLowerCase("vi-VN").includes(search));
  }).sort((a, b) => {
    const comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    return filters.order === "oldest" ? comparison : -comparison;
  });
  const pageSize = [5, 10, 20].includes(requestedSize) ? requestedSize : 5;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), totalPages);
  const offset = (page - 1) * pageSize;
  return { items: filtered.slice(offset, offset + pageSize), total: filtered.length, totalPages, page,
    start: filtered.length ? offset + 1 : 0, end: Math.min(offset + pageSize, filtered.length) };
}

// Prevent accidental resubmission while an equivalent certificate is under review
// or already recognized. A rejected certificate may be submitted again.
export function duplicateCertificate(records: CertificateRecord[], kind: CertificateKind, serial: string, editingId: string | null) {
  const normalize = (value: string) => value.replace(/\s+/g, "").toLocaleUpperCase("vi-VN");
  const key = normalize(serial);
  if (!key) return undefined;
  return records.find(record => record.id !== editingId && record.kind === kind
    && (record.status === "reviewing" || record.status === "recognized")
    && normalize(record.form.serial) === key);
}

export function attachmentsForKind(attachments: Attachment[], kind: CertificateKind) {
  return attachments.filter(attachment => attachment.purpose === "certificate" || kind === "language");
}
