"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { DB } from "@/lib/db";
import { ENTITY_SCHEMAS } from "@/lib/schemas";

export default function UploadMapping() {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState("");
  const [headers, setHeaders] = useState<{ name: string; index: number }[]>([]);
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  const [allRows, setAllRows] = useState<any[][]>([]);
  const [selectedEntity, setSelectedEntity] = useState("students");
  const [mapping, setMapping] = useState<Record<string, number>>({});

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    const json = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    }) as any[][];
    if (json.length === 0) return;

    const headerRow = json[0];
    setHeaders(
      headerRow.map((h, i) => ({ name: String(h || `Cột ${i + 1}`), index: i }))
    );
    setPreviewRows(json.slice(1, 6));
    setAllRows(json.slice(1));
    setMapping({});
  };

  const handleSave = () => {
    const schema = ENTITY_SCHEMAS[selectedEntity];
    if (!schema) return;

    const mappedKeys = Object.keys(mapping);
    if (mappedKeys.length === 0) {
      alert("Vui lòng mapping ít nhất một cột!");
      return;
    }

    const records: any[] = [];
    allRows.forEach((row) => {
      const hasData = row.some(
        (c) => c !== null && c !== undefined && String(c).trim() !== ""
      );
      if (!hasData) return;

      const obj: any = {};
      mappedKeys.forEach((fieldKey) => {
        const colIdx = mapping[fieldKey];
        let val = row[colIdx];
        if (val === undefined || val === null) val = "";
        else val = String(val).trim();
        obj[fieldKey] = val;
      });
      if (Object.values(obj).some((v) => v !== "")) records.push(obj);
    });

    if (records.length === 0) {
      alert("Không có bản ghi hợp lệ.");
      return;
    }

    DB.set(selectedEntity, records);
    alert(`✅ Đã lưu ${records.length} bản ghi vào "${schema.label}"`);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">1. Chọn file Excel</div>
        <div
          className="upload-zone"
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <div className="upload-icon">📤</div>
          <p>Kéo thả hoặc click để chọn file .xlsx / .xls / .csv</p>
          <p className="hint">Dữ liệu sẽ được lưu vào localStorage</p>
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
            <div className="card-title">3. Chọn loại dữ liệu & Mapping</div>
            <div className="entity-tabs">
              {Object.keys(ENTITY_SCHEMAS).map((key) => (
                <button
                  key={key}
                  className={`entity-tab ${
                    selectedEntity === key ? "active" : ""
                  }`}
                  onClick={() => {
                    setSelectedEntity(key);
                    setMapping({});
                  }}
                >
                  {ENTITY_SCHEMAS[key].label}
                </button>
              ))}
            </div>

            <table className="mapping-table">
              <thead>
                <tr>
                  <th>Trường hệ thống</th>
                  <th>Cột Excel</th>
                </tr>
              </thead>
              <tbody>
                {ENTITY_SCHEMAS[selectedEntity].fields.map((field) => (
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
                💾 Lưu dữ liệu
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">4. Xem trước (5 dòng đầu)</div>
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
