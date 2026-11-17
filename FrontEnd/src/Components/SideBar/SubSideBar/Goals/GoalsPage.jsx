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

function downloadGoalsExport(goals, format) {
  const columns = [
    { header: "Name", value: (goal) => goal.name || "Untitled goal" },
    { header: "Status", value: (goal) => goal.status || "" },
    { header: "Progress", value: (goal) => Number(goal.progress) || 0 },
    { header: "Time period", value: (goal) => goal.timePeriod || "" },
    { header: "Accountable team", value: (goal) => goal.team || "" },
    {
      header: "Owner",
      value: (goal) =>
        typeof goal.owner === "object" ? goal.owner?.name || "" : goal.owner || "",
    },
  ];
  const rows = [
    columns.map((column) => column.header),
    ...goals.map((goal) => columns.map((column) => column.value(goal))),
  ];
  const escapeCsvValue = (value) => {
    const text = String(value ?? "");
    const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const escapeXmlValue = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  let content;
  let mimeType;
  let fileExtension;
  if (format === "csv") {
    content = `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")}`;
    mimeType = "text/csv;charset=utf-8";
    fileExtension = "csv";
  } else {
    const excelRows = rows
      .map((row, rowIndex) => {
        const cells = row
          .map((value, columnIndex) => {
            const isProgressCell = rowIndex > 0 && columnIndex === 2;
            const type = isProgressCell ? "Number" : "String";
            return `<Cell><Data ss:Type="${type}">${escapeXmlValue(value)}</Data></Cell>`;
          })
          .join("");
        return `<Row>${cells}</Row>`;
      })
      .join("");
    content = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Goals"><Table>${excelRows}</Table></Worksheet></Workbook>`;
    mimeType = "application/vnd.ms-excel;charset=utf-8";
    fileExtension = "xls";
  }

  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = objectUrl;
  downloadLink.download = `goals.${fileExtension}`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

const normalizeOwnerIdentity = (value) => String(value ?? "").trim().toLowerCase();

function GoalsPage({ currentUser, rolePermissions, initialTab = "My goals" }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedGoalIds, setSelectedGoalIds] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentSort, setCurrentSort] = useState("default");
  const [currentGroup, setCurrentGroup] = useState("none");
  const [filterCount, setFilterCount] = useState(0);
  const [showCompletedGoals, setShowCompletedGoals] = useState(false);

  const currentUserName = (
    currentUser?.name ||
    currentUser?.username ||
    currentUser?.email?.split("@")[0] ||
    "Franklin"
  )
    .split("@")[0]
    .trim();
  const currentUserEmail = currentUser?.email?.trim().toLowerCase();

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
    if (tab === "My goals") {
      void loadGoals();
    }
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

  const handleToggleGoalSelection = (goalId) => {
    const id = String(goalId);
    setSelectedGoalIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedGoals = async () => {
    const selectedIds = selectedGoalIds;
    if (
      selectedIds.length === 0 ||
      !window.confirm(`Are you sure you want to delete ${selectedIds.length} selected goals?`)
    ) {
      return;
    }

    const idsToDelete = new Set(selectedIds);
    setGoals((prev) => prev.filter((goal) => !idsToDelete.has(String(goal.id))));
    setSelectedGoalIds([]);
    if (selectedGoal && idsToDelete.has(String(selectedGoal.id))) {
      setSelectedGoal(null);
    }

    try {
      await Promise.all(selectedIds.map((id) => goalsApi.deleteGoal(id)));
    } catch (err) {
      console.error("[GoalsPage] Bulk delete goals error:", err);
    }
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

    if (!showCompletedGoals) {
      result = result.filter((goal) => {
        const status = String(goal.status || "").toLowerCase().replace(/_/g, " ");
        const isCompleted =
          status === "achieved" ||
          status === "complete" ||
          status === "completed" ||
          Number(goal.progress) >= 100;
        return !isCompleted;
      });
    }

    // Filter for My Goals tab
    if (activeTab === "My goals") {
      const currentUserIdentities = new Set(
        [
          currentUser?.id,
          currentUser?.username,
          currentUser?.userId,
          currentUser?.user_id,
          currentUser?.name,
          currentUserName,
          currentUserEmail,
          currentUserEmail?.split("@")[0],
        ]
          .map(normalizeOwnerIdentity)
          .filter(Boolean)
      );
      result = result.filter((goal) => {
        if (!goal.owner) return false;
        const ownerIdentities =
          typeof goal.owner === "object"
            ? [
                goal.owner.name,
                goal.owner.email,
                goal.owner.id,
                goal.owner.username,
                goal.owner.userId,
                goal.owner.user_id,
              ]
            : [goal.owner];
        return ownerIdentities.some((identity) =>
          currentUserIdentities.has(normalizeOwnerIdentity(identity))
        );
      });
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
  }, [
    goals,
    activeTab,
    currentSort,
    currentUser,
    currentUserName,
    currentUserEmail,
    showCompletedGoals,
  ]);

  const allVisibleGoalsSelected =
    visibleGoals.length > 0 &&
    visibleGoals.every((goal) => selectedGoalIds.includes(String(goal.id)));

  const handleToggleAllVisibleGoals = () => {
    const visibleIds = visibleGoals.map((goal) => String(goal.id));
    const visibleIdSet = new Set(visibleIds);
    setSelectedGoalIds((prev) => {
      const otherSelectedIds = prev.filter((id) => !visibleIdSet.has(id));
      return allVisibleGoalsSelected
        ? otherSelectedIds
        : [...otherSelectedIds, ...visibleIds];
    });
  };

  const handleExportGoals = (format) => downloadGoalsExport(visibleGoals, format);

  // If Strategy Map tab is active
  if (activeTab === "Strategy map") {
    return (
      <div className="goals-page-wrapper">
        <StrategyMap
          onSelectTab={handleSelectTab}
        />
      </div>
    );
  }

  // If Team Goals tab is active
  if (activeTab === "Team goals") {
    return (
      <div className="goals-page-wrapper">
        <div className="goals-content-layout">
          <TeamGoals
            onSelectTab={handleSelectTab}
            onNavigateGoal={handleSelectGoal}
            currentUser={currentUser}
          />
          {selectedGoal && (
            <aside className="goals-details-sidebar" aria-label="Goal Details Panel">
              <GoalDetails
                goal={selectedGoal}
                onClose={() => setSelectedGoal(null)}
              />
            </aside>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="goals-page-wrapper">
      <Header title="My Goals" />

      <Tabs
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      />

      <GoalsToolbar
        onCreateGoal={() => setIsCreateModalOpen(true)}
        onToggleSelectAll={handleToggleAllVisibleGoals}
        allVisibleGoalsSelected={allVisibleGoalsSelected}
        hasVisibleGoals={visibleGoals.length > 0}
        filterCount={filterCount}
        onClearFilter={() => setFilterCount(0)}
        onSortChange={setCurrentSort}
        currentSort={currentSort}
        onGroupChange={setCurrentGroup}
        currentGroup={currentGroup}
        showCompletedGoals={showCompletedGoals}
        onToggleCompletedGoals={() => setShowCompletedGoals((show) => !show)}
        onExportGoals={handleExportGoals}
        selectedGoalCount={selectedGoalIds.length}
        onDeleteSelectedGoals={handleDeleteSelectedGoals}
        onClearSelectedGoals={() => setSelectedGoalIds([])}
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
              groupBy={currentGroup}
              selectedGoalId={selectedGoal?.id}
              selectedGoalIds={selectedGoalIds}
              onSelectGoal={handleSelectGoal}
              onToggleGoalSelection={handleToggleGoalSelection}
              onUpdateGoal={handleUpdateGoal}
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
        currentUser={currentUser}
      />
    </div>
  );
}

export default GoalsPage;
