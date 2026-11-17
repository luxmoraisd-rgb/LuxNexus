import React, { useEffect, useRef, useState } from "react";
import "./GoalsToolbar.css";
import {
  PlusIcon,
  FilterIcon,
  CloseIcon,
  SortIcon,
  GroupIcon,
  OptionsIcon,
  TrashIcon,
} from "./Icons";

function GoalsToolbar({
  onCreateGoal,
  onToggleSelectAll,
  allVisibleGoalsSelected = false,
  hasVisibleGoals = false,
  filterCount = 1,
  onClearFilter,
  onSortChange,
  currentSort = "default",
  onGroupChange,
  currentGroup = "none",
  showCompletedGoals = false,
  onToggleCompletedGoals,
  onExportGoals,
  selectedGoalCount = 0,
  onDeleteSelectedGoals,
  onClearSelectedGoals,
  isDetailsOpen = false,
}) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const toolbarRef = useRef(null);

  useEffect(() => {
    if (!showSortMenu && !showGroupMenu && !showOptionsMenu) return undefined;

    const handlePointerDown = (event) => {
      if (!toolbarRef.current?.contains(event.target)) {
        setShowSortMenu(false);
        setShowGroupMenu(false);
        setShowOptionsMenu(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowSortMenu(false);
        setShowGroupMenu(false);
        setShowOptionsMenu(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSortMenu, showGroupMenu, showOptionsMenu]);

  return (
    <div
      ref={toolbarRef}
      className={`goals-toolbar ${isDetailsOpen ? "details-open" : ""}`}>
      <div className="toolbar-left">
        <button
          className="create-goal-btn"
          onClick={onCreateGoal}
          type="button">
          <PlusIcon size={14} className="create-goal-icon" />
          <span>Create goal</span>
        </button>
        <button
          className="toolbar-action-btn select-all-btn"
          onClick={onToggleSelectAll}
          type="button"
          disabled={!hasVisibleGoals}
          aria-pressed={allVisibleGoalsSelected}>
          {allVisibleGoalsSelected ? "Deselect all" : "Select all"}
        </button>
        {selectedGoalCount > 0 && (
          <div className="bulk-selection-actions">
            <span>{selectedGoalCount} selected</span>
            <button
              className="bulk-delete-btn"
              onClick={onDeleteSelectedGoals}
              type="button">
              <TrashIcon size={14} />
              <span>Delete</span>
            </button>
            <button
              className="bulk-clear-btn"
              onClick={onClearSelectedGoals}
              type="button">
              Clear
            </button>
          </div>
        )}
      </div>

      {!isDetailsOpen && (
        <div className="toolbar-right">
          {filterCount > 0 && (
            <div className="filter-pill">
              <FilterIcon size={13} className="filter-icon" />
              <span className="filter-text">Filters: {filterCount}</span>
              <button
                className="filter-clear-btn"
                onClick={onClearFilter}
                title="Clear filters"
                type="button">
                <CloseIcon size={11} />
              </button>
            </div>
          )}

          <div className="dropdown-wrapper">
            <button
              className={`toolbar-action-btn ${showSortMenu ? "active" : ""}`}
              aria-expanded={showSortMenu}
              onClick={() => {
                setShowSortMenu((isOpen) => !isOpen);
                setShowGroupMenu(false);
                setShowOptionsMenu(false);
              }}
              type="button" >
              <SortIcon size={14} />
              <span>Sort</span>
            </button>
            {showSortMenu && (
              <div className="action-dropdown-menu">
                <div className="dropdown-header">Sort by</div>
                <button
                  className={`dropdown-item ${currentSort === "default" ? "selected" : ""}`}
                  onClick={() => {
                    onSortChange && onSortChange("default");
                    setShowSortMenu(false);
                  }} >
                  None (Manual order)
                </button>
                <button
                  className={`dropdown-item ${currentSort === "name" ? "selected" : ""}`}
                  onClick={() => {
                    onSortChange && onSortChange("name");
                    setShowSortMenu(false);
                  }} >
                  Goal Name
                </button>
                <button
                  className={`dropdown-item ${currentSort === "progress" ? "selected" : ""}`}
                  onClick={() => {
                    onSortChange && onSortChange("progress");
                    setShowSortMenu(false);
                  }}>
                  Progress
                </button>
                <button
                  className={`dropdown-item ${currentSort === "status" ? "selected" : ""}`}
                  onClick={() => {
                    onSortChange && onSortChange("status");
                    setShowSortMenu(false);
                  }} >
                  Status
                </button>
              </div>
            )}
          </div>

          <div className="dropdown-wrapper">
            <button
              className={`toolbar-action-btn ${showGroupMenu ? "active" : ""}`}
              aria-expanded={showGroupMenu}
              onClick={() => {
                setShowGroupMenu((isOpen) => !isOpen);
                setShowSortMenu(false);
                setShowOptionsMenu(false);
              }}
              type="button">
              <GroupIcon size={14} />
              <span>Group</span>
            </button>
            {showGroupMenu && (
              <div className="action-dropdown-menu">
                <div className="dropdown-header">Group by</div>
                {[
                  ["none", "None"],
                  ["status", "Status"],
                  ["team", "Team"],
                  ["owner", "Owner"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`dropdown-item ${currentGroup === value ? "selected" : ""}`}
                    onClick={() => {
                      onGroupChange && onGroupChange(value);
                      setShowGroupMenu(false);
                    }}
                    type="button">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="dropdown-wrapper">
            <button
              className={`toolbar-action-btn ${showOptionsMenu ? "active" : ""}`}
              aria-expanded={showOptionsMenu}
              onClick={() => {
                setShowOptionsMenu((isOpen) => !isOpen);
                setShowSortMenu(false);
                setShowGroupMenu(false);
              }}
              type="button">
              <OptionsIcon size={14} />
              <span>Options</span>
            </button>
            {showOptionsMenu && (
              <div className="action-dropdown-menu">
                <div className="dropdown-header">View Options</div>
                <button
                  className="dropdown-item"
                  aria-pressed={showCompletedGoals}
                  onClick={() => {
                    onToggleCompletedGoals && onToggleCompletedGoals();
                    setShowOptionsMenu(false);
                  }}
                  type="button">
                  {showCompletedGoals ? "Hide completed goals" : "Show completed goals"}
                </button>
                <div className="dropdown-header">Export goals</div>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    onExportGoals && onExportGoals("csv");
                    setShowOptionsMenu(false);
                  }}
                  type="button">
                  Export CSV
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    onExportGoals && onExportGoals("excel");
                    setShowOptionsMenu(false);
                  }}
                  type="button">
                  Export Excel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GoalsToolbar;
