// UploadMapping.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { ENTITY_SCHEMAS } from "../../lib/schemas";
import { DB } from "../../lib/db";

const COLUMN_ALIASES: Record<string, string[]> = {
  // Giảng viên
  shcc: [
    "shcc",
    "ma_giang_vien",
    "magiangvien",
    "shcc_gv",
    "mã giảng viên / shcc",
    "mã gv",
    "mã giảng viên",
    "mã số",
    "mã cán bộ",
    "mã cb",
  ],
  hoten: [
    "hoten",
    "ho_ten",
    "ho_va_ten",
    "ten_giang_vien",
    "họ và tên",
    "họ tên gv",
    "họ tên",
    "tên giảng viên",
  ],
  gioitinh: ["gioitinh", "gioi_tinh", "giới tính", "nam/nữ", "phái"],
  t_dvi: [
    "t_dvi",
    "dvi.ten",
    "don_vi",
    "donvi",
    "ten_don_vi",
    "đơn vị / bộ môn",
    "đơn vị",
    "bộ môn",
    "khoa",
    "đơn vị công tác",
  ],
  t_tdcmon: [
    "t_tdcmon",
    "hoc_vi",
    "hocvi",
    "trinh_do_chuyen_mon",
    "học vị",
    "trình độ",
    "trình độ chuyên môn",
    "tđcm",
  ],
  t_hham: ["t_hham", "hoc_ham", "hocham", "học hàm"],
  t_cmdtao: [
    "t_cmdtao",
    "chuyen_mon",
    "chuyenmon",
    "chuyên môn",
    "chuyên ngành",
    "chuyên môn đào tạo",
  ],
  email: ["email", "thu_dientu", "địa chỉ email", "email cơ quan"],

  // Học viên & Luận văn
  cccd: ["cccd", "cmnd", "so_cccd", "cccd / cmnd", "số cccd", "số cmnd"],
  lop: ["lop", "ma_lop", "lớp", "lớp sinh hoạt", "mã lớp"],
  maHocVien: [
    "ma_hoc_vien",
    "mahocvien",
    "ma_hv",
    "mã học viên",
    "mã sinh viên",
    "masv",
    "mahv",
    "mã hv",
  ],
  hoTen: [
    "ho_ten",
    "hoten",
    "ho_va_ten",
    "ten_hoc_vien",
    "họ và tên",
    "họ tên học viên",
    "họ tên",
    "tác giả",
    "tac_gia",
  ],
  maNganh: ["ma_nganh", "manganh", "mã ngành"],
  tenNganh: ["ten_nganh", "tennganh", "tên ngành", "ngành học", "chuyên ngành"],
  loaiChuongTrinh: [
    "loai_chuong_trinh",
    "loaichuongtrinh",
    "loại chương trình",
    "hệ đào tạo",
  ],
  trinhDo: ["trinh_do_dt", "trinh_do", "trinhdo", "trình độ"],
  ngayNhapHoc: ["ngay_nhap_hoc", "ngaynhaphoc", "ngày nhập học"],
  trangThai: ["trang_thai", "trangthai", "trạng thái", "trạng thái học"],
  ngaySinh: ["ngay_sinh", "ngaysinh", "ngày sinh"],
  gioiTinh: ["gioi_tinh", "gioitinh", "giới tính"],

  // Trường Luận văn đầy đủ
  tenLuanVan: [
    "ten_luan_van",
    "tenluanvan",
    "tên luận văn",
    "tên đề tài",
    "nhan đề",
    "nhande",
    "ten_de_an",
    "tên đề án",
  ],
  gvHuongDan: [
    "nguoi_huong_dan_1",
    "gvhuongdan",
    "nguoi_huong_dan",
    "gv hướng dẫn",
    "cán bộ hướng dẫn",
    "giảng viên hướng dẫn",
  ],
  gvHuongDan1: [
    "nguoi_huong_dan_1",
    "gvhuongdan1",
    "nguoi_huong_dan",
    "gv hướng dẫn 1",
    "giảng viên hướng dẫn 1",
    "giảng viên hướng dẫn",
  ],
  gvHuongDan2: [
    "nguoi_huong_dan_2",
    "gvhuongdan2",
    "gv hướng dẫn 2",
    "giảng viên hướng dẫn 2",
  ],
  ngayQD: [
    "ngay_qd_luan_van_de_an",
    "ngay_qd_de_cuong",
    "ngay_qd",
    "ngày qđ đề cương",
    "ngày qđ luận văn",
    "so_qd_giao_de_tai",
  ],
  ngayQdDeCuong: [
    "ngay_qd_de_cuong",
    "ngay_qd_luan_van_de_an",
    "ngay_qd",
    "ngày qđ đề cương",
  ],
  trangThaiLv: [
    "trang_thai_luan_van_de_an",
    "trang_thai_lv",
    "trạng thái luận văn",
    "trạng thái đề tài",
  ],
  ngayBaoVe: [
    "ngay_bao_ve",
    "ngay_bao_ve_cap_truong",
    "ngày bảo vệ",
    "ngày bảo vệ cấp trường",
  ],
  ngayTotNghiep: [
    "ngay_tot_nghiep",
    "ngay_qdtn",
    "ngay_cong_nhan_tn",
    "ngày tốt nghiệp",
    "ngày qđtn",
  ],
  namXuatBan: ["nam_xuat_ban", "năm xuất bản", "nam_xb"],
};

interface UploadMappingProps {
  onSuccess?: (entityKey?: string) => void;
  studentsOnly?: boolean;
}

export default function UploadMapping({ onSuccess, studentsOnly = false }: UploadMappingProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState("");
  const [headers, setHeaders] = useState<{ name: string; index: number }[]>([]);
  const [allSheetRows, setAllSheetRows] = useState<any[][]>([]);
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  const [selectedEntity, setSelectedEntity] = useState("students");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [headerIndex, setHeaderIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const findHeaderRowIndex = (rows: any[][]): number => {
    if (!rows || rows.length === 0) return 0;
    const keywords = [
      "stt",
      "mã",
      "họ",
      "tên",
      "đơn vị",
      "học vị",
      "học hàm",
      "chuyên môn",
      "email",
      "shcc",
      "khoa",
      "ngành",
      "lớp",
      "cccd",
      "nhan đề",
      "tác giả",
      "giảng viên",
      "luận văn",
      "đề tài",
    ];
    let bestIdx = 0;
    let maxMatches = 0;

    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const rowStr = (rows[i] || [])
        .map((c) => String(c || "").toLowerCase())
        .join(" ");
      let matches = 0;
      keywords.forEach((kw) => {
        if (rowStr.includes(kw)) matches++;
      });
      if (matches > maxMatches) {
        maxMatches = matches;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  const autoMapFields = (
    headerList: { name: string; index: number }[],
    entity: string
  ) => {
    const schema = ENTITY_SCHEMAS[entity];
    if (!schema) return {};

    const newMap: Record<string, number> = {};
    schema.fields.forEach((field) => {
      const fieldKeyLower = field.key.toLowerCase();
      const fieldLabelLower = field.label.toLowerCase();
      const aliases = COLUMN_ALIASES[field.key] || [];

      const match = headerList.find((h) => {
        const hName = h.name.toLowerCase();
        return (
          hName === fieldKeyLower ||
          hName === fieldLabelLower ||
          aliases.some(
            (alias) =>
              hName === alias.toLowerCase() ||
              hName.includes(alias.toLowerCase())
          )
        );
      });

      if (match) {
        newMap[field.key] = match.index;
      }
    });

    return newMap;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      let wb: XLSX.WorkBook;
      if (isCsv) {
        // CSV: đọc UTF-8 để tiêu đề tiếng Việt không bị lỗi mã hóa
        const text = (evt.target?.result as string) || "";
        wb = XLSX.read(text, { type: "string", codepage: 65001, raw: false });
      } else {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        wb = XLSX.read(data, { type: "array" });
      }
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      const studentSheet = wb.SheetNames.find((name) => /^(hocvien|học viên|students)$/i.test(name.trim()));
      loadSheet(wb, studentsOnly && studentSheet ? studentSheet : wb.SheetNames[0]);
    };

    if (isCsv) {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const loadSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    setCurrentSheet(sheetName);
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    }) as any[][];
    if (json.length === 0) {
      setHeaders([]);
      setMapping({});
      setAllSheetRows([]);
      setPreviewRows([]);
      return;
    }

    const headerIdx = findHeaderRowIndex(json);
    setHeaderIndex(headerIdx);
    const headerRow = json[headerIdx] || [];

    const formattedHeaders = headerRow.map((h, i) => ({
      name: String(h || `Cột ${i + 1}`).trim(),
      index: i,
    }));

    setHeaders(formattedHeaders);
    setAllSheetRows(json.slice(headerIdx + 1));
    setPreviewRows(json.slice(headerIdx + 1, headerIdx + 6));

    let detectedEntity = selectedEntity;
    const lowerSheet = sheetName.toLowerCase();
    if (
      lowerSheet.includes("giảng viên") ||
      lowerSheet.includes("giang vien") ||
      lowerSheet.includes("teacher")
    ) {
      detectedEntity = "teachers";
    } else if (
      lowerSheet.includes("luận văn") ||
      lowerSheet.includes("luan van") ||
      lowerSheet.includes("thesis")
    ) {
      detectedEntity = "thesis";
    } else if (
      lowerSheet.includes("học viên") ||
      lowerSheet.includes("hoc vien") ||
      lowerSheet.includes("student") ||
      lowerSheet.includes("hocvien")
    ) {
      detectedEntity = "students";
    }

    const entity = studentsOnly ? "students" : detectedEntity;
    setSelectedEntity(entity);
    const initialMap = autoMapFields(formattedHeaders, entity);
    setMapping(initialMap);
  };

  const handleEntityChange = (entityKey: string) => {
    setSelectedEntity(entityKey);
    const autoMap = autoMapFields(headers, entityKey);
    setMapping(autoMap);
  };

  const handleSave = async () => {
    if (saving) return;
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    const file = selectedFile || fileInput?.files?.[0];

    if (!file) {
      alert("⚠️ Vui lòng chọn file Excel trước khi lưu!");
      return;
    }


    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityKey", selectedEntity);
    formData.append("sheetName", currentSheet);
    formData.append("mapping", JSON.stringify(mapping));
    formData.append("headerIndex", String(headerIndex));

    setSaving(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      let result: any = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        console.warn("API /api/upload không trả JSON:", text?.slice(0, 120));
        result = null;
      }

      if (!res.ok || !result?.success || !Array.isArray(result.data)) {
        alert(result?.error || "Không thể nhập dữ liệu.");
        return;
      }
      try { DB.set(selectedEntity, result.data); }
      catch { DB.remove(selectedEntity); }
      alert(`Đã thêm ${result.added ?? result.count} hồ sơ. Bỏ qua ${result.duplicates ?? 0} bản trùng và ${result.missingCode ?? 0} dòng thiếu mã.`);
      onSuccess?.(selectedEntity);
    } catch (error) {
      console.error(error);
      alert("Không xác nhận được kết quả nhập dữ liệu. Hãy tải lại danh sách trước khi thử lại.");

    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: "#64748b" }}>
          Tải lên file Excel và cấu hình khớp cột
        </span>
      </div>

      <div className="card">
        <div className="card-title">1. Chọn file Excel</div>
        <div
          className="upload-zone"
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <div className="upload-icon">📤</div>
          <p>
            {selectedFile
              ? `📄 File đã chọn: ${selectedFile.name}`
              : "Kéo thả hoặc click để chọn file .xlsx / .xls / .csv"}
          </p>
        </div>
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>

      {sheetNames.length > 0 && (
        <div className="card">
          <div className="card-title">2. Chọn Sheet</div>
          <div className="sheet-list">
            {sheetNames.map((name) => (
              <button
                key={name}
                className={`sheet-chip ${
                  currentSheet === name ? "active" : ""
                }`}
                onClick={() => workbook && loadSheet(workbook, name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {headers.length > 0 && (
        <>
          <div className="card">
            <div className="card-title">
              3. Chọn loại dữ liệu (Đang chọn:{" "}
              <span style={{ color: "#2563eb", fontWeight: 700 }}>
                {ENTITY_SCHEMAS[selectedEntity]?.label}
              </span>
              )
            </div>
            <div className="entity-tabs">
              {(studentsOnly ? ["students"] : Object.keys(ENTITY_SCHEMAS)).map((key) => (
                <button
                  key={key}
                  className={`entity-tab ${
                    selectedEntity === key ? "active" : ""
                  }`}
                  onClick={() => handleEntityChange(key)}
                >
                  {ENTITY_SCHEMAS[key].label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Đang lưu..." : `Lưu dữ liệu [${ENTITY_SCHEMAS[selectedEntity]?.label}]`}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">4. Xem trước (5 dòng dữ liệu đầu)</div>
            <div className="preview-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h.index}>{h.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {headers.map((h) => (
                        <td key={h.index}>{row[h.index] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
