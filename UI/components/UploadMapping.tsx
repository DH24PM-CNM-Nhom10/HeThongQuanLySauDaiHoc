// UploadMapping.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { ENTITY_SCHEMAS } from "../lib/schemas";
import { DB } from "../lib/db";

const COLUMN_ALIASES: Record<string, string[]> = {
  // Giảng viên
  shcc: ["shcc", "ma_giang_vien", "magiangvien", "shcc_gv", "mã giảng viên / shcc", "mã gv", "mã giảng viên", "mã số", "mã cán bộ", "mã cb"],
  hoten: ["hoten", "ho_ten", "ho_va_ten", "ten_giang_vien", "họ và tên", "họ tên gv", "họ tên", "tên giảng viên"],
  gioitinh: ["gioitinh", "gioi_tinh", "giới tính", "nam/nữ", "phái"],
  t_dvi: ["t_dvi", "dvi.ten", "don_vi", "donvi", "ten_don_vi", "đơn vị / bộ môn", "đơn vị", "bộ môn", "khoa", "đơn vị công tác"],
  t_tdcmon: ["t_tdcmon", "hoc_vi", "hocvi", "trinh_do_chuyen_mon", "học vị", "trình độ", "trình độ chuyên môn", "tđcm"],
  t_hham: ["t_hham", "hoc_ham", "hocham", "học hàm"],
  t_cmdtao: ["t_cmdtao", "chuyen_mon", "chuyenmon", "chuyên môn", "chuyên ngành", "chuyên môn đào tạo"],
  email: ["email", "thu_dientu", "địa chỉ email", "email cơ quan"],

  // Học viên & Luận văn
  cccd: ["cccd", "cmnd", "so_cccd", "cccd / cmnd", "số cccd", "số cmnd"],
  lop: ["lop", "ma_lop", "lớp", "lớp sinh hoạt", "mã lớp"],
  maHocVien: ["ma_hoc_vien", "mahocvien", "ma_hv", "mã học viên", "mã sinh viên", "masv", "mahv", "mã hv"],
  hoTen: ["ho_ten", "hoten", "ho_va_ten", "ten_hoc_vien", "họ và tên", "họ tên học viên", "họ tên", "tác giả", "tac_gia"],
  maNganh: ["ma_nganh", "manganh", "mã ngành"],
  tenNganh: ["ten_nganh", "tennganh", "tên ngành", "ngành học", "chuyên ngành"],
  loaiChuongTrinh: ["loai_chuong_trinh", "loaichuongtrinh", "loại chương trình", "hệ đào tạo"],
  trinhDo: ["trinh_do_dt", "trinh_do", "trinhdo", "trình độ"],
  ngayNhapHoc: ["ngay_nhap_hoc", "ngaynhaphoc", "ngày nhập học"],
  trangThai: ["trang_thai", "trangthai", "trạng thái", "trạng thái học"],
  ngaySinh: ["ngay_sinh", "ngaysinh", "ngày sinh"],
  gioiTinh: ["gioi_tinh", "gioitinh", "giới tính"],

  // Trường Luận văn đầy đủ
  tenLuanVan: ["ten_luan_van", "tenluanvan", "tên luận văn", "tên đề tài", "nhan đề", "nhande", "ten_de_an", "tên đề án"],
  gvHuongDan: ["nguoi_huong_dan_1", "gvhuongdan", "nguoi_huong_dan", "gv hướng dẫn", "cán bộ hướng dẫn", "giảng viên hướng dẫn"],
  gvHuongDan1: ["nguoi_huong_dan_1", "gvhuongdan1", "nguoi_huong_dan", "gv hướng dẫn 1", "giảng viên hướng dẫn 1", "giảng viên hướng dẫn"],
  gvHuongDan2: ["nguoi_huong_dan_2", "gvhuongdan2", "gv hướng dẫn 2", "giảng viên hướng dẫn 2"],
  ngayQD: ["ngay_qd_luan_van_de_an", "ngay_qd_de_cuong", "ngay_qd", "ngày qđ đề cương", "ngày qđ luận văn", "so_qd_giao_de_tai"],
  ngayQdDeCuong: ["ngay_qd_de_cuong", "ngay_qd_luan_van_de_an", "ngay_qd", "ngày qđ đề cương"],
  trangThaiLv: ["trang_thai_luan_van_de_an", "trang_thai_lv", "trạng thái luận văn", "trạng thái đề tài"],
  ngayBaoVe: ["ngay_bao_ve", "ngay_bao_ve_cap_truong", "ngày bảo vệ", "ngày bảo vệ cấp trường"],
  ngayTotNghiep: ["ngay_tot_nghiep", "ngay_qdtn", "ngay_cong_nhan_tn", "ngày tốt nghiệp", "ngày qđtn"],
  namXuatBan: ["nam_xuat_ban", "năm xuất bản", "nam_xb"]
};

interface UploadMappingProps {
  onSuccess?: (entityKey?: string) => void;
}

export default function UploadMapping({ onSuccess }: UploadMappingProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState("");
  const [headers, setHeaders] = useState<{ name: string; index: number }[]>([]);
  const [allSheetRows, setAllSheetRows] = useState<any[][]>([]);
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  const [selectedEntity, setSelectedEntity] = useState("students");
  const [mapping, setMapping] = useState<Record<string, number>>({});

  const handleResetData = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ dữ liệu để test lại từ đầu?")) {
      return;
    }

    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const json = await res.json();

      if (json.success) {
        DB.clearAll();
        alert("✅ Đã reset toàn bộ dữ liệu! Bạn có thể bắt đầu upload file mới.");
        window.location.reload();
      } else {
        alert("❌ Lỗi khi reset: " + (json.error || "Không xác định"));
      }
    } catch (err) {
      DB.clearAll();
      alert("✅ Đã làm sạch dữ liệu LocalStorage!");
      window.location.reload();
    }
  };

  const findHeaderRowIndex = (rows: any[][]): number => {
    if (!rows || rows.length === 0) return 0;
    const keywords = [
      "stt", "mã", "họ", "tên", "đơn vị", "học vị", "học hàm", "chuyên môn", "email",
      "shcc", "khoa", "ngành", "lớp", "cccd", "nhan đề", "tác giả", "giảng viên", "luận văn", "đề tài"
    ];
    let bestIdx = 0;
    let maxMatches = 0;

    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const rowStr = (rows[i] || []).map((c) => String(c || "").toLowerCase()).join(" ");
      let matches = 0;
      keywords.forEach((kw) => { if (rowStr.includes(kw)) matches++; });
      if (matches > maxMatches) {
        maxMatches = matches;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  const autoMapFields = (headerList: { name: string; index: number }[], entity: string) => {
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
          aliases.some((alias) => hName === alias.toLowerCase() || hName.includes(alias.toLowerCase()))
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
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      loadSheet(wb, wb.SheetNames[0]);
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    setCurrentSheet(sheetName);
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    if (json.length === 0) return;

    const headerIdx = findHeaderRowIndex(json);
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
    if (lowerSheet.includes("giảng viên") || lowerSheet.includes("giang vien") || lowerSheet.includes("teacher")) {
      detectedEntity = "teachers";
    } else if (lowerSheet.includes("luận văn") || lowerSheet.includes("luan van") || lowerSheet.includes("thesis")) {
      detectedEntity = "thesis";
    } else if (lowerSheet.includes("học viên") || lowerSheet.includes("hoc vien") || lowerSheet.includes("student") || lowerSheet.includes("hocvien")) {
      detectedEntity = "students";
    }
    
    setSelectedEntity(detectedEntity);
    const initialMap = autoMapFields(formattedHeaders, detectedEntity);
    setMapping(initialMap);
  };

  const handleEntityChange = (entityKey: string) => {
    setSelectedEntity(entityKey);
    const autoMap = autoMapFields(headers, entityKey);
    setMapping(autoMap);
  };

  // Tạo sẵn dữ liệu từ Client để dự phòng lưu trực tiếp vào LocalStorage
  const buildClientMappedData = () => {
    if (!allSheetRows || allSheetRows.length === 0) return [];
    
    return allSheetRows
      .filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ""))
      .map((row, idx) => {
        const item: Record<string, any> = { id: `item_${Date.now()}_${idx}` };
        Object.entries(mapping).forEach(([fieldKey, colIdx]) => {
          if (colIdx !== undefined && colIdx !== null && row[colIdx] !== undefined) {
            item[fieldKey] = row[colIdx];
          }
        });
        return item;
      });
  };

  const handleSave = async () => {
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    const file = selectedFile || fileInput?.files?.[0];

    if (!file) {
      alert("⚠️ Vui lòng chọn file Excel trước khi lưu!");
      return;
    }

    const clientMappedData = buildClientMappedData();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityKey", selectedEntity);
    formData.append("sheetName", currentSheet);
    formData.append("mapping", JSON.stringify(mapping));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();

      let finalDataToSave: any[] = [];

      if (result && result.success) {
        if (Array.isArray(result.data) && result.data.length > 0) {
          finalDataToSave = result.data;
        } else if (Array.isArray(result) && result.length > 0) {
          finalDataToSave = result;
        } else if (Array.isArray(result.records) && result.records.length > 0) {
          finalDataToSave = result.records;
        } else {
          finalDataToSave = clientMappedData;
        }
      } else {
        console.warn("Server API không trả lại danh sách, sử dụng dữ liệu bóc tách từ Client:", result?.error);
        finalDataToSave = clientMappedData;
      }

      // Lưu AN TOÀN vào LocalStorage (Đảm bảo luôn là Mảng hợp lệ)
      if (finalDataToSave.length > 0) {
        DB.set(selectedEntity, finalDataToSave);
      }
      const entityLabel = ENTITY_SCHEMAS[selectedEntity]?.label || selectedEntity;
      const totalCount = finalDataToSave.length || result?.count || result?.inserted || 0;

      alert(`✅ Đã lưu thành công ${totalCount} bản ghi đầy đủ vào [${entityLabel}]!`);

      if (onSuccess) {
        onSuccess(selectedEntity);
      }
    } catch (err) {
      console.error("Không thể kết nối Server API, tự động lưu dữ liệu vào LocalStorage:", err);
      if (clientMappedData.length > 0) {
        DB.set(selectedEntity, clientMappedData);
        const entityLabel = ENTITY_SCHEMAS[selectedEntity]?.label || selectedEntity;
        alert(`✅ Đã lưu ngoại tuyến ${clientMappedData.length} bản ghi vào [${entityLabel}] (Dữ liệu LocalStorage)!`);
        if (onSuccess) onSuccess(selectedEntity);
      } else {
        alert("❌ Lỗi khi đọc dữ liệu file Excel. Vui lòng kiểm tra lại file!");
      }
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: "#64748b" }}>Tải lên file Excel và cấu hình khớp cột</span>
        <button
          onClick={handleResetData}
          style={{
            padding: "8px 14px",
            backgroundColor: "#ef4444",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          🗑️ Reset dữ liệu để test lại
        </button>
      </div>

      <div className="card">
        <div className="card-title">1. Chọn file Excel</div>
        <div className="upload-zone" onClick={() => document.getElementById("file-input")?.click()}>
          <div className="upload-icon">📤</div>
          <p>{selectedFile ? `📄 File đã chọn: ${selectedFile.name}` : "Kéo thả hoặc click để chọn file .xlsx / .xls / .csv"}</p>
        </div>
        <input id="file-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: "none" }} />
      </div>

      {sheetNames.length > 0 && (
        <div className="card">
          <div className="card-title">2. Chọn Sheet</div>
          <div className="sheet-list">
            {sheetNames.map((name) => (
              <button
                key={name}
                className={`sheet-chip ${currentSheet === name ? "active" : ""}`}
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
              3. Tự động Mapping (Đang chọn: <span style={{ color: "#2563eb", fontWeight: 700 }}>{ENTITY_SCHEMAS[selectedEntity]?.label}</span>)
            </div>
            <div className="entity-tabs">
              {Object.keys(ENTITY_SCHEMAS).map((key) => (
                <button
                  key={key}
                  className={`entity-tab ${selectedEntity === key ? "active" : ""}`}
                  onClick={() => handleEntityChange(key)}
                >
                  {ENTITY_SCHEMAS[key].label}
                </button>
              ))}
            </div>

            <table className="mapping-table">
              <thead>
                <tr>
                  <th>Trường hệ thống ({ENTITY_SCHEMAS[selectedEntity]?.label})</th>
                  <th>Cột khớp trong Excel</th>
                </tr>
              </thead>
              <tbody>
                {ENTITY_SCHEMAS[selectedEntity]?.fields.map((field) => (
                  <tr key={field.key}>
                    <td>{field.label}</td>
                    <td>
                      <select
                        className="map-select"
                        value={mapping[field.key] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMapping((prev) => {
                            const next = { ...prev };
                            if (val === "") delete next[field.key];
                            else next[field.key] = Number(val);
                            return next;
                          });
                        }}
                      >
                        <option value="">-- Không map --</option>
                        {headers.map((h) => (
                          <option key={h.index} value={h.index}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSave}>
                💾 Lưu dữ liệu [{ENTITY_SCHEMAS[selectedEntity]?.label}]
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