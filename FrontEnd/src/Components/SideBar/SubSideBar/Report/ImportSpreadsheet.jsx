import { useMemo, useState } from "react";
import { AlertCircle, Check, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import { getApiError, reportApi } from "./reportApi";
import "./Reports.css";

const IMPORT_FIELDS = [
  ["report_date", "Date"],
  ["title", "Report title"],
  ["employee", "Employee"],
  ["project", "Project"],
  ["sprint", "Sprint"],
  ["task", "Task"],
  ["activity", "Activity"],
  ["work_completed", "Work completed"],
  ["status", "Status"],
  ["progress", "Progress"],
  ["blockers", "Blockers"],
  ["next_steps", "Next steps"],
];

const HEADER_ALIASES = {
  report_date: ["date", "report date", "day", "created date"],
  title: ["title", "report title", "name"],
  employee: ["employee", "user", "owner", "assignee", "author"],
  project: ["project", "project name"],
  sprint: ["sprint", "sprint name"],
  task: ["task", "task name", "issue"],
  activity: ["activity", "description", "update", "comment"],
  work_completed: ["work completed", "completed", "done", "eod", "eod comments"],
  status: ["status", "state"],
  progress: ["progress", "percent complete"],
  blockers: ["blockers", "blocker", "impediments"],
  next_steps: ["next steps", "next step", "pending", "pending work"],
};

const normalizeHeader = (value) => String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

function guessMappings(headers) {
  return Object.fromEntries(IMPORT_FIELDS.map(([field]) => {
    const index = headers.findIndex((header) => HEADER_ALIASES[field]?.includes(normalizeHeader(header)));
    return [field, index < 0 ? "" : headers[index]];
  }));
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

function makePayload(row, mappings, index) {
  const payload = {};
  IMPORT_FIELDS.forEach(([field]) => {
    const header = mappings[field];
    if (header) payload[field] = row[header] === undefined ? "" : String(row[header]).trim();
  });
  payload.report_date = normalizeDate(row[mappings.report_date]);
  payload.title = payload.title || payload.activity || payload.task || payload.work_completed || "";
  payload.report_type = "daily";
  payload.source_data = { ...row, _spreadsheet_row: index + 2 };
  if (payload.progress !== undefined && payload.progress !== "") {
    const progress = Number(payload.progress.replace("%", ""));
    payload.progress = Number.isFinite(progress) ? progress : payload.progress;
  } else {
    delete payload.progress;
  }
  return payload;
}

export default function ImportSpreadsheet({ onClose, onImported, options }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mappings, setMappings] = useState({});
  const [edits, setEdits] = useState({});
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const previewRows = useMemo(
    () => rawRows.map((row, index) => ({ ...makePayload(row, mappings, index), ...(edits[index] || {}) })),
    [rawRows, mappings, edits],
  );

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    setError("");
    setResult(null);
    setHeaders([]);
    setRawRows([]);
    setEdits({});
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError("Choose an Excel (.xlsx or .xls) or CSV file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("The spreadsheet must be smaller than 15 MB.");
      return;
    }
    try {
      const { headers: columnHeaders, rows: populatedRows } = await reportApi.previewSpreadsheet(file);
      setFileName(file.name);
      setHeaders(columnHeaders);
      setRawRows(populatedRows);
      setMappings(guessMappings(columnHeaders));
    } catch (fileError) {
      setError(fileError.message || "Unable to read this spreadsheet.");
    }
    event.target.value = "";
  };

  const updateCell = (index, field, value) => {
    setEdits((previous) => ({
      ...previous,
      [index]: { ...(previous[index] || {}), [field]: value },
    }));
  };

  const submitImport = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await onImported(previewRows.map((row) => {
        const findId = (collection, name) => options[collection]?.find((option) => option.name.toLowerCase() === String(name || "").toLowerCase())?.id || "";
        return {
          ...row,
          project_id: row.project_id || findId("projects", row.project),
          sprint_id: row.sprint_id || findId("sprints", row.sprint),
          employee_id: row.employee_id || findId("employees", row.employee),
        };
      }));
      setResult(response);
      if (!response.errors?.length) onClose();
    } catch (uploadError) {
      setError(getApiError(uploadError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reports-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="reports-import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="reports-modal-header">
          <div>
            <h2 id="import-title">Import spreadsheet</h2>
            <p>Review the rows and map spreadsheet headers before saving them.</p>
          </div>
          <button type="button" className="reports-icon-button" aria-label="Close import dialog" onClick={onClose}><X size={18} /></button>
        </div>

        <label className="reports-upload-target">
          <Upload size={19} />
          <span>{fileName || "Select an .xlsx, .xls, or .csv file"}</span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
        </label>

        {headers.length > 0 && (
          <>
            <div className="reports-mapping-grid">
              {IMPORT_FIELDS.map(([field, label]) => (
                <label key={field}>
                  <span>{label}</span>
                  <select value={mappings[field] || ""} onChange={(event) => setMappings((previous) => ({ ...previous, [field]: event.target.value }))}>
                    <option value="">Not mapped</option>
                    {headers.map((header, index) => <option key={`${header}-${index}`} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="reports-import-preview">
              <table className="reports-table">
                <thead>
                  <tr>{IMPORT_FIELDS.map(([field, label]) => <th key={field}>{label}</th>)}</tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 100).map((row, index) => (
                    <tr key={index}>
                      {IMPORT_FIELDS.map(([field]) => (
                        <td key={field}>
                          <input
                            aria-label={`Row ${index + 1} ${field}`}
                            type={field === "report_date" ? "date" : field === "progress" ? "number" : "text"}
                            min={field === "progress" ? 0 : undefined}
                            max={field === "progress" ? 100 : undefined}
                            value={row[field] ?? ""}
                            onChange={(event) => updateCell(index, field, event.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 100 && <p className="reports-muted">Showing the first 100 of {previewRows.length} rows. All rows will be imported.</p>}
            </div>
          </>
        )}

        {error && <div className="reports-alert error"><AlertCircle size={16} />{error}</div>}
        {result && (
          <div className={`reports-alert ${result.errors?.length ? "error" : "success"}`}>
            <Check size={16} />
            Imported {result.imported}; duplicates skipped {result.duplicates}; invalid rows {result.errors?.length || 0}.
            {result.errors?.length > 0 && <span>{result.errors.slice(0, 5).map((item) => ` Row ${item.row}: ${JSON.stringify(item.errors)}`).join("")}</span>}
          </div>
        )}
        <div className="reports-modal-actions">
          <button type="button" className="reports-button secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="reports-button primary" disabled={!previewRows.length || saving} onClick={submitImport}>
            {saving ? <LoaderCircle className="reports-spin" size={16} /> : <FileSpreadsheet size={16} />}
            {saving ? "Importing…" : `Import ${previewRows.length || ""} rows`}
          </button>
        </div>
      </section>
    </div>
  );
}
