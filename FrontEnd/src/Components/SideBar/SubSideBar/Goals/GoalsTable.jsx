import React from "react";
import "./GoalsTable.css";
import GoalRow from "./GoalRow";

function GoalsTable({
  goals = [],
  groupBy = "none",
  selectedGoalId = null,
  selectedGoalIds = [],
  onSelectGoal,
  onToggleGoalSelection,
  onUpdateGoal,
}) {
  const groupedGoals = groupBy === "none"
    ? null
    : goals.reduce((groups, goal) => {
        const rawGroupValue = groupBy === "owner"
          ? (typeof goal.owner === "object" ? goal.owner?.name : goal.owner)
          : goal[groupBy];
        const label = String(rawGroupValue || "Unassigned");
        const group = groups.find((item) => item.label === label);
        if (group) {
          group.goals.push(goal);
        } else {
          groups.push({ label, goals: [goal] });
        }
        return groups;
      }, []);

  const renderGoal = (goal) => (
    <GoalRow
      key={goal.id}
      goal={goal}
      isSelected={goal.id === selectedGoalId}
      isBulkSelected={selectedGoalIds.includes(String(goal.id))}
      onSelectGoal={onSelectGoal}
      onToggleSelection={onToggleGoalSelection}
      onUpdateGoal={onUpdateGoal}
    />
  );

  return (
    <div className="goals-table-container">
      <table className="goals-table">
        <thead>
          <tr className="goals-header-row">
            <th className="th-cell th-name">
              <div className="th-content">
                <span>Name</span>
              </div>
            </th>
            <th className="th-cell th-status">
              <div className="th-content">
                <span>Status</span>
              </div>
            </th>
            <th className="th-cell th-progress">
              <div className="th-content">
                <span>Progress</span>
              </div>
            </th>
            <th className="th-cell th-time-period">
              <div className="th-content">
                <span>Time period</span>
              </div>
            </th>
            <th className="th-cell th-team">
              <div className="th-content">
                <span>Accountable team</span>
              </div>
            </th>
            <th className="th-cell th-owner">
              <div className="th-content">
                <span>Owner</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {groupedGoals
            ? groupedGoals.flatMap((group) => [
                <tr className="goal-group-row" key={`group-${group.label}`}>
                  <th colSpan={6} scope="rowgroup">
                    <span>{group.label}</span>
                    <span className="goal-group-count">{group.goals.length}</span>
                  </th>
                </tr>,
                ...group.goals.map(renderGoal),
              ])
            : goals.map(renderGoal)}
        </tbody>
      </table>
    </div>
  );
}

export default GoalsTable;
