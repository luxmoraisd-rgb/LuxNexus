import React from "react";
import "./GoalsTable.css";
import GoalRow from "./GoalRow";
import { PlusIcon } from "./Icons";

function GoalsTable({
  goals = [],
  selectedGoalId = null,
  onSelectGoal,
  onUpdateGoal,
  onDeleteGoal,
  onAddInlineGoal,
}) {
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
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              isSelected={goal.id === selectedGoalId}
              onSelectGoal={onSelectGoal}
              onUpdateGoal={onUpdateGoal}
              onDeleteGoal={onDeleteGoal} />
          ))}

          <tr className="goal-inline-add-row" onClick={onAddInlineGoal}>
            <td colSpan="6" className="inline-add-cell">
              <div className="inline-add-content">
                <PlusIcon size={13} className="inline-add-icon" />
                <span>Add goal...</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default GoalsTable;
