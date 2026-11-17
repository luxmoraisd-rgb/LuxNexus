import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  UserSilhouetteIcon,
  TeamSilhouetteIcon,
  ChevronRightIcon,
} from "./Icons";
import "./GoalRow.css";
import "./ProgressBar.css";

const STATUS_CONFIG = {
  "on track": { label: "On track", color: "#bbea10", bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.3)" },
  "at risk": { label: "At risk", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)" },
  "off track": { label: "Off track", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.3)" },
  achieved: { label: "Achieved", color: "#22c55e", bg: "rgba(34, 197, 94, 0.18)", border: "rgba(34, 197, 94, 0.35)" },
};

function usePositionedPopover(isOpen, setIsOpen, triggerRef, popoverRef) {
  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    const positionPopover = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const viewportPadding = 8;
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - popoverRect.width - viewportPadding
      );
      const left = Math.min(Math.max(triggerRect.left, viewportPadding), maxLeft);
      let top = triggerRect.bottom + 4;

      if (top + popoverRect.height > window.innerHeight - viewportPadding) {
        const aboveTop = triggerRect.top - popoverRect.height - 4;
        top =
          aboveTop >= viewportPadding
            ? aboveTop
            : Math.max(
                viewportPadding,
                window.innerHeight - popoverRect.height - viewportPadding
              );
      }

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    };

    const handleOutsidePointerDown = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    positionPopover();
    document.addEventListener("scroll", positionPopover, true);
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", positionPopover);

    return () => {
      document.removeEventListener("scroll", positionPopover, true);
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", positionPopover);
    };
  }, [isOpen, setIsOpen, triggerRef, popoverRef]);
}

function GoalRow({
  goal,
  isSelected = false,
  isBulkSelected = false,
  onSelectGoal,
  onToggleSelection,
  onUpdateGoal,
}) {
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const statusPickerTriggerRef = useRef(null);
  const statusPickerRef = useRef(null);
  const ownerPickerTriggerRef = useRef(null);
  const ownerPickerRef = useRef(null);
  const periodPickerTriggerRef = useRef(null);
  const periodPickerRef = useRef(null);
  const teamPickerTriggerRef = useRef(null);
  const teamPickerRef = useRef(null);

  const statusKey = goal.status ? goal.status.toLowerCase().replace(/_/g, " ") : "";
  const currentStatus = STATUS_CONFIG[statusKey] || null;

  usePositionedPopover(
    showStatusPicker,
    setShowStatusPicker,
    statusPickerTriggerRef,
    statusPickerRef
  );
  usePositionedPopover(
    showOwnerPicker,
    setShowOwnerPicker,
    ownerPickerTriggerRef,
    ownerPickerRef
  );
  usePositionedPopover(
    showPeriodPicker,
    setShowPeriodPicker,
    periodPickerTriggerRef,
    periodPickerRef
  );
  usePositionedPopover(
    showTeamPicker,
    setShowTeamPicker,
    teamPickerTriggerRef,
    teamPickerRef
  );

  const handleRowClick = (e) => {
    if (e.target.closest(".row-checkbox-btn")) return;
    if (e.target.closest(".cell-popover")) return;
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
              onToggleSelection(goal.id);
            }}
            aria-label={isBulkSelected ? "Deselect goal" : "Select goal"}
            aria-pressed={isBulkSelected}
            title={isBulkSelected ? "Deselect goal" : "Select goal"}>
            <span className={`custom-checkbox ${isBulkSelected ? "checked" : ""}`}>
              {isBulkSelected && "✓"}
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
        ref={statusPickerTriggerRef}
        ref={statusPickerTriggerRef}
        style={{
          color: currentStatus.color,
          backgroundColor: currentStatus.bg,
          borderColor: currentStatus.border,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setShowStatusPicker(!showStatusPicker);
        }}>
        <span>{currentStatus.label}</span>
      </button>
    ) : (
      <button
        type="button"
        className="cell-empty-area"
        ref={statusPickerTriggerRef}
        aria-label="Select goal status"
        onClick={(e) => {
          e.stopPropagation();
          setShowStatusPicker(!showStatusPicker);
        }}/>
    )}

    {showStatusPicker &&
      createPortal(
        <div
          ref={statusPickerRef}
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
              }}>
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
        </div>,
        document.body
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
              ref={periodPickerTriggerRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowPeriodPicker(!showPeriodPicker);
              }} >
              {goal.timePeriod}
            </span>
          ) : (
            <span
              className="period-text placeholder"
              ref={periodPickerTriggerRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowPeriodPicker(!showPeriodPicker);
              }}/>
          )}

        </div>
        {showPeriodPicker &&
          createPortal(
            <div
              ref={periodPickerRef}
              className="cell-popover"
              onClick={(e) => e.stopPropagation()}>
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
            </div>,
            document.body
          )}
      </td>

      <td className="goal-cell cell-team">
        <div className="team-container">
          {goal.team ? (
            <span
              className="team-text"
              ref={teamPickerTriggerRef}
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
              ref={teamPickerTriggerRef}
              title="Assign accountable team"
              onClick={(e) => {
                e.stopPropagation();
                setShowTeamPicker(!showTeamPicker);
              }}>
              <TeamSilhouetteIcon size={13} className="dashed-avatar-icon" />
            </button>
          )}

        </div>
        {showTeamPicker &&
          createPortal(
            <div
              ref={teamPickerRef}
              className="cell-popover"
              onClick={(e) => e.stopPropagation()}>
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
                }}>
                Clear team
              </button>
            </div>,
            document.body
          )}
      </td>

      <td className="goal-cell cell-owner">
        <div className="owner-cell-content">
          <div className="owner-container">
            {goal.owner ? (
              <button
                type="button"
                className="owner-assigned-pill"
                ref={ownerPickerTriggerRef}
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
                ref={ownerPickerTriggerRef}
                title="Assign owner"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOwnerPicker(!showOwnerPicker);
                }} >
                <UserSilhouetteIcon size={13} className="dashed-avatar-icon" />
              </button>
            )}

            {showOwnerPicker &&
              createPortal(
                <div
                  ref={ownerPickerRef}
                  className="cell-popover owner-popover"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="popover-title">Assign owner</div>
                  {[
                    { name: "Franklin", initials: "FR", role: "Member" },
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
                </div>,
                document.body
              )}
          </div>

        </div>
      </td>
    </tr>
  );
}

export default GoalRow;
