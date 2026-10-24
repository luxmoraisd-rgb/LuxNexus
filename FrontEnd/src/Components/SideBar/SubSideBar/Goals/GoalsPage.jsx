import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./Global.css";
import Header from "./Header";
import Tabs from "./Tabs";
import GoalsToolbar from "./GoalsToolbar";
import GoalsTable from "./GoalsTable";
import GoalDetails from "./GoalDetails";
import CreateGoalModal from "./CreateGoalModal";
import StrategyMap from "./StrategyMap";
import TeamGoals from "./TeamGoals";
import { goalsApi } from "./goalsApi";

function GoalsPage({ currentUser, rolePermissions, initialTab = "My goals" }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentSort, setCurrentSort] = useState("default");
  const [filterCount, setFilterCount] = useState(0);

  const currentUserName = currentUser?.name || currentUser?.username || "You";

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await goalsApi.getGoals();
      setGoals(data);
    } catch (err) {
      console.error("[GoalsPage] Failed to load goals:", err);
      setError("Unable to load goals. Displaying offline data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // Handle Tab Switching
  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setSelectedGoal(null);
  };

  // Create Goal
  const handleCreateGoal = async (newGoalData) => {
    try {
      const created = await goalsApi.createGoal({
        ...newGoalData,
        owner: newGoalData.owner || {
          name: currentUserName,
          initials: currentUserName.slice(0, 2).toUpperCase(),
          role: currentUser?.role || "Member",
        },
      });
      setGoals((prev) => [created, ...prev.filter((g) => g.id !== created.id)]);
      setSelectedGoal(created);
    } catch (err) {
      console.error("[GoalsPage] Create goal error:", err);
    }
  };

  // Update Goal
  const handleUpdateGoal = async (updatedGoal) => {
    try {
      setGoals((prev) =>
        prev.map((g) => (g.id === updatedGoal.id ? { ...g, ...updatedGoal } : g))
      );
      if (selectedGoal && selectedGoal.id === updatedGoal.id) {
        setSelectedGoal((prev) => ({ ...prev, ...updatedGoal }));
      }
      const saved = await goalsApi.updateGoal(updatedGoal.id, updatedGoal);
      setGoals((prev) => prev.map((g) => (g.id === saved.id ? saved : g)));
      if (selectedGoal && selectedGoal.id === saved.id) {
        setSelectedGoal(saved);
      }
    } catch (err) {
      console.error("[GoalsPage] Update goal error:", err);
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (goalId) => {
    if (window.confirm("Are you sure you want to delete this goal?")) {
      try {
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
        if (selectedGoal && selectedGoal.id === goalId) {
          setSelectedGoal(null);
        }
        await goalsApi.deleteGoal(goalId);
      } catch (err) {
        console.error("[GoalsPage] Delete goal error:", err);
      }
    }
  };

  // Inline Goal Add
  const handleAddInlineGoal = () => {
    setIsCreateModalOpen(true);
  };

  // Toggle Selection
  const handleSelectGoal = (goal) => {
    if (selectedGoal && selectedGoal.id === goal.id) {
      setSelectedGoal(null);
    } else {
      setSelectedGoal(goal);
    }
  };

  // Filter & Sort Goals
  const visibleGoals = useMemo(() => {
    let result = [...goals];

    // Filter for My Goals tab
    if (activeTab === "My goals") {
      const myGoals = result.filter((g) => {
        if (!g.owner) return false;
        const ownerName = typeof g.owner === "object" ? g.owner.name : String(g.owner);
        return (
          ownerName?.toLowerCase().includes("jagadeep") ||
          (currentUserName && ownerName?.toLowerCase().includes(currentUserName.toLowerCase()))
        );
      });
      if (myGoals.length > 0) {
        result = myGoals;
      }
    }

    // Sort
    if (currentSort === "name") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (currentSort === "progress") {
      result.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    } else if (currentSort === "status") {
      result.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
    }

    return result;
  }, [goals, activeTab, currentSort, currentUserName]);

  // If Strategy Map tab is active
  if (activeTab === "Strategy map") {
    return (
      <div className="goals-page-wrapper">
        <StrategyMap
          onSelectTab={handleSelectTab}
          onNavigateGoal={handleSelectGoal}
        />
      </div>
    );
  }

  // If Team Goals tab is active
  if (activeTab === "Team goals") {
    return (
      <div className="goals-page-wrapper">
        <TeamGoals
          onSelectTab={handleSelectTab}
          onNavigateGoal={handleSelectGoal}
        />
      </div>
    );
  }

  return (
    <div className="goals-page-wrapper">
      <Header title="My Goals" />

      <Tabs
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onAddTab={() => setIsCreateModalOpen(true)}
      />

      <GoalsToolbar
        onCreateGoal={() => setIsCreateModalOpen(true)}
        filterCount={filterCount}
        onClearFilter={() => setFilterCount(0)}
        onSortChange={setCurrentSort}
        currentSort={currentSort}
        isDetailsOpen={Boolean(selectedGoal)}
      />

      <div className="goals-content-layout">
        <div className="goals-table-area">
          {loading ? (
            <div className="goals-loading-state">
              <div className="goals-spinner" />
              <span>Loading goals...</span>
            </div>
          ) : error ? (
            <div className="goals-error-state">
              <p>{error}</p>
              <button
                type="button"
                className="goals-retry-btn"
                onClick={loadGoals}
              >
                Retry
              </button>
            </div>
          ) : visibleGoals.length === 0 ? (
            <div className="goals-empty-state">
              <p>No goals found for this view.</p>
              <button
                type="button"
                className="goals-retry-btn"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create your first goal
              </button>
            </div>
          ) : (
            <GoalsTable
              goals={visibleGoals}
              selectedGoalId={selectedGoal?.id}
              onSelectGoal={handleSelectGoal}
              onUpdateGoal={handleUpdateGoal}
              onDeleteGoal={handleDeleteGoal}
              onAddInlineGoal={handleAddInlineGoal}
            />
          )}
        </div>

        {selectedGoal && (
          <aside className="goals-details-sidebar" aria-label="Goal Details Panel">
            <GoalDetails
              goal={selectedGoal}
              onClose={() => setSelectedGoal(null)}
              onSave={handleUpdateGoal}
            />
          </aside>
        )}
      </div>

      <CreateGoalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateGoal={handleCreateGoal}
      />
    </div>
  );
}

export default GoalsPage;
