import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  TrendingUp,
  FolderKanban,
  CalendarDays,
  User,
  X,
  Building2,
  Check,
  Pencil,
} from "lucide-react";
import Header from "./Header";
import Tabs from "./Tabs";
import { goalsApi } from "./goalsApi";
import { GOAL_TIME_PERIODS } from "./goalFormOptions";
import "./TeamGoals.css";

const getDateInputValue = (value) => {
  const dateValue = String(value || "").trim();
  const isoDate = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatGoalDate = (value) => {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function TeamGoals({ onSelectTab, onNavigateGoal, currentUser }) {
  const [teamData, setTeamData] = useState({ teams: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: "",
    team: "",
    timePeriod: "",
    ownerName: "Franklin",
    ownerInitials: "FR",
    dueDate: "Apr 30, 2026",
    statusSummary: "Initiated sprint planning and task breakdowns.",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await goalsApi.getTeamGoals();
      setTeamData(data);
    } catch (err) {
      console.error("[TeamGoals] Failed to load team goals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const teams = teamData.teams || [];
  const metrics = teamData.metrics || {};
  const userEmail = String(currentUser?.email || currentUser?.id || "")
    .trim()
    .toLowerCase();
  const canEditGoals = userEmail === "franklin@gmail.com";

  const teamListOptions = useMemo(() => {
    const set = new Set(teams.map((t) => t.teamName));
    return ["all", ...Array.from(set)];
  }, [teams]);

  const filteredTeams = useMemo(() => {
    let list = teams;
    if (selectedTeam !== "all") {
      list = list.filter((t) => t.teamName === selectedTeam);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list
        .map((t) => {
          const matched = (t.goals || []).filter(
            (g) =>
              g.name?.toLowerCase().includes(q) ||
              g.owner?.name?.toLowerCase().includes(q)
          );
          return {
            ...t,
            goals: matched,
          };
        })
        .filter((t) => t.goals.length > 0 || t.teamName.toLowerCase().includes(q));
    }

    return list;
  }, [teams, selectedTeam, searchQuery]);

  const handleCreateTeamGoal = async (e) => {
    e.preventDefault();
    if (!newGoal.name.trim() || !newGoal.team || !newGoal.timePeriod) return;

    const payload = {
      name: newGoal.name.trim(),
      team: newGoal.team,
      status: "on track",
      progress: 0,
      timePeriod: newGoal.timePeriod,
      owner: {
        name: newGoal.ownerName,
        initials: newGoal.ownerInitials,
      },
      dueDate: newGoal.dueDate,
      statusSummary: newGoal.statusSummary,
    };

    try {
      const created = await goalsApi.createTeamGoal(payload);
      const updatedTeams = teams.map((t) => {
        if (t.teamName === newGoal.team) {
          return {
            ...t,
            totalGoals: t.totalGoals + 1,
            goals: [created, ...(t.goals || [])],
          };
        }
        return t;
      });

      setTeamData((prev) => ({
        ...prev,
        teams: updatedTeams,
        metrics: {
          ...prev.metrics,
          totalGoals: (prev.metrics.totalGoals || 0) + 1,
        },
      }));
    } catch (err) {
      console.error("[TeamGoals] Create goal error:", err);
    }

    setIsModalOpen(false);
    setNewGoal({
      name: "",
      team: "",
      timePeriod: "",
      ownerName: "Franklin",
      ownerInitials: "FR",
      dueDate: "Apr 30, 2026",
      statusSummary: "Initiated sprint planning and task breakdowns.",
    });
  };

  const handleCloseCreateModal = () => {
    setIsModalOpen(false);
    setNewGoal((prev) => ({ ...prev, team: "", timePeriod: "" }));
  };

  const handleUpdateTeamGoal = async (e) => {
    e.preventDefault();
    if (!String(editGoal?.name || "").trim()) return;

    const owner =
      typeof editGoal.owner === "object" && editGoal.owner
        ? editGoal.owner
        : {};
    const ownerName = String(owner.name || "").trim();
    const payload = {
      name: editGoal.name.trim(),
      status: editGoal.status,
      progress: Number(editGoal.progress),
      timePeriod: editGoal.timePeriod || "",
      dueDate: editGoal.dueDate || "",
      owner: ownerName
        ? {
            ...owner,
            name: ownerName,
            initials: ownerName.slice(0, 2).toUpperCase(),
          }
        : null,
    };

    setIsSavingEdit(true);
    setEditError("");
    try {
      await goalsApi.updateTeamGoal(editGoal.id, payload);
      setEditGoal(null);
      await loadData();
    } catch (err) {
      console.error("[TeamGoals] Update goal error:", err);
      setEditError("Unable to save this goal. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="team-goals-page">
      <Header title="Team Goals" />

      <Tabs
        activeTab="Team goals"
        onSelectTab={(tab) => onSelectTab && onSelectTab(tab)}
      />

      {/* KPI Overview Banner */}
      <div className="team-goals-kpi-banner">
        <div className="team-kpi-card">
          <div className="team-kpi-icon indigo">
            <Building2 size={20} />
          </div>
          <div className="team-kpi-info">
            <span className="team-kpi-label">Active Departments</span>
            <strong className="team-kpi-val">{teams.length || 5}</strong>
            <span className="team-kpi-sub">Collaborating teams</span>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon emerald">
            <CheckCircle2 size={20} />
          </div>
          <div className="team-kpi-info">
            <span className="team-kpi-label">Completed Team Goals</span>
            <strong className="team-kpi-val">
              {metrics.completedGoals || 2}/{metrics.totalGoals || 12}
            </strong>
            <span className="team-kpi-sub">
              {metrics.overallCompletionPercent || 17}% completion rate
            </span>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon blue">
            <TrendingUp size={20} />
          </div>
          <div className="team-kpi-info">
            <span className="team-kpi-label">Execution Velocity</span>
            <strong className="team-kpi-val">{metrics.overallAverageProgress || 72}%</strong>
            <span className="team-kpi-sub">Avg sprint progress</span>
          </div>
        </div>

        <div className="team-kpi-card action-card">
          <button
            type="button"
            className="add-team-goal-hero-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} />
            <span>Create Team Goal</span>
          </button>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="team-goals-toolbar">
        <div className="team-chips-wrap">
          {teamListOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`team-chip-btn ${selectedTeam === opt ? "active" : ""}`}
              onClick={() => setSelectedTeam(opt)}
            >
              {opt === "all" ? "All Departments" : opt}
            </button>
          ))}
        </div>

        <div className="team-search-wrap">
          <input
            type="text"
            className="team-search-input"
            placeholder="Search team goals, owners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Teams Sections */}
      {loading ? (
        <div className="team-loading-state">
          <div className="team-spinner" />
          <span>Loading Team Goals...</span>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="team-empty-state">
          <Users size={32} />
          <h3>No team goals found</h3>
          <p>Create a goal for this department to start tracking team-level OKRs.</p>
          <button
            type="button"
            className="add-team-goal-hero-btn"
            onClick={() => setIsModalOpen(true)}
          >
            Create Team Goal
          </button>
        </div>
      ) : (
        <div className="teams-grid-container">
          {filteredTeams.map((t) => (
            <div key={t.teamName} className="team-department-card">
              {/* Department Header */}
              <div className="department-header">
                <div className="department-title-col">
                  <div className="department-name-row">
                    <h3 className="department-title">{t.teamName}</h3>
                    <span
                      className={`team-health-badge ${
                        t.health === "On Track"
                          ? "health-good"
                          : t.health === "At Risk"
                          ? "health-risk"
                          : "health-alert"
                      }`}
                    >
                      {t.health}
                    </span>
                  </div>
                  <span className="department-scope-sub">
                    {t.completedGoals} of {t.totalGoals} goals completed ({t.averageProgress}% progress)
                  </span>
                </div>

                <div className="department-progress-meter">
                  <div className="meter-track">
                    <div
                      className="meter-fill"
                      style={{ width: `${t.averageProgress}%` }}
                    />
                  </div>
                  <span className="meter-text">{t.averageProgress}%</span>
                </div>
              </div>

              {/* Department Goals Table */}
              <div className="department-goals-table">
                <div className="dept-table-header">
                  <span className="col-name">Goal Title</span>
                  <span className="col-owner">Owner</span>
                  <span className="col-status">Status</span>
                  <span className="col-progress">Progress</span>
                  <span className="col-period">Period</span>
                  <span className="col-due">Due Date</span>
                </div>

                <div className="dept-table-body">
                  {(t.goals || []).map((goal) => {
                    const st = String(goal.status || "on track").toLowerCase();
                    const ownerName =
                      typeof goal.owner === "string"
                        ? goal.owner
                        : goal.owner?.name || "";
                    return (
                      <div
                        key={goal.id}
                        className="dept-table-row"
                        onClick={() => onNavigateGoal && onNavigateGoal(goal)}
                        title="Click to view details"
                      >
                        <div className="col-name cell-name">
                          <div className="row-goal-title-line">
                            <span className="row-goal-title">{goal.name}</span>
                            {canEditGoals && (
                              <button
                                type="button"
                                className="team-goal-edit-button"
                                aria-label={`Edit ${goal.name}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditGoal({
                                    ...goal,
                                    owner: {
                                      ...(typeof goal.owner === "object"
                                        ? goal.owner
                                        : {}),
                                      name: ownerName,
                                    },
                                  });
                                  setEditError("");
                                }}
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                            )}
                          </div>
                          {goal.statusSummary && (
                            <span className="row-goal-summary">
                              {goal.statusSummary}
                            </span>
                          )}
                        </div>

                        <div className="col-owner cell-owner">
                          <span className="owner-avatar-chip">
                            {goal.owner?.initials || "TM"}
                          </span>
                          <span className="owner-name-text">
                            {goal.owner?.name || "Member"}
                          </span>
                        </div>

                        <div className="col-status cell-status">
                          <span
                            className={`goal-status-pill ${
                              st.includes("risk")
                                ? "status-risk"
                                : st.includes("off")
                                ? "status-off"
                                : st.includes("achiev")
                                ? "status-achieved"
                                : "status-track"
                            }`}
                          >
                            {goal.status}
                          </span>
                        </div>

                        <div className="col-progress cell-progress">
                          <div className="mini-progress-track">
                            <div
                              className="mini-progress-fill"
                              style={{ width: `${goal.progress || 0}%` }}
                            />
                          </div>
                          <span className="progress-num">{goal.progress}%</span>
                        </div>

                        <div className="col-period cell-period">
                          <span className="period-badge">{goal.timePeriod || "Q1 FY26"}</span>
                        </div>

                        <div className="col-due cell-due">
                          <CalendarDays size={13} className="cal-icon" />
                          <span>{goal.dueDate || "No due date"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Team Goal Modal */}
      {isModalOpen && (
        <div className="team-modal-backdrop" onClick={handleCloseCreateModal}>
          <div className="team-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="team-modal-header">
              <h3>Create Team Goal</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseCreateModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeamGoal} className="team-modal-form">
              <label>
                <span>Goal Title *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Expand automated test coverage to 90%"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                />
              </label>

              <div className="form-row-2">
                <label>
                  <span>Department *</span>
                  <select
                    value={newGoal.team}
                    onChange={(e) => setNewGoal({ ...newGoal, team: e.target.value })}
                    required
                  >
                    <option value="" disabled>Select team</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="Product">Product</option>
                    <option value="Operations">Operations</option>
                    <option value="QA & Infrastructure">QA & Infrastructure</option>
                  </select>
                </label>

                <label>
                  <span>Time Period *</span>
                  <select
                    value={newGoal.timePeriod}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, timePeriod: e.target.value })
                    }
                    required
                  >
                    <option value="" disabled>Select time period</option>
                    {GOAL_TIME_PERIODS.map((period) => (
                      <option key={period} value={period}>
                        {period}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row-2">
                <label>
                  <span>Owner Name</span>
                  <input
                    type="text"
                    value={newGoal.ownerName}
                    onChange={(e) =>
                      setNewGoal({
                        ...newGoal,
                        ownerName: e.target.value,
                        ownerInitials: e.target.value.slice(0, 2).toUpperCase(),
                      })
                    }
                  />
                </label>

                <label>
                  <span>Due Date</span>
                  <input
                    type="date"
                    value={getDateInputValue(newGoal.dueDate)}
                    onFocus={(e) => e.currentTarget.showPicker?.()}
                    onChange={(e) =>
                      setNewGoal({
                        ...newGoal,
                        dueDate: formatGoalDate(e.target.value),
                      })
                    }
                  />
                </label>
              </div>

              <label>
                <span>Status Note / Summary</span>
                <textarea
                  rows={2}
                  placeholder="Brief update on current sprint alignment..."
                  value={newGoal.statusSummary}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, statusSummary: e.target.value })
                  }
                />
              </label>

              <div className="team-modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={handleCloseCreateModal}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn">
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editGoal && canEditGoals && (
        <div
          className="team-modal-backdrop"
          onClick={() => !isSavingEdit && setEditGoal(null)}
        >
          <div
            className="team-modal-window"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-team-goal-title"
          >
            <div className="team-modal-header">
              <h3 id="edit-team-goal-title">Edit Team Goal</h3>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Close edit goal"
                disabled={isSavingEdit}
                onClick={() => setEditGoal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeamGoal} className="team-modal-form">
              <label>
                <span>Goal Title *</span>
                <input
                  type="text"
                  required
                  value={editGoal.name || ""}
                  onChange={(e) =>
                    setEditGoal({ ...editGoal, name: e.target.value })
                  }
                />
              </label>

              <div className="form-row-2">
                <label>
                  <span>Status</span>
                  <select
                    value={editGoal.status || "on track"}
                    onChange={(e) =>
                      setEditGoal({ ...editGoal, status: e.target.value })
                    }
                  >
                    <option value="on track">On track</option>
                    <option value="at risk">At risk</option>
                    <option value="off track">Off track</option>
                    <option value="achieved">Achieved</option>
                  </select>
                </label>

                <label>
                  <span>Progress (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={editGoal.progress ?? 0}
                    onChange={(e) =>
                      setEditGoal({
                        ...editGoal,
                        progress: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>

              <div className="form-row-2">
                <label>
                  <span>Period</span>
                  <input
                    type="text"
                    value={editGoal.timePeriod || ""}
                    onChange={(e) =>
                      setEditGoal({ ...editGoal, timePeriod: e.target.value })
                    }
                  />
                </label>

                <label>
                  <span>Due Date</span>
                  <input
                    type="date"
                    value={getDateInputValue(editGoal.dueDate)}
                    onFocus={(e) => e.currentTarget.showPicker?.()}
                    onChange={(e) =>
                      setEditGoal({
                        ...editGoal,
                        dueDate: formatGoalDate(e.target.value),
                      })
                    }
                  />
                </label>
              </div>

              <label>
                <span>Owner</span>
                <input
                  type="text"
                  value={editGoal.owner?.name || ""}
                  onChange={(e) =>
                    setEditGoal({
                      ...editGoal,
                      owner: { ...editGoal.owner, name: e.target.value },
                    })
                  }
                />
              </label>

              {editError && (
                <p className="team-goal-edit-error" role="alert">
                  {editError}
                </p>
              )}

              <div className="team-modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  disabled={isSavingEdit}
                  onClick={() => setEditGoal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={isSavingEdit || !editGoal.name.trim()}
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamGoals;
