import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  Search,
  X,
  Layers,
  CheckCircle2,
  Activity,
  ArrowRight,
  Calendar,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { getStoredTasks, getStoredSprints } from "../MyTasks/Backlog/backlogApi";
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  setActiveWorkspaceProject,
} from "./projectsApi";
import { peopleApi } from "../People/peopleApi";
import "./projects.css";

const COLOR_OPTIONS = [
  "#6366f1",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#3b82f6",
];

const CATEGORIES = ["All", "Engineering", "Design", "Marketing", "Operations"];

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [toastMessage, setToastMessage] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formCategory, setFormCategory] = useState("Engineering");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0]);
  const [formProgress, setFormProgress] = useState(0);
  const [formLead, setFormLead] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStatus, setFormStatus] = useState("Active");
  const [teamLeads, setTeamLeads] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Load projects from MongoDB backend on mount
  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await fetchProjects();
      if (Array.isArray(data)) {
        setProjects(data);
      }
    } catch (err) {
      console.warn("Failed to load projects from server:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchProjects(),
      peopleApi.getMembers({ role: "team_lead" }),
    ]).then(([projectsResult, teamLeadsResult]) => {
      if (!active) return;
      if (projectsResult.status === "fulfilled") setProjects(projectsResult.value);
      else console.warn("Failed to load projects from server:", projectsResult.reason);
      if (teamLeadsResult.status === "fulfilled") setTeamLeads(teamLeadsResult.value);
      else console.warn("Failed to load team leads:", teamLeadsResult.reason);
    });
    return () => {
      active = false;
    };
  }, []);

  // Live sprint and task counts for statistics
  const tasks = useMemo(() => {
    try {
      return getStoredTasks();
    } catch {
      return [];
    }
  }, []);

  const sprints = useMemo(() => {
    try {
      return getStoredSprints();
    } catch {
      return [];
    }
  }, []);

  const activeSprintCount = sprints.filter((s) => s.isStarted && !s.isCompleted).length;
  const completedTasksCount = tasks.filter((t) => t.status === "DONE" || t.status === "Closed").length;
  const totalTasksCount = tasks.length;

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        !searchQuery.trim() ||
        project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || project.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [projects, searchQuery, selectedCategory]);

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setFormError("");
    setFormName("");
    setFormKey("");
    setFormCategory("Engineering");
    setFormDescription("");
    setFormColor(COLOR_OPTIONS[0]);
    setFormProgress(0);
    setFormLead("");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormStatus("Active");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (proj) => {
    setEditingProject(proj);
    setFormError("");
    setFormName(proj.name || "");
    setFormKey(proj.key || "");
    setFormCategory(proj.category || "Engineering");
    setFormDescription(proj.description || "");
    setFormColor(proj.color || COLOR_OPTIONS[0]);
    setFormProgress(proj.progress || 0);
    setFormLead(proj.lead || proj.project_lead || "");
    setFormStartDate(proj.start_date || proj.startDate || "");
    setFormEndDate(proj.end_date || proj.endDate || "");
    setFormStatus(proj.status || "Active");
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!formName.trim() || isSaving) return;

    setIsSaving(true);
    setFormError("");
    try {
      if (editingProject) {
        const updates = {
          name: formName.trim(),
          key: formKey.trim() || editingProject.key,
          category: formCategory,
          description: formDescription.trim(),
          color: formColor,
          progress: Number(formProgress) || 0,
          lead: formLead.trim(),
          project_lead: formLead.trim(),
          start_date: formStartDate,
          startDate: formStartDate,
          end_date: formEndDate,
          endDate: formEndDate,
          status: formStatus,
        };

        await updateProject(editingProject.id, updates);
        setProjects((prev) =>
          prev.map((p) => (p.id === editingProject.id ? { ...p, ...updates } : p))
        );
        showToast(`Project "${formName}" updated successfully!`);
      } else {
        const payload = {
          name: formName.trim(),
          key: formKey.trim(),
          category: formCategory,
          description: formDescription.trim(),
          color: formColor,
          progress: Number(formProgress) || 0,
          is_default_workspace: projects.length === 0,
          start_date: formStartDate,
          end_date: formEndDate,
          lead: formLead.trim(),
          project_lead: formLead.trim(),
          status: formStatus,
        };

        const created = await createProject(payload);
        setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
        showToast(`Project "${formName}" created in MongoDB!`);
      }
      setIsModalOpen(false);
    } catch (error) {
      const responseData = error.response?.data;
      const fieldErrors = responseData && typeof responseData === "object"
        ? Object.entries(responseData).flatMap(([field, messages]) =>
            (Array.isArray(messages) ? messages : [messages])
              .filter((message) => typeof message === "string")
              .map((message) => `${field}: ${message}`)
          )
        : [];
      const message =
        (typeof responseData?.detail === "string" && responseData.detail) ||
        fieldErrors.join(" ") ||
        error.message ||
        (editingProject ? "Unable to update project." : "Unable to create project.");
      setFormError(message);
      showToast(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (projId, projName) => {
    if (!window.confirm(`Are you sure you want to delete "${projName}"?`)) return;
    try {
      await deleteProject(projId);
      setProjects((prev) => prev.filter((p) => p.id !== projId));
      showToast(`Project "${projName}" deleted.`);
    } catch {
      showToast("Error deleting project.");
    }
  };

  const handleSetActiveWorkspace = async (projId, projName) => {
    try {
      await setActiveWorkspaceProject(projId);
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          is_default_workspace: p.id === projId,
          isDefaultWorkspace: p.id === projId,
        }))
      );
      showToast(`"${projName}" is now the active workspace!`);
    } catch {
      showToast("Error setting active workspace.");
    }
  };

  return (
    <div className="projects-page-container">
      {/* Page Header */}
      <div className="projects-header">
        <div className="projects-title-row">
          <div className="projects-icon-wrapper">
            <FolderKanban size={26} />
          </div>
          <div>
            <h1 className="projects-title">Projects</h1>
            <p className="projects-subtitle">
              Manage workspace initiatives, track sprint progress, and assign team resources in MongoDB
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="project-icon-action-btn"
            onClick={loadProjects}
            title="Refresh projects from MongoDB"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
          <button
            className="create-project-btn"
            onClick={handleOpenCreateModal}
            title="Create a new initiative"
          >
            <Plus size={18} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="projects-stats-grid">
        <div className="projects-stat-card">
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}
          >
            <FolderKanban size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Projects</span>
            <span className="stat-value">{projects.length}</span>
          </div>
        </div>

        <div className="projects-stat-card">
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}
          >
            <Activity size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Active Sprints</span>
            <span className="stat-value">{activeSprintCount}</span>
          </div>
        </div>

        <div className="projects-stat-card">
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(6, 182, 212, 0.15)", color: "#06b6d4" }}
          >
            <Layers size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Issues</span>
            <span className="stat-value">{totalTasksCount}</span>
          </div>
        </div>

        <div className="projects-stat-card">
          <div
            className="stat-icon-wrap"
            style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Completed</span>
            <span className="stat-value">
              {Math.round((completedTasksCount / Math.max(totalTasksCount, 1)) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Category Filter */}
      <div className="projects-controls-bar">
        <div className="projects-search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="projects-search-input"
            placeholder="Search projects by name, key, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="projects-category-filters">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`category-filter-btn ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && projects.length === 0 ? (
        <div className="projects-loading-state">
          <Loader2 size={24} className="spin" />
          <span>Connecting to MongoDB & fetching projects...</span>
        </div>
      ) : (
        /* Projects Grid */
        <div className="projects-grid">
          {filteredProjects.length === 0 ? (
            <div className="projects-empty-state">
              <FolderKanban size={48} className="empty-icon" />
              <h3>No projects found</h3>
              <p>
                We couldn't find any projects matching "{searchQuery}". Try adjusting your keywords
                or clear the filters.
              </p>
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isDefault = Boolean(
                project.is_default_workspace || project.isDefaultWorkspace
              );

              return (
                <div
                  key={project.id}
                  className="project-card"
                  role="group"
                  tabIndex={0}
                  aria-label={`${project.name} project details`}
                >
                  <div className="project-card-header">
                    <div className="project-badge-group">
                      <div
                        className="project-icon-box"
                        style={{
                          background: `${project.color || "#6366f1"}22`,
                          color: project.color || "#6366f1",
                          border: `1px solid ${project.color || "#6366f1"}44`,
                        }}
                      >
                        <FolderKanban size={22} />
                      </div>
                      <div>
                        <h3 className="project-card-name">{project.name}</h3>
                        <div className="project-meta-pills">
                          <span className="project-key-pill">{project.key}</span>
                          <span className="project-category-pill">{project.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="project-card-top-right">
                      {isDefault ? (
                        <span className="current-workspace-badge" title="Active workspace">
                          <CheckCircle2 size={13} />
                          Active Workspace
                        </span>
                      ) : (
                        <button
                          className="set-active-btn"
                          onClick={() => handleSetActiveWorkspace(project.id, project.name)}
                          title="Set as active workspace"
                        >
                          Set Active
                        </button>
                      )}

                      <button
                        className="project-icon-action-btn"
                        onClick={() => handleOpenEditModal(project)}
                        title="Edit project"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        className="project-icon-action-btn delete"
                        onClick={() => handleDeleteProject(project.id, project.name)}
                        title="Delete project"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="project-description">{project.description}</p>

                  <div className="project-progress-container">
                    <div className="project-progress-label-row">
                      <span>Sprint Velocity</span>
                      <span className="project-progress-percent">{project.progress || 0}%</span>
                    </div>
                    <div className="project-progress-track">
                      <div
                        className="project-progress-fill"
                        style={{
                          width: `${project.progress || 0}%`,
                          backgroundColor: project.color || "#6366f1",
                        }}
                      />
                    </div>
                  </div>

                  <div className="project-sprint-info-row">
                    <div className="sprint-status-col">
                      <Calendar size={14} />
                      <span>{project.active_sprint_name || project.activeSprintName || "Sprint 1"}</span>
                    </div>
                    <span>{project.start_date || project.startDate || "Current"}</span>
                  </div>

                  <div className="project-card-actions">
                    <button
                      className="project-action-btn primary"
                      onClick={() => navigate(`/work/projects/${project.id}`)}
                    >
                      <span>Board</span>
                      <ArrowRight size={13} />
                    </button>
                    <button
                      className="project-action-btn secondary"
                      onClick={() => navigate("/work/backlog")}
                    >
                      Backlog
                    </button>
                    <button
                      className="project-action-btn secondary"
                      onClick={() => navigate("/work/all-sprints")}
                    >
                      Sprints
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => !isSaving && setIsModalOpen(false)}>
          <div
            className="create-project-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{editingProject ? "Edit Project" : "Create New Project"}</h2>
              <button
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                <X size={18} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSaveProject}>
              {isSaving && !editingProject && (
                <div
                  className="project-create-progress"
                  role="progressbar"
                  aria-label="Creating project"
                  aria-valuetext="Creating project"
                >
                  <div className="project-create-progress-bar" />
                  <span>Creating your project...</span>
                </div>
              )}
              {formError && (
                <p className="project-form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mobile Application v3"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Project Lead</label>
                  <select
                    value={formLead}
                    onChange={(e) => setFormLead(e.target.value)}
                  >
                    <option value="">Select Team Lead</option>
                    {teamLeads.map((lead) => (
                      <option key={lead.id} value={lead.name || lead.username || lead.email}>
                        {lead.name || lead.username || lead.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                    <option value="Planned">Planned</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" min={formStartDate || undefined} value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
                </div>
              </div>

              <div className="form-group progress-range-group">
                <div className="progress-range-header">
                  <label htmlFor="project-progress">Sprint Velocity / Progress</label>
                  <span>{formProgress}%</span>
                </div>
                <input
                  id="project-progress"
                  className="progress-range"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={formProgress}
                  onChange={(e) => setFormProgress(Number(e.target.value))}
                  style={{ "--progress": `${formProgress}%` }}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Summarize the core objectives and deliverables..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Theme Color</label>
                <div className="color-picker-row">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch ${formColor === c ? "selected" : ""}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setFormColor(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      {editingProject ? "Saving..." : "Creating..."}
                    </>
                  ) : editingProject ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="projects-toast-alert">
          <Sparkles size={16} color="#818cf8" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
