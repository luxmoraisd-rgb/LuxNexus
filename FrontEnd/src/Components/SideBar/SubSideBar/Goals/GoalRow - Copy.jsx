import React, { useState } from "react";
import {
  UserSilhouetteIcon,
  TeamSilhouetteIcon,
  ChevronRightIcon,
  TrashIcon,
} from "./Icons";
import "./GoalRow.css";
import "./ProgressBar.css";

const STATUS_CONFIG = {
  "on track": { label: "On track", color: "#bbea10", bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.3)" },
  "at risk": { label: "At risk", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)" },
  "off track": { label: "Off track", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.3)" },
  achieved: { label: "Achieved", color: "#22c55e", bg: "rgba(34, 197, 94, 0.18)", border: "rgba(34, 197, 94, 0.35)" },
};

function GoalRow({
  goal,
  isSelected = false,
  onSelectGoal,
  onUpdateGoal,
  onDeleteGoal,
}) {
  const [isChecked, setIsChecked] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  const statusKey = goal.status ? goal.status.toLowerCase().replace(/_/g, " ") : "";
  const currentStatus = STATUS_CONFIG[statusKey] || null;


  const handleRowClick = (e) => {
    if (e.target.closest(".row-checkbox-btn")) return;
    if (e.target.closest(".cell-popover")) return;
    if (e.target.closest(".row-delete-btn")) return;
    if (e.target.closest(".dashed-avatar-btn")) return;

    if (onSelectGoal) {
      onSelectGoal(goal);
    }
  };

  return (
    <tr
      className={`goal-table-row ${isSelected ? "row-selected" : ""}`}
      onClick={handleRowClick}>
      <td className={`goal-cell cell-name ${isSelected ? "cell-name-selected" : ""}`}>
        <div className="name-cell-content">
          <button
            type="button"
            className="row-checkbox-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsChecked(!isChecked);
            }}
            title={isChecked ? "Uncheck goal" : "Check goal"}>
            <span className={`custom-checkbox ${isChecked ? "checked" : ""}`}>
              {isChecked && "✓"}
            </span>
          </button>

          <span
            className={`cell-name-text ${goal.isPlaceholder ? "placeholder" : ""}`}
            title="Click to view and edit goal">
            {goal.name || "Untitled goal"}
          </span>

          {isSelected && (
            <span className="selected-row-chevron">
              <ChevronRightIcon size={13} />
            </span>
          )}
        </div>
      </td>
      
<td className="goal-cell cell-status">
  <div className="status-container">
    {currentStatus ? (
      <button
        type="button"
        className="status-badge"
        style={{
          color: currentStatus.color,
          backgroundColor: currentStatus.bg,
          borderColor: currentStatus.border,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setShowStatusPicker(!showStatusPicker);
        }}>
        <span
          className="status-dot"
          style={{ backgroundColor: currentStatus.color }}
        />
        <span>{currentStatus.label}</span>
      </button>
    ) : (
      <button
        type="button"
        className="cell-empty-area"
        aria-label="Select goal status"
        onClick={(e) => {
          e.stopPropagation();
          setShowStatusPicker(!showStatusPicker);
        }}/>
    )}

    {showStatusPicker && (
      <div
        className="cell-popover"
        onClick={(e) => e.stopPropagation()}>
        <div className="popover-title">Update status</div>

        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <button
            key={key}
            type="button"
            className="popover-item"
            onClick={() => {
              const progressByStatus = {
                "on track": 75,
                "at risk": 40,
                "off track": 20,
                achieved: 100,
              };

              onUpdateGoal({
                ...goal,
                status: key,
                progress: progressByStatus[key],
                isPlaceholder: false,
              });

              setShowStatusPicker(false);
            }}
          >
            <span
              className="status-dot"
              style={{ backgroundColor: config.color }}/>
            <span>{config.label}</span>
          </button>
        ))}

        <button
          type="button"
          className="popover-item clear"
          onClick={() => {
            onUpdateGoal({
              ...goal,
              status: "",
              isPlaceholder: false,
            });

            setShowStatusPicker(false);
          }}>
          Clear status
        </button>
      </div>
    )}
  </div>
</td>


<td className="goal-cell cell-progress">
  <div className="progress-wrapper">
    <div className="progress-track">
      <div
        className="progress-fill"
        style={{
          width: `${Math.min(
            100,
            Math.max(0, Number(goal.progress) || 0)
          )}%`,
          backgroundColor:
            Number(goal.progress) >= 100
              ? "#22c55e"
              : Number(goal.progress) >= 80
              ? "#86efac"
              : Number(goal.progress) >= 50
              ? "#eab308"
              : Number(goal.progress) >= 30
              ? "#f97316"
              : "#ef4444",
        }}/>
    </div>

    <span className="progress-percentage">
      {Math.min(
        100,
        Math.max(0, Number(goal.progress) || 0)
      )}%
    </span>
  </div>
</td>

      <td className="goal-cell cell-time-period">
        <div className="period-container">
          {goal.timePeriod ? (
            <span
              className="period-text"
              onClick={(e) => {
                e.stopPropagation();
                setShowPeriodPicker(!showPeriodPicker);
              }} >
              {goal.timePeriod}
            </span>
          ) : (
            <span
              className="period-text placeholder"
              onClick={(e) => {
                e.stopPropagation();
                setShowPeriodPicker(!showPeriodPicker);
              }}/>
          )}

          {showPeriodPicker && (
            <div className="cell-popover" onClick={(e) => e.stopPropagation()}>
              <div className="popover-title">Select time period</div>
              {["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26", "Q1 FY27", "Q2 FY27", "Full Year 2026"].map(
                (period) => (
                  <button
                    key={period}
                    type="button"
                    className="popover-item"
                    onClick={() => {
                      onUpdateGoal({
                        ...goal,
                        timePeriod: period,
                        isPlaceholder: false,
                      });
                      setShowPeriodPicker(false);
                    }}>
                    {period}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </td>

      <td className="goal-cell cell-team">
        <div className="team-container">
          {goal.team ? (
            <span
              className="team-text"
              onClick={(e) => {
                e.stopPropagation();
                setShowTeamPicker(!showTeamPicker);
              }}>
              {goal.team}
            </span>
          ) : (
            <button
              type="button"
              className="dashed-avatar-btn"
              title="Assign accountable team"
              onClick={(e) => {
                e.stopPropagation();
                setShowTeamPicker(!showTeamPicker);
              }}>
              <TeamSilhouetteIcon size={13} className="dashed-avatar-icon" />
            </button>
          )}

          {showTeamPicker && (
            <div className="cell-popover" onClick={(e) => e.stopPropagation()}>
              <div className="popover-title">Assign team</div>
              {["Product", "Engineering", "Marketing", "Design", "Sales"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="popover-item"
                  onClick={() => {
                    onUpdateGoal({ ...goal, team: t, isPlaceholder: false });
                    setShowTeamPicker(false);
                  }}>
                  {t}
                </button>
              ))}
              <button
                type="button"
                className="popover-item clear"
                onClick={() => {
                  onUpdateGoal({ ...goal, team: "" });
                  setShowTeamPicker(false);
                }} >
                Clear team
              </button>
            </div>
          )}
        </div>
      </td>

      <td className="goal-cell cell-owner">
        <div className="owner-container">
          {goal.owner ? (
            <button
              type="button"
              className="owner-assigned-pill"
              title={`Owner: ${goal.owner.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowOwnerPicker(!showOwnerPicker);
              }}>
              <span className="owner-avatar-circle small">
                {goal.owner.initials || goal.owner.name[0]}
              </span>
              <span className="owner-name-label">{goal.owner.name}</span>
            </button>
          ) : (
            <button
              type="button"
              className="dashed-avatar-btn"
              title="Assign owner"
              onClick={(e) => {
                e.stopPropagation();
                setShowOwnerPicker(!showOwnerPicker);
              }} >
              <UserSilhouetteIcon size={13} className="dashed-avatar-icon" />
            </button>
          )}

          {showOwnerPicker && (
            <div className="cell-popover owner-popover" onClick={(e) => e.stopPropagation()}>
              <div className="popover-title">Assign owner</div>
              {[
                { name: "Jagadeep", initials: "Ja", role: "Product Manager" },
                { name: "Sarah Chen", initials: "SC", role: "Engineering Lead" },
                { name: "Alex Rivera", initials: "AR", role: "Design Lead" },
              ].map((user) => (
                <button
                  key={user.name}
                  type="button"
                  className="popover-item user-item"
                  onClick={() => {
                    onUpdateGoal({
                      ...goal,
                      owner: user,
                      isPlaceholder: false,
                    });
                    setShowOwnerPicker(false);
                  }}>
                  <span className="owner-avatar-circle small">{user.initials}</span>
                  <span className="user-info">
                    <span className="user-name">{user.name}</span>
                    <span className="user-role">{user.role}</span>
                  </span>
                </button>
              ))}
              {goal.owner && (
                <button
                  type="button"
                  className="popover-item clear"
                  onClick={() => {
                    onUpdateGoal({ ...goal, owner: null });
                    setShowOwnerPicker(false);
                  }}>
                  Unassign owner
                </button>
              )}
            </div>
          )}
        </div>

        {onDeleteGoal && (
          <button
            type="button"
            className="row-delete-btn"
            title="Delete goal"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGoal(goal.id);
            }} >
            <TrashIcon size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}

export default GoalRow;
