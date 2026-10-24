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
import { goalsApi } from "./goalsApi";
import "./StrategyMap.css";

function StrategyMap({ onSelectTab, onNavigateGoal }) {
  const [strategyData, setStrategyData] = useState({ pillars: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newObjective, setNewObjective] = useState({
    title: "",
    pillarId: "",
    targetPeriod: "Q2 FY26",
    owner: "Engineering Lead",
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
    if (!newObjective.title.trim()) return;

    const targetPillar = pillars.find((p) => p.id === newObjective.pillarId) || pillars[0];
    const newGoalObj = {
      id: `sm-goal-${Date.now()}`,
      name: newObjective.title.trim(),
      status: "on track",
      progress: 0,
      team: targetPillar?.tag || "Engineering",
      owner: newObjective.owner,
      dueDate: "Jun 30, 2026",
    };

    const updatedPillars = pillars.map((p) => {
      if (p.id === targetPillar?.id) {
        return {
          ...p,
          goals: [newGoalObj, ...(p.goals || [])],
        };
      }
      return p;
    });

    setStrategyData((prev) => ({
      ...prev,
      pillars: updatedPillars,
      metrics: {
        ...prev.metrics,
        totalGoals: (prev.metrics.totalGoals || 0) + 1,
      },
    }));

    setIsAddModalOpen(false);
    setNewObjective({
      title: "",
      pillarId: "",
      targetPeriod: "Q2 FY26",
      owner: "Engineering Lead",
    });
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
                          onClick={() => onNavigateGoal && onNavigateGoal(goal)}
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
                              <span>{goal.owner || "Owner"}</span>
                            </span>
                            {goal.dueDate && (
                              <span className="goal-due-pill">
                                <CalendarDays size={11} />
                                <span>{goal.dueDate}</span>
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
        <div className="strategy-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="strategy-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="strategy-modal-header">
              <h3>Create Strategic Objective</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
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
                  value={newObjective.pillarId || pillars[0]?.id || ""}
                  onChange={(e) =>
                    setNewObjective({
                      ...newObjective,
                      pillarId: e.target.value,
                    })
                  }
                >
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.tag})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row-2">
                <label>
                  <span>Target Timeframe</span>
                  <input
                    type="text"
                    value={newObjective.targetPeriod}
                    onChange={(e) =>
                      setNewObjective({
                        ...newObjective,
                        targetPeriod: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span>Accountable Lead</span>
                  <input
                    type="text"
                    value={newObjective.owner}
                    onChange={(e) =>
                      setNewObjective({
                        ...newObjective,
                        owner: e.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="strategy-modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsAddModalOpen(false)}
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
    </div>
  );
}

export default StrategyMap;
