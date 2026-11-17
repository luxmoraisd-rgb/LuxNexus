import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, CalendarDays, Check, FileSpreadsheet, LoaderCircle, Plus, RefreshCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { getApiError, reportApi } from "./reportApi";
import ImportSpreadsheet from "./ImportSpreadsheet";
import "./Reports.css";

const REPORT_TABS = [
  { id: "daily", label: "Daily Report", icon: CalendarDays },
  { id: "monthly", label: "Monthly Report", icon: BarChart3 },
  { id: "sprint", label: "Sprint Report", icon: BarChart3 },
  { id: "project", label: "Project Report", icon: BarChart3 },
];
const EDITABLE_FIELDS = [
  ["report_date", "Date"],
  ["title", "Report title"],
  ["employee", "Employee"],
  ["project", "Project"],
  ["sprint", "Sprint"],
  ["task", "Task"],
  ["activity", "Activity / EOD comment"],
  ["work_completed", "Work completed"],
  ["status", "Status"],
  ["progress", "Progress %"],
  ["blockers", "Blockers"],
  ["next_steps", "Next steps"],
];
const TODAY = new Date().toISOString().slice(0, 10);

function emptyDraft() {
  return {
    title: "",
    report_type: "daily",
    report_date: TODAY,
    project_id: "",
    project: "",
    sprint_id: "",
    sprint: "",
    employee_id: "",
    employee: "",
    task: "",
    activity: "",
    work_completed: "",
    status: "",
    blockers: "",
    next_steps: "",
  };
}

export default function Reports() {
  const currentDate = new Date();
  const [activeTab, setActiveTab] = useState("daily");
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    month: String(currentDate.getMonth() + 1).padStart(2, "0"),
    year: String(currentDate.getFullYear()),
    project: "",
    sprint: "",
    employee: "",
    search: "",
  });
  const [options, setOptions] = useState({ projects: [], sprints: [], employees: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState({});
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newReport, setNewReport] = useState(emptyDraft);
  const [savingNew, setSavingNew] = useState(false);
  const [addingSamples, setAddingSamples] = useState(false);

  const query = useMemo(() => ({
    type: activeTab,
    ...filters,
    start_date: activeTab === "monthly" ? "" : filters.start_date,
    end_date: activeTab === "monthly" ? "" : filters.end_date,
    month: activeTab === "monthly" ? filters.month : "",
    year: activeTab === "monthly" ? filters.year : "",
  }), [activeTab, filters]);

  const loadReports = async (signal) => {
    setLoading(true);
    setError("");
    try {
      const response = await reportApi.getReports(query, signal);
      setRows(Array.isArray(response?.results) ? response.results : []);
      setDrafts({});
    } catch (loadError) {
      if (loadError.name !== "CanceledError" && loadError.code !== "ERR_CANCELED") {
        setError(getApiError(loadError));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchReports = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await reportApi.getReports(query, controller.signal);
        if (!controller.signal.aborted) {
          setRows(Array.isArray(response?.results) ? response.results : []);
          setDrafts({});
        }
      } catch (loadError) {
        if (!controller.signal.aborted && loadError.name !== "CanceledError" && loadError.code !== "ERR_CANCELED") {
          setError(getApiError(loadError));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchReports();
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    let active = true;
    reportApi.getOptions()
      .then((data) => {
        if (active) setOptions({
          projects: data.projects || [],
          sprints: data.sprints || [],
          employees: data.employees || [],
        });
      })
      .catch((optionsError) => {
        if (active) setError(getApiError(optionsError));
      });
    return () => { active = false; };
  }, []);

  const updateFilter = (name, value) => setFilters((previous) => ({ ...previous, [name]: value }));
  const setDraftField = (id, field, value) => {
    setDrafts((previous) => ({
      ...previous,
      [id]: { ...(previous[id] || {}), [field]: field === "progress" && value === "" ? null : value },
    }));
  };

  const saveRow = async (row) => {
    const changes = drafts[row.id];
    if (!changes) return;
    setError("");
    setNotice("");
    try {
      const payload = { ...changes };
      ["project", "sprint", "employee"].forEach((field) => {
        if (!(field in changes)) return;
        const collection = field === "project" ? options.projects : field === "sprint" ? options.sprints : options.employees;
        const matchingOption = collection.find((option) => option.name.toLowerCase() === String(changes[field]).toLowerCase());
        payload[`${field}_id`] = matchingOption?.id || "";
      });
      const updated = await reportApi.updateReport(row.id, payload);
      setRows((previous) => previous.map((item) => item.id === row.id ? updated : item));
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[row.id];
        return next;
      });
      setNotice("Report saved successfully.");
    } catch (saveError) {
      setError(getApiError(saveError));
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`Delete "${row.title || "this report"}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      await reportApi.deleteReport(row.id);
      setRows((previous) => previous.filter((item) => item.id !== row.id));
      setNotice("Report deleted.");
    } catch (deleteError) {
      setError(getApiError(deleteError));
    }
  };

  const createRow = async (event) => {
    event.preventDefault();
    setSavingNew(true);
    setError("");
    try {
      await reportApi.createReport(newReport);
      setShowCreate(false);
      setNewReport(emptyDraft());
      setNotice("Report added successfully.");
      await loadReports();
    } catch (createError) {
      setError(getApiError(createError));
    } finally {
      setSavingNew(false);
    }
  };

  const importRows = async (importedRows) => {
    const result = await reportApi.importReports(importedRows);
    const messages = [`Imported ${result.imported} row(s).`];
    if (result.duplicates) messages.push(`${result.duplicates} duplicate(s) skipped.`);
    setNotice(messages.join(" "));
    await loadReports();
    return result;
  };

  const addSampleReports = async () => {
    setAddingSamples(true);
    setError("");
    setNotice("");
    try {
      const result = await reportApi.addSampleReports();
      setNotice(result.message || `Added ${result.created || 0} sample reports.`);
      await loadReports();
    } catch (sampleError) {
      setError(getApiError(sampleError));
    } finally {
      setAddingSamples(false);
    }
  };

  const reportOptions = (key) => options[key] || [];
  const yearOptions = Array.from({ length: 8 }, (_, index) => String(currentDate.getFullYear() - index));
  const hasDraft = (row) => Boolean(drafts[row.id] && Object.keys(drafts[row.id]).length);
  const cellValue = (row, field) => drafts[row.id]?.[field] ?? row[field] ?? "";
  const isAggregate = activeTab !== "daily";
  const visibleRows = rows;

  return (
    <main className="reports-page">
      <header className="reports-heading">
        <div>
          <div className="reports-eyebrow">TRACKER / REPORTS</div>
          <h1>Reports</h1>
          <p>Review daily work updates and reports generated from your team’s saved activity.</p>
        </div>
        <div className="reports-heading-actions">
          <button type="button" className="reports-button secondary" onClick={addSampleReports} disabled={addingSamples}>
            {addingSamples ? <LoaderCircle className="reports-spin" size={16} /> : <Sparkles size={16} />}
            {addingSamples ? "Adding samples…" : "Add sample data"}
          </button>
          <button type="button" className="reports-button secondary" onClick={() => loadReports()}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="reports-button secondary" onClick={() => setShowImport(true)}>
            <FileSpreadsheet size={16} /> Import spreadsheet
          </button>
          <button type="button" className="reports-button primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Add report
          </button>
        </div>
      </header>

      <nav className="reports-tabs" aria-label="Report type">
        {REPORT_TABS.map(({ id, label, icon: Icon }) => (
          <button type="button" key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      <section className="reports-filter-panel" aria-label="Report filters">
        {activeTab === "monthly" ? (
          <>
            <label>Month<select value={filters.month} onChange={(event) => updateFilter("month", event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => {
                const month = String(index + 1).padStart(2, "0");
                return <option key={month} value={month}>{new Date(2000, index, 1).toLocaleString(undefined, { month: "long" })}</option>;
              })}
            </select></label>
            <label>Year<select value={filters.year} onChange={(event) => updateFilter("year", event.target.value)}>
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select></label>
          </>
        ) : (
          <>
            <label>From<input type="date" value={filters.start_date} onChange={(event) => updateFilter("start_date", event.target.value)} /></label>
            <label>To<input type="date" value={filters.end_date} onChange={(event) => updateFilter("end_date", event.target.value)} /></label>
          </>
        )}
        <label>Project<select value={filters.project} onChange={(event) => updateFilter("project", event.target.value)}>
          <option value="">All projects</option>
          {reportOptions("projects").map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select></label>
        <label>Sprint<select value={filters.sprint} onChange={(event) => updateFilter("sprint", event.target.value)}>
          <option value="">All sprints</option>
          {reportOptions("sprints").map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select></label>
        <label>Employee<select value={filters.employee} onChange={(event) => updateFilter("employee", event.target.value)}>
          <option value="">All employees</option>
          {reportOptions("employees").map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select></label>
        <label className="reports-search"><span>Search</span><div><Search size={16} /><input type="search" value={filters.search} placeholder="Search reports…" onChange={(event) => updateFilter("search", event.target.value)} /></div></label>
      </section>

      {error && <div className="reports-alert error" role="alert"><AlertCircle size={17} />{error}<button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={15} /></button></div>}
      {notice && <div className="reports-alert success" role="status"><Check size={17} />{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={15} /></button></div>}

      <section className="reports-sheet-card">
        <div className="reports-sheet-heading">
          <div><h2>{REPORT_TABS.find((tab) => tab.id === activeTab)?.label}</h2><span>{rows.length} {rows.length === 1 ? "entry" : "entries"}</span></div>
          {isAggregate && <span className="reports-readonly-hint">Generated from saved report data</span>}
        </div>
        <div className="reports-table-scroll">
          <table className="reports-table reports-data-table">
            <thead><tr>{EDITABLE_FIELDS.map(([, label]) => <th key={label}>{label}</th>)}<th className="reports-actions-column">Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td className="reports-state-cell" colSpan={EDITABLE_FIELDS.length + 1}><LoaderCircle className="reports-spin" size={19} />Loading reports…</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td className="reports-state-cell" colSpan={EDITABLE_FIELDS.length + 1}>No reports match these filters. Add a report or check for EOD comments.</td></tr>
              ) : visibleRows.map((row) => (
                <tr key={row.id} className={`${row.source === "eod_comment" ? "reports-eod-row" : ""} ${row.source === "sample" ? "reports-sample-row" : ""}`}>
                  {EDITABLE_FIELDS.map(([field]) => (
                    <td key={field}>
                      {row.editable ? (
                        <input
                          aria-label={`${row.title || "Report"} ${field}`}
                          type={field === "report_date" ? "date" : field === "progress" ? "number" : "text"}
                          min={field === "progress" ? 0 : undefined}
                          max={field === "progress" ? 100 : undefined}
                          value={cellValue(row, field)}
                          onChange={(event) => setDraftField(row.id, field, event.target.value)}
                        />
                      ) : (
                        <span className="reports-cell-content" title={String(row[field] ?? "")}>
                          {field === "report_date" && row.period ? row.period : row[field] ?? "—"}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="reports-row-actions">
                    {row.editable ? (
                      <>
                        <button type="button" className="reports-icon-button save" disabled={!hasDraft(row)} title="Save changes" aria-label="Save changes" onClick={() => saveRow(row)}><Check size={16} /></button>
                        <button type="button" className="reports-icon-button" disabled={!hasDraft(row)} title="Cancel unsaved changes" aria-label="Cancel unsaved changes" onClick={() => setDrafts((previous) => { const next = { ...previous }; delete next[row.id]; return next; })}><X size={16} /></button>
                        <button type="button" className="reports-icon-button delete" title="Delete report" aria-label="Delete report" onClick={() => deleteRow(row)}><Trash2 size={16} /></button>
                      </>
                    ) : <span className="reports-source-label">{row.source === "eod_comment" ? "EOD comment" : `${row.entry_count || 0} records`}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <div className="reports-modal-backdrop">
          <form className="reports-create-dialog" onSubmit={createRow}>
            <div className="reports-modal-header"><div><h2>Add daily report</h2><p>New reports are saved to the shared reports database.</p></div><button type="button" className="reports-icon-button" aria-label="Close" onClick={() => setShowCreate(false)}><X size={18} /></button></div>
            <label>Title<input required maxLength={200} value={newReport.title} onChange={(event) => setNewReport((previous) => ({ ...previous, title: event.target.value }))} /></label>
            <label>Date<input required type="date" value={newReport.report_date} onChange={(event) => setNewReport((previous) => ({ ...previous, report_date: event.target.value }))} /></label>
            <div className="reports-form-grid">
              <label>Employee<select value={newReport.employee_id} onChange={(event) => {
                const employee = options.employees.find((item) => item.id === event.target.value);
                setNewReport((previous) => ({ ...previous, employee_id: event.target.value, employee: employee?.name || "" }));
              }}><option value="">Unassigned</option>{options.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
              <label>Project<select value={newReport.project_id} onChange={(event) => {
                const project = options.projects.find((item) => item.id === event.target.value);
                setNewReport((previous) => ({ ...previous, project_id: event.target.value, project: project?.name || "" }));
              }}><option value="">Unassigned</option>{options.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label>Sprint<select value={newReport.sprint_id} onChange={(event) => {
                const sprint = options.sprints.find((item) => item.id === event.target.value);
                setNewReport((previous) => ({ ...previous, sprint_id: event.target.value, sprint: sprint?.name || "" }));
              }}><option value="">Unassigned</option>{options.sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></label>
              <label>Status<input value={newReport.status} onChange={(event) => setNewReport((previous) => ({ ...previous, status: event.target.value }))} /></label>
            </div>
            {[
              ["task", "Task"],
              ["activity", "Activity / EOD comments"],
              ["work_completed", "Work completed"],
              ["blockers", "Blockers"],
              ["next_steps", "Next steps"],
            ].map(([field, label]) => <label key={field}>{label}<textarea rows={2} value={newReport[field]} onChange={(event) => setNewReport((previous) => ({ ...previous, [field]: event.target.value }))} /></label>)}
            <div className="reports-modal-actions"><button type="button" className="reports-button secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="reports-button primary" disabled={savingNew}>{savingNew ? <LoaderCircle className="reports-spin" size={16} /> : <Plus size={16} />}Save report</button></div>
          </form>
        </div>
      )}
      {showImport && <ImportSpreadsheet onClose={() => setShowImport(false)} onImported={importRows} options={options} />}
    </main>
  );
}
