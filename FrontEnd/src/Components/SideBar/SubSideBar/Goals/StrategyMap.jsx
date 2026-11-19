import React, { useState, useEffect, useMemo } from "react";
import {
  Compass,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Layers,
  Sparkles,
  CalendarDays,
  User,
  X,
} from "lucide-react";
import Header from "./Header";
import Tabs from "./Tabs";
import GoalDetails from "./GoalDetails";
import { goalsApi } from "./goalsApi";
import { GOAL_TIME_PERIODS } from "./goalFormOptions";
import "./StrategyMap.css";

const getTodayDate = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
};

const formatDueDate = (value) => {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

const getOwnerName = (owner) =>
  typeof owner === "string" ? owner : owner?.name || "Owner";

function StrategyMap({ onSelectTab, currentUser }) {
  const [strategyData, setStrategyData] = useState({ pillars: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [newObjective, setNewObjective] = useState({
    title: "",
    pillarId: "",
    targetPeriod: "",
    owner: "",
    dueDate: getTodayDate(),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await goalsApi.getStrategyMap();
      setStrategyData(data);
    } catch (err) {
      console.error("[StrategyMap] Failed to load strategy map:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pillars = strategyData.pillars || [];
  const metrics = strategyData.metrics || {};
  const currentUserLead = String(
    currentUser?.name ||
      currentUser?.username ||
      currentUser?.email?.split("@")[0] ||
      ""
  )
    .split("@")[0]
    .trim();
  const pillarOwners = pillars.flatMap((pillar) =>
    (pillar.goals || []).map((goal) => getOwnerName(goal.owner))
  );
  const availableLeads = [
    ...new Set([
      currentUserLead,
      "Franklin",
      "Sarah Chen",
      "Alex Rivera",
      "Michael Chang",
      ...pillarOwners,
    ]),
  ]
    .filter(Boolean)
    .filter((name) => name !== "Owner");

  const filteredPillars = useMemo(() => {
    return pillars.map((pillar) => {
      let goals = pillar.goals || [];
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        goals = goals.filter(
          (g) =>
            g.name?.toLowerCase().includes(q) ||
            g.owner?.toLowerCase().includes(q) ||
            g.team?.toLowerCase().includes(q)
        );
      }
      return {
        ...pillar,
        matchingGoals: goals,
      };
    });
  }, [pillars, searchQuery]);

  const handleAddObjective = async (e) => {
    e.preventDefault();
    if (
      !newObjective.title.trim() ||
      !newObjective.pillarId ||
      !newObjective.targetPeriod ||
      !newObjective.owner
    ) {
      return;
    }

    const targetPillar = pillars.find((p) => p.id === newObjective.pillarId);
    if (!targetPillar) return;

    const createdGoal = await goalsApi.createGoal({
      name: newObjective.title.trim(),
      status: "on track",
      progress: 0,
      team: targetPillar.tag || "Engineering",
      owner: newObjective.owner,
      dueDate: newObjective.dueDate,
      timePeriod: newObjective.targetPeriod,
      pillarId: targetPillar.id,
    });
    const newGoalObj = {
      ...createdGoal,
      name: createdGoal.name || newObjective.title.trim(),
      team: createdGoal.team || targetPillar.tag || "Engineering",
      dueDate: createdGoal.dueDate || newObjective.dueDate,
      timePeriod: createdGoal.timePeriod || newObjective.targetPeriod,
    };

    setStrategyData((prev) => {
      const updated = {
        ...prev,
        pillars: prev.pillars.map((pillar) =>
          pillar.id === targetPillar.id
            ? { ...pillar, goals: [newGoalObj, ...(pillar.goals || [])] }
            : pillar
        ),
        metrics: {
          ...prev.metrics,
          totalGoals: (prev.metrics.totalGoals || 0) + 1,
        },
      };
      try {
        localStorage.setItem("nexus_strategy_map_cache", JSON.stringify(updated));
      } catch (error) {
        console.warn("[StrategyMap] Could not cache the updated strategy map:", error);
      }
      return updated;
    });

    setIsAddModalOpen(false);
    setNewObjective({
      title: "",
      pillarId: "",
      targetPeriod: "",
      owner: "",
      dueDate: getTodayDate(),
    });
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setNewObjective((prev) => ({
      ...prev,
      pillarId: "",
      targetPeriod: "",
      owner: "",
    }));
  };

  const handleSaveGoal = async (updatedGoal) => {
    setSelectedGoal(updatedGoal);
    setStrategyData((prev) => {
      const updated = {
        ...prev,
        pillars: prev.pillars.map((pillar) => ({
          ...pillar,
          goals: (pillar.goals || []).map((goal) =>
            goal.id === updatedGoal.id ? { ...goal, ...updatedGoal } : goal
          ),
        })),
      };
      try {
        localStorage.setItem("nexus_strategy_map_cache", JSON.stringify(updated));
      } catch (error) {
        console.warn("[StrategyMap] Could not cache the updated goal:", error);
      }
      return updated;
    });

    setIsSavingGoal(true);
    try {
      const savedGoal = await goalsApi.updateGoal(updatedGoal.id, updatedGoal);
      setSelectedGoal(savedGoal);
      setStrategyData((prev) => ({
        ...prev,
        pillars: prev.pillars.map((pillar) => ({
          ...pillar,
          goals: (pillar.goals || []).map((goal) =>
            goal.id === savedGoal.id ? { ...goal, ...savedGoal } : goal
          ),
        })),
      }));
    } catch (error) {
      console.error("[StrategyMap] Failed to save goal:", error);
    } finally {
      setIsSavingGoal(false);
    }
  };

  return (
    <div className="strategy-map-page">
      <Header title="Strategy Map" />

      <Tabs
        activeTab="Strategy map"
        onSelectTab={(tab) => onSelectTab && onSelectTab(tab)}
      />

      {/* Top Strategic Alignment Strip */}
      <div className="strategy-kpi-banner">
        <div className="kpi-card alignment-card">
          <div className="kpi-icon-wrap indigo">
            <Compass size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Strategic Alignment</span>
            <div className="kpi-value-row">
              <strong className="kpi-value">{metrics.overallAlignment || 78}%</strong>
              <span className="kpi-badge emerald">
                <TrendingUp size={12} />
                High
              </span>
            </div>
            <div className="kpi-progress-bar">
              <div
                className="kpi-progress-fill"
                style={{ width: `${metrics.overallAlignment || 78}%` }}
              />
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap blue">
            <Layers size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Strategic Pillars</span>
            <strong className="kpi-value">{pillars.length || 4}</strong>
            <span className="kpi-subtext">Active corporate themes</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap emerald">
            <Target size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Mapped Goals</span>
            <strong className="kpi-value">{metrics.totalGoals || 8}</strong>
            <span className="kpi-subtext">
              {metrics.onTrackCount || 6} on track • {metrics.atRiskCount || 1} at risk
            </span>
          </div>
        </div>

        <div className="kpi-card action-card">
          <button
            type="button"
            className="add-objective-hero-btn"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} />
            <span>Add Strategic Goal</span>
          </button>
        </div>
      </div>

      {/* Strategy Toolbar */}
      <div className="strategy-toolbar">
        <div className="toolbar-search-wrap">
          <input
            type="text"
            className="strategy-search-input"
            placeholder="Search objectives, teams, owners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="strategy-legend">
          <span className="legend-item">
            <span className="legend-dot on-track" /> On Track
          </span>
          <span className="legend-item">
            <span className="legend-dot at-risk" /> At Risk
          </span>
          <span className="legend-item">
            <span className="legend-dot off-track" /> Off Track
          </span>
          <span className="legend-item">
            <span className="legend-dot achieved" /> Achieved
          </span>
        </div>
      </div>

      {/* Strategic Pillars Visual Grid */}
      {loading ? (
        <div className="strategy-loading-state">
          <div className="strategy-spinner" />
          <span>Generating Strategy Map...</span>
        </div>
      ) : (
        <div className="pillars-grid">
          {filteredPillars.map((pillar, idx) => {
            const goals = pillar.matchingGoals || pillar.goals || [];
            return (
              <div
                key={pillar.id || idx}
                className="pillar-column"
                style={{ "--pillar-accent": pillar.color || "#6366f1" }}
              >
                {/* Pillar Header Card */}
                <div className="pillar-header-card">
                  <div className="pillar-top-strip">
                    <span
                      className="pillar-tag"
                      style={{
                        backgroundColor: `${pillar.color}22`,
                        color: pillar.color,
                        borderColor: `${pillar.color}44`,
                      }}
                    >
                      {pillar.tag || "Pillar"}
                    </span>
                    <span className="pillar-period">{pillar.targetPeriod}</span>
                  </div>

                  <h3 className="pillar-title">{pillar.title}</h3>
                  <p className="pillar-desc">{pillar.description}</p>

                  <div className="pillar-health-row">
                    <div className="pillar-progress-track">
                      <div
                        className="pillar-progress-bar"
                        style={{
                          width: `${pillar.progress || 0}%`,
                          backgroundColor: pillar.color || "#6366f1",
                        }}
                      />
                    </div>
                    <span className="pillar-progress-number">
                      {pillar.progress || 0}%
                    </span>
                  </div>
                </div>

                {/* Connection Bridge */}
                <div className="pillar-connection-line">
                  <span className="connection-node" />
                </div>

                {/* Linked Goals Column */}
                <div className="pillar-goals-container">
                  {goals.length === 0 ? (
                    <div className="pillar-empty-goals">
                      <Sparkles size={16} />
                      <span>No matching objectives</span>
                    </div>
                  ) : (
                    goals.map((goal) => {
                      const st = String(goal.status || "on track").toLowerCase();
                      return (
                        <div
                          key={goal.id}
                          className="strategic-goal-card"
                          onClick={() => setSelectedGoal(goal)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedGoal(goal);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          title="Click to view details"
                        >
                          <div className="goal-card-header">
                            <span
                              className={`goal-status-badge ${
                                st.includes("risk")
                                  ? "at-risk"
                                  : st.includes("off")
                                  ? "off-track"
                                  : st.includes("achiev")
                                  ? "achieved"
                                  : "on-track"
                              }`}
                            >
                              {goal.status}
                            </span>
                            <span className="goal-progress-badge">
                              {goal.progress}%
                            </span>
                          </div>

                          <h4 className="strategic-goal-name">{goal.name}</h4>

                          <div className="goal-card-progress">
                            <div
                              className="goal-bar-fill"
                              style={{ width: `${goal.progress || 0}%` }}
                            />
                          </div>

                          <div className="goal-card-footer">
                            <span className="goal-owner-pill">
                              <User size={11} />
                              <span>{getOwnerName(goal.owner)}</span>
                            </span>
                            {goal.dueDate && (
                              <span className="goal-due-pill">
                                <CalendarDays size={11} />
                                <span>{formatDueDate(goal.dueDate)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <button
                    type="button"
                    className="add-subgoal-btn"
                    onClick={() => {
                      setNewObjective((prev) => ({
                        ...prev,
                        pillarId: pillar.id,
                      }));
                      setIsAddModalOpen(true);
                    }}
                  >
                    <Plus size={13} />
                    <span>Link Objective</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Strategic Objective Modal */}
      {isAddModalOpen && (
        <div className="strategy-modal-backdrop" onClick={handleCloseAddModal}>
          <div className="strategy-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="strategy-modal-header">
              <h3>Create Strategic Objective</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseAddModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddObjective} className="strategy-modal-form">
              <label>
                <span>Objective Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Expand Enterprise Multi-Region Scalability"
                  value={newObjective.title}
                  onChange={(e) =>
                    setNewObjective({ ...newObjective, title: e.target.value })
                  }
                />
              </label>

              <label>
                <span>Align with Strategic Pillar *</span>
                <select
                  value={newObjective.pillarId}
                  onChange={(e) =>
                    setNewObjective({
                      ...newObjective,
                      pillarId: e.target.value,
                    })
                  }
                  required
                >
                  <option value="" disabled>Select a strategic pillar</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.tag})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row-2">
                <label>
                  <span>Target Timeframe *</span>
                  <select
                    value={newObjective.targetPeriod}
                    onChange={(e) =>
                      setNewObjective({
                        ...newObjective,
                        targetPeriod: e.target.value,
                      })
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
                <label>
                  <span>Accountable Lead *</span>
                  <select
                    value={newObjective.owner}
                    onChange={(e) =>
                      setNewObjective({
                        ...newObjective,
                        owner: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="" disabled>Select accountable lead</option>
                    {availableLeads.map((lead) => (
                      <option key={lead} value={lead}>
                        {lead}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                <span>Due Date</span>
                <input
                  type="date"
                  value={newObjective.dueDate}
                  min={getTodayDate()}
                  onChange={(e) =>
                    setNewObjective({
                      ...newObjective,
                      dueDate: e.target.value,
                    })
                  }
                />
              </label>

              <div className="strategy-modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={handleCloseAddModal}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn">
                  Add to Strategy Map
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedGoal && (
        <div
          className="strategy-goal-details-overlay"
          onClick={() => setSelectedGoal(null)}
        >
          <aside
            className="strategy-goal-details-panel"
            aria-label="Goal Details Panel"
            onClick={(event) => event.stopPropagation()}
          >
            <GoalDetails
              goal={selectedGoal}
              onClose={() => setSelectedGoal(null)}
              onSave={handleSaveGoal}
            />
            {isSavingGoal && (
              <span className="strategy-goal-save-status" role="status">
                Saving...
              </span>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default StrategyMap;
