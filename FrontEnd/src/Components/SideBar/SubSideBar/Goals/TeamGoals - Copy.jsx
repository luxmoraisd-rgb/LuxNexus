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
} from "lucide-react";
import Header from "./Header";
import Tabs from "./Tabs";
import { goalsApi } from "./goalsApi";
import "./TeamGoals.css";

function TeamGoals({ onSelectTab, onNavigateGoal }) {
  const [teamData, setTeamData] = useState({ teams: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: "",
    team: "Engineering",
    timePeriod: "Q1 FY26",
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
    if (!newGoal.name.trim()) return;

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
      team: "Engineering",
      timePeriod: "Q1 FY26",
      ownerName: "Franklin",
      ownerInitials: "FR",
      dueDate: "Apr 30, 2026",
      statusSummary: "Initiated sprint planning and task breakdowns.",
    });
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
                    return (
                      <div
                        key={goal.id}
                        className="dept-table-row"
                        onClick={() => onNavigateGoal && onNavigateGoal(goal)}
                        title="Click to view details"
                      >
                        <div className="col-name cell-name">
                          <span className="row-goal-title">{goal.name}</span>
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
        <div className="team-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="team-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="team-modal-header">
              <h3>Create Team Goal</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
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
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="Product">Product</option>
                    <option value="Operations">Operations</option>
                    <option value="QA & Infrastructure">QA & Infrastructure</option>
                  </select>
                </label>

                <label>
                  <span>Time Period</span>
                  <input
                    type="text"
                    value={newGoal.timePeriod}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, timePeriod: e.target.value })
                    }
                  />
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
                    type="text"
                    placeholder="e.g. May 30, 2026"
                    value={newGoal.dueDate}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, dueDate: e.target.value })
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
                  onClick={() => setIsModalOpen(false)}
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
    </div>
  );
}

export default TeamGoals;
