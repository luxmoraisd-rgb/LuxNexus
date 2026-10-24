import React, { useState } from "react";
import "./GoalsToolbar.css";
import {
  PlusIcon,
  FilterIcon,
  CloseIcon,
  SortIcon,
  GroupIcon,
  OptionsIcon,
} from "./Icons";

function GoalsToolbar({
  onCreateGoal,
  filterCount = 1,
  onClearFilter,
  onSortChange,
  currentSort = "default",
  isDetailsOpen = false,
}) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  return (
    <div className={`goals-toolbar ${isDetailsOpen ? "details-open" : ""}`}>
      <div className="toolbar-left">
        <button
          className="create-goal-btn"
          onClick={onCreateGoal}
          type="button">
          <PlusIcon size={14} className="create-goal-icon" />
          <span>Create goal</span>
        </button>
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
              onClick={() => setShowSortMenu(!showSortMenu)}
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

          <button className="toolbar-action-btn" type="button">
            <GroupIcon size={14} />
            <span>Group</span>
          </button>

          <div className="dropdown-wrapper">
            <button
              className={`toolbar-action-btn ${showOptionsMenu ? "active" : ""}`}
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              type="button">
              <OptionsIcon size={14} />
              <span>Options</span>
            </button>
            {showOptionsMenu && (
              <div className="action-dropdown-menu">
                <div className="dropdown-header">View Options</div>
                <button
                  className="dropdown-item"
                  onClick={() => setShowOptionsMenu(false)} >
                  Show completed goals
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => setShowOptionsMenu(false)}>
                  Export CSV / Excel
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
