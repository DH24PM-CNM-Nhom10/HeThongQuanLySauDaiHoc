"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

declare global {
  interface Window {
    jspreadsheet: any;
  }
}

export default function SpreadsheetViewer() {
  const [fileName, setFileName] = useState("");
  const [showExport, setShowExport] = useState(false);
  const spreadsheetInstances = useRef<any[]>([]);
  const sheetNames = useRef<string[]>([]);

  useEffect(() => {
    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve(true);
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = reject;
        document.body.appendChild(script);
      });
    };

    Promise.all([
      loadScript("https://bossanova.uk/jspreadsheet/v4/jexcel.js"),
      loadScript("https://jsuites.net/v4/jsuites.js"),
    ]).then(() => {
      if (
        window.jspreadsheet &&
        document.getElementById("spreadsheet-default")
      ) {
        const defaultGrid = window.jspreadsheet(
          document.getElementById("spreadsheet-default"),
          {
            minDimensions: [15, 20],
            defaultColWidth: 120,
            tableOverflow: true,
            tableWidth: "100%",
            tableHeight: "550px",
            toolbar: getToolbar(),
          }
        );
        spreadsheetInstances.current = [defaultGrid];
        sheetNames.current = ["Sheet 1"];
      }
    });
  }, []);

  const getToolbar = () => [
    {
      type: "i",
      content: "undo",
      onclick: (el: any, obj: any) => obj.undo(),
    },
    {
      type: "i",
      content: "redo",
      onclick: (el: any, obj: any) => obj.redo(),
    },
    { type: "i", content: "format_bold", k: "font-weight", v: "bold" },
    { type: "i", content: "format_italic", k: "font-style", v: "italic" },
    {
      type: "i",
      content: "format_underlined",
      k: "text-decoration",
      v: "underline",
    },
    { type: "color", content: "format_color_text", k: "color" },
    {
      type: "color",
      content: "format_color_fill",
      k: "background-color",
    },
    {
      type: "i",
      content: "format_align_left",
      k: "text-align",
      v: "left",
    },
    {
      type: "i",
      content: "format_align_center",
      k: "text-align",
      v: "center",
    },
    {
      type: "i",
      content: "format_align_right",
      k: "text-align",
      v: "right",
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setFileName("");
      setShowExport(false);
      return;
    }

    setFileName(file.name);
    setShowExport(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });

      const contentDiv = document.getElementById("sheet-content");
      const tabsUl = document.getElementById("sheet-tabs");
      if (contentDiv) contentDiv.innerHTML = "";
      if (tabsUl) tabsUl.innerHTML = "";
      spreadsheetInstances.current = [];
      sheetNames.current = [];

      workbook.SheetNames.forEach((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];
        const excelData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        }) as any[][];

        const tabId = `tab-${index}`;
        const isActive = index === 0 ? " active" : "";
        const isShow = index === 0 ? " active show" : "";

        // Tab
        const li = document.createElement("li");
        li.className = "nav-item";
        const a = document.createElement("a");
        a.className = "nav-link" + isActive;
        a.href = `#${tabId}`;
        a.innerText = sheetName;
        a.onclick = (ev) => {
          ev.preventDefault();
          document.querySelectorAll(".tab-pane").forEach((p) => {
            p.classList.remove("active", "show");
          });
          document.getElementById(tabId)?.classList.add("active", "show");
          document.querySelectorAll("#sheet-tabs .nav-link").forEach((l) => {
            l.classList.remove("active");
          });
          a.classList.add("active");
          window.dispatchEvent(new Event("resize"));
        };
        li.appendChild(a);
        tabsUl?.appendChild(li);

        // Pane
        const pane = document.createElement("div");
        pane.className = "tab-pane p-0" + isShow;
        pane.id = tabId;

        const gridContainer = document.createElement("div");
        pane.appendChild(gridContainer);
        contentDiv?.appendChild(pane);

        let myGrid;
        if (excelData.length > 0) {
          myGrid = window.jspreadsheet(gridContainer, {
            data: excelData,
            defaultColWidth: 120,
            tableOverflow: true,
            tableWidth: "100%",
            tableHeight: "550px",
            colHeaders: excelData[0],
            toolbar: getToolbar(),
          });
          myGrid.deleteRow(0, 1);
        } else {
          myGrid = window.jspreadsheet(gridContainer, {
            minDimensions: [10, 15],
            defaultColWidth: 120,
            tableOverflow: true,
            tableWidth: "100%",
            tableHeight: "550px",
            toolbar: getToolbar(),
          });
        }

        spreadsheetInstances.current.push(myGrid);
        sheetNames.current.push(sheetName);
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    if (spreadsheetInstances.current.length === 0) return;

    const wb = XLSX.utils.book_new();

    spreadsheetInstances.current.forEach((instance, index) => {
      const sName = sheetNames.current[index] || `Sheet ${index + 1}`;
      const data = instance.getData();
      const headers = instance.getHeaders(true);
      const finalData = [headers].concat(data);
      const ws = XLSX.utils.aoa_to_sheet(finalData);
      XLSX.utils.book_append_sheet(wb, ws, sName);
    });

    const outName = fileName
      ? fileName.replace(/\.[^/.]+$/, "") + "_da_chinh_sua.xlsx"
      : "File_da_xuat.xlsx";

    XLSX.writeFile(wb, outName);
  };

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="card-title mb-0">{fileName}</h5>

        <div className="d-flex gap-2 align-items-center">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="form-control"
            style={{ maxWidth: "250px" }}
            onChange={handleFileChange}
          />

          {showExport && (
            <button
              onClick={handleExport}
              className="btn btn-success d-flex align-items-center gap-1"
            >
              <i
                className="material-icons"
                style={{ fontSize: "18px", lineHeight: 1 }}
              >
                save_alt
              </i>
              Xuất file
            </button>
          )}
        </div>
      </div>

      <div className="card-body p-0">
        <div id="sheet-content" className="tab-content">
          <div className="tab-pane active show p-0" id="default-sheet">
            <div id="spreadsheet-default"></div>
          </div>
        </div>

        <ul
          id="sheet-tabs"
          className="nav nav-tabs nav-tabs-bottom"
          role="tablist"
        >
          <li className="nav-item">
            <a className="nav-link active" href="#default-sheet">
              Sheet 1
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}