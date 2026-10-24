import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Briefcase,
  Layers,
  Search,
  Plus,
  LayoutGrid,
  List,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarDays,
  DollarSign,
  TrendingUp,
  FolderKanban,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { portfoliosApi } from "./portfoliosApi";
import "./Portfolios.css";

export default function Portfolios({ currentUser, rolePermissions }) {
  const [portfolios, setPortfolios] = useState([]);
  const [metrics, setMetrics] = useState({
    totalPortfolios: 0,
    totalProjects: 0,
    averageProgress: 0,
    onTrackCount: 0,
    atRiskCount: 0,
    offTrackCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePortfolio, setActivePortfolio] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    status: "on track",
    progress: 10,
    priority: "High",
    timeframe: "Full Year 2026",
    budget: "$200,000",
    ownerName: currentUser?.name || currentUser?.username || "You",
    ownerRole: currentUser?.role || "Portfolio Lead",
    projectsInput: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portfoliosApi.getPortfolios({
        search: searchQuery,
        status: statusFilter,
      });
      setPortfolios(data.portfolios || []);
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("[Portfolios] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(debounceTimer);
  }, [loadData]);

  const handleOpenCreateModal = () => {
    const currentUserName = currentUser?.name || currentUser?.username || "You";
    setFormData({
      name: "",
      key: "",
      description: "",
      status: "on track",
      progress: 10,
      priority: "High",
      timeframe: "Q1 - Q4 FY26",
      budget: "$250,000",
      ownerName: currentUserName,
      ownerRole: currentUser?.role || "Portfolio Lead",
      projectsInput: "",
    });
    setIsModalOpen(true);
  };

  const handleSavePortfolio = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const projectNames = formData.projectsInput
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const payload = {
      name: formData.name.trim(),
      key: formData.key.trim() || undefined,
      description: formData.description.trim(),
      status: formData.status,
      progress: Number(formData.progress) || 0,
      priority: formData.priority,
      timeframe: formData.timeframe,
      budget: formData.budget,
      owner: {
        name: formData.ownerName,
        role: formData.ownerRole,
        initials: (formData.ownerName || "PL").slice(0, 2).toUpperCase(),
      },
      projects: projectNames.map((name, idx) => ({
        id: `prj-${Date.now()}-${idx}`,
        name,
        progress: Math.floor(Math.random() * 40) + 40,
        status: formData.status,
      })),
    };

    try {
      const created = await portfoliosApi.createPortfolio(payload);
      setPortfolios((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setIsModalOpen(false);
      // update metrics
      setMetrics((m) => ({
        ...m,
        totalPortfolios: m.totalPortfolios + 1,
        totalProjects: m.totalProjects + (payload.projects.length || 0),
      }));
    } catch (err) {
      console.error("[Portfolios] Save error:", err);
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (window.confirm("Are you sure you want to remove this portfolio?")) {
      try {
        await portfoliosApi.deletePortfolio(id);
        setPortfolios((prev) => prev.filter((p) => p.id !== id));
        if (activePortfolio?.id === id) {
          setActivePortfolio(null);
        }
      } catch (err) {
        console.error("[Portfolios] Delete error:", err);
      }
    }
  };

  const handleUpdateProgress = async (portfolio, newProgress) => {
    const updated = { ...portfolio, progress: newProgress };
    setPortfolios((prev) => prev.map((p) => (p.id === portfolio.id ? updated : p)));
    if (activePortfolio?.id === portfolio.id) {
      setActivePortfolio(updated);
    }
    await portfoliosApi.updatePortfolio(portfolio.id, { progress: newProgress });
  };

  const getProgressColorClass = (progress, status) => {
    const st = (status || "").toLowerCase();
    if (st === "off track") return "rose";
    if (st === "at risk" || progress < 50) return "amber";
    return "green";
  };

  const filteredPortfolios = useMemo(() => {
    return portfolios;
  }, [portfolios]);

  return (
    <div className="portfolios-container">
      {/* HEADER SECTION */}
      <header className="portfolios-header">
        <div className="portfolios-header-main">
          <div className="portfolios-title-group">
            <div className="portfolios-icon-badge">
              <Briefcase size={24} />
            </div>
            <div>
              <h1 className="portfolios-heading">Portfolios</h1>
              <p className="portfolios-subheading">
                Coordinate strategic programs, monitor initiatives velocity, and track portfolio progress across teams.
              </p>
            </div>
          </div>

          <div className="portfolios-actions-bar">
            {/* Search Box */}
            <div className="portfolios-search-box">
              <Search size={16} className="portfolios-search-icon" />
              <input
                type="text"
                className="portfolios-search-input"
                placeholder="Search portfolios, leads, projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View Mode Toggle */}
            <div className="portfolios-view-toggles">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <LayoutGrid size={17} />
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Table view"
              >
                <List size={17} />
              </button>
            </div>

            {/* Add Portfolio Button */}
            <button
              type="button"
              className="portfolio-create-btn"
              onClick={handleOpenCreateModal}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>New portfolio</span>
            </button>
          </div>
        </div>

        {/* STATUS FILTER CHIPS */}
        <div className="portfolios-filter-strip">
          <button
            type="button"
            className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <span>All Portfolios</span>
            <span className="filter-chip-count">{metrics.totalPortfolios}</span>
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "on track" ? "active" : ""}`}
            onClick={() => setStatusFilter("on track")}
          >
            <span>On Track</span>
            <span className="filter-chip-count">{metrics.onTrackCount}</span>
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "at risk" ? "active" : ""}`}
            onClick={() => setStatusFilter("at risk")}
          >
            <span>At Risk</span>
            <span className="filter-chip-count">{metrics.atRiskCount}</span>
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "off track" ? "active" : ""}`}
            onClick={() => setStatusFilter("off track")}
          >
            <span>Off Track</span>
            <span className="filter-chip-count">{metrics.offTrackCount}</span>
          </button>
        </div>
      </header>

      {/* KPI METRICS STRIP */}
      <section className="portfolios-kpi-strip">
        <div className="portfolio-kpi-card">
          <div className="kpi-icon-wrap indigo">
            <Layers size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{metrics.totalPortfolios}</span>
            <span className="kpi-label">Active Portfolios</span>
          </div>
        </div>

        <div className="portfolio-kpi-card">
          <div className="kpi-icon-wrap emerald">
            <FolderKanban size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{metrics.totalProjects}</span>
            <span className="kpi-label">Tracked Projects</span>
          </div>
        </div>

        <div className="portfolio-kpi-card">
          <div className="kpi-icon-wrap amber">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{metrics.averageProgress}%</span>
            <span className="kpi-label">Average Completion</span>
          </div>
        </div>

        <div className="portfolio-kpi-card">
          <div className="kpi-icon-wrap pink">
            <ShieldCheck size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{metrics.onTrackCount} / {metrics.totalPortfolios}</span>
            <span className="kpi-label">Initiatives Healthy</span>
          </div>
        </div>
      </section>

      {/* CONTENT AREA: GRID OR TABLE */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
          Loading portfolios...
        </div>
      ) : filteredPortfolios.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <Briefcase size={44} style={{ opacity: 0.35, marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>No Portfolios Found</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Create your first strategic portfolio to group projects and monitor progress.
          </p>
          <button
            type="button"
            className="portfolio-create-btn"
            style={{ margin: "16px auto 0" }}
            onClick={handleOpenCreateModal}
          >
            <Plus size={16} /> Create Portfolio
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="portfolios-grid">
          {filteredPortfolios.map((portfolio) => {
            const st = (portfolio.status || "on track").toLowerCase();
            const colorClass = getProgressColorClass(portfolio.progress, st);
            const priorityLower = (portfolio.priority || "high").toLowerCase();

            return (
              <div
                key={portfolio.id}
                className="portfolio-card"
                onClick={() => setActivePortfolio(portfolio)}
              >
                {/* Top Row */}
                <div className="portfolio-card-top">
                  <span className="portfolio-key-badge">{portfolio.key || "PORT"}</span>
                  <div className="card-top-tags">
                    <span className={`priority-tag ${priorityLower}`}>{portfolio.priority || "High"}</span>
                    <span className={`status-pill ${st.replace(/\s+/g, "-")}`}>
                      <span className="status-dot" />
                      {portfolio.status || "On Track"}
                    </span>
                  </div>
                </div>

                {/* Title & Desc */}
                <div>
                  <h3 className="portfolio-card-title">{portfolio.name}</h3>
                  {portfolio.description && (
                    <p className="portfolio-card-desc">{portfolio.description}</p>
                  )}
                </div>

                {/* Overall Progress */}
                <div className="portfolio-progress-section">
                  <div className="progress-header">
                    <span>Overall Progress</span>
                    <strong>{portfolio.progress}%</strong>
                  </div>
                  <div className="portfolio-progress-bar">
                    <div
                      className={`portfolio-progress-fill ${colorClass}`}
                      style={{ width: `${portfolio.progress}%` }}
                    />
                  </div>
                </div>

                {/* Linked Projects */}
                {portfolio.projects && portfolio.projects.length > 0 && (
                  <div className="portfolio-projects-box">
                    <span className="projects-label">Linked Projects ({portfolio.projects.length})</span>
                    <div className="projects-chips-wrap">
                      {portfolio.projects.map((prj) => (
                        <div key={prj.id || prj.name} className="project-chip">
                          <span>{prj.name}</span>
                          {prj.progress !== undefined && (
                            <span className="project-chip-pct">{prj.progress}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card Footer */}
                <div className="portfolio-card-footer">
                  <div className="portfolio-meta-left">
                    <span className="meta-timeframe">
                      <CalendarDays size={13} />
                      {portfolio.timeframe || "2026"}
                    </span>
                    {portfolio.budget && (
                      <span className="meta-budget">{portfolio.budget}</span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="portfolio-owner-badge" title={`Lead: ${portfolio.owner?.name || "Unassigned"}`}>
                      <div className="owner-avatar">
                        {portfolio.owner?.initials || (portfolio.owner?.name ? portfolio.owner.name.slice(0, 2).toUpperCase() : "PL")}
                      </div>
                      <span className="owner-name">{portfolio.owner?.name || "Lead"}</span>
                    </div>

                    <div className="portfolio-card-actions">
                      <button
                        type="button"
                        className="card-action-icon-btn danger"
                        onClick={(e) => handleDelete(portfolio.id, e)}
                        title="Delete portfolio"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="portfolios-table-container">
          <table className="portfolios-table">
            <thead>
              <tr>
                <th>Portfolio</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Projects</th>
                <th>Timeframe</th>
                <th>Budget</th>
                <th>Lead</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPortfolios.map((portfolio) => {
                const st = (portfolio.status || "on track").toLowerCase();
                const colorClass = getProgressColorClass(portfolio.progress, st);

                return (
                  <tr key={portfolio.id} onClick={() => setActivePortfolio(portfolio)}>
                    <td>
                      <div className="td-portfolio-name">
                        <span className="td-name-title">{portfolio.name}</span>
                        <span className="td-key-sub">{portfolio.key || "PORT"}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${st.replace(/\s+/g, "-")}`}>
                        <span className="status-dot" />
                        {portfolio.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-progress-box">
                        <div className="table-progress-bar">
                          <div
                            className={`portfolio-progress-fill ${colorClass}`}
                            style={{ width: `${portfolio.progress}%` }}
                          />
                        </div>
                        <span className="table-progress-val">{portfolio.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        {portfolio.projects ? `${portfolio.projects.length} projects` : "0 projects"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                        {portfolio.timeframe || "FY26"}
                      </span>
                    </td>
                    <td>
                      <span className="meta-budget">{portfolio.budget || "-"}</span>
                    </td>
                    <td>
                      <div className="portfolio-owner-badge">
                        <div className="owner-avatar">
                          {portfolio.owner?.initials || (portfolio.owner?.name ? portfolio.owner.name.slice(0, 2).toUpperCase() : "PL")}
                        </div>
                        <span className="owner-name">{portfolio.owner?.name || "Lead"}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="card-action-icon-btn danger"
                        onClick={(e) => handleDelete(portfolio.id, e)}
                        title="Delete portfolio"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE PORTFOLIO MODAL */}
      {isModalOpen && (
        <div className="portfolio-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="portfolio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="portfolio-modal-header">
              <h2>Create New Portfolio</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSavePortfolio}>
              <div className="portfolio-modal-body">
                <div className="form-group">
                  <label>Portfolio Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Next-Gen Enterprise Platform"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Portfolio Key (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. PORT-CORE"
                      value={formData.key}
                      onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      className="form-select"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="Describe the portfolio's strategic objectives and target outcomes..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="on track">On Track</option>
                      <option value="at risk">At Risk</option>
                      <option value="off track">Off Track</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Initial Progress ({formData.progress}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.progress}
                      onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                      style={{ marginTop: 8 }}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Target Timeframe</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Q1 - Q4 FY26"
                      value={formData.timeframe}
                      onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Allocated Budget</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. $250,000"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Lead / Owner Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Leader name"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Lead Role</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. VP of Product"
                      value={formData.ownerRole}
                      onChange={(e) => setFormData({ ...formData, ownerRole: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Linked Projects (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Design System 2.0, API Gateway v2, Distributed Storage"
                    value={formData.projectsInput}
                    onChange={(e) => setFormData({ ...formData, projectsInput: e.target.value })}
                  />
                </div>
              </div>

              <div className="portfolio-modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={!formData.name.trim()}
                >
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PORTFOLIO DETAILS / EDIT DRAWER */}
      {activePortfolio && (
        <div className="portfolio-modal-overlay" onClick={() => setActivePortfolio(null)}>
          <div className="portfolio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="portfolio-modal-header">
              <div>
                <span className="portfolio-key-badge">{activePortfolio.key || "PORT"}</span>
                <h2 style={{ marginTop: 6 }}>{activePortfolio.name}</h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setActivePortfolio(null)}
              >
                ×
              </button>
            </div>

            <div className="portfolio-modal-body">
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {activePortfolio.description || "No description provided."}
              </p>

              <div className="form-row" style={{ marginTop: 8 }}>
                <div className="form-group">
                  <label>Status</label>
                  <span className={`status-pill ${String(activePortfolio.status || "on track").replace(/\s+/g, "-")}`}>
                    <span className="status-dot" />
                    {activePortfolio.status || "On Track"}
                  </span>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <span className={`priority-tag ${String(activePortfolio.priority || "high").toLowerCase()}`}>
                    {activePortfolio.priority || "High"}
                  </span>
                </div>
              </div>

              {/* Progress Slider */}
              <div className="form-group" style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Overall Completion</label>
                  <strong style={{ color: "#a5b4fc" }}>{activePortfolio.progress}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={activePortfolio.progress}
                  onChange={(e) => handleUpdateProgress(activePortfolio, Number(e.target.value))}
                  style={{ marginTop: 8 }}
                />
              </div>

              {/* Linked Projects Breakdown */}
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Initiative Projects ({activePortfolio.projects?.length || 0})
                </label>
                <div className="drawer-projects-list">
                  {(activePortfolio.projects || []).map((prj) => (
                    <div
                      key={prj.id || prj.name}
                      className="drawer-project-item"
                    >
                      <div>
                        <span className="drawer-project-name">
                          {prj.name}
                        </span>
                        <div className="drawer-project-status">
                          Status: {prj.status || "Active"}
                        </div>
                      </div>
                      <span className="drawer-project-pct">
                        {prj.progress !== undefined ? `${prj.progress}%` : "In Progress"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta details */}
              <div className="drawer-meta-grid">
                <div>
                  <span className="drawer-meta-label">Timeframe: </span>
                  <strong>{activePortfolio.timeframe || "FY26"}</strong>
                </div>
                <div>
                  <span className="drawer-meta-label">Allocated Budget: </span>

                  <strong>{activePortfolio.budget || "$250,000"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Portfolio Lead: </span>
                  <strong>{activePortfolio.owner?.name || "Lead"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Lead Role: </span>
                  <strong>{activePortfolio.owner?.role || "VP"}</strong>
                </div>
              </div>
            </div>

            <div className="portfolio-modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setActivePortfolio(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
