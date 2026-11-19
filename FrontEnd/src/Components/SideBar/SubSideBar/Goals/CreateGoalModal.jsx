import { useState, useEffect, useCallback } from "react";
import "./CreateGoalModel.css";
import { CloseIcon } from "./Icons";
import { GOAL_TIME_PERIODS } from "./goalFormOptions";

const OTHER_OWNERS = [
  { id: "2", name: "Sarah Chen", role: "Engineering Lead" },
  { id: "3", name: "Alex Rivera", role: "Design Lead" },
  { id: "4", name: "Michael Chang", role: "Operations" },
];

const getCurrentOwner = (currentUser) => {
  const accountName =
    currentUser?.name ||
    currentUser?.username ||
    currentUser?.email?.split("@")[0] ||
    "Franklin";
  const name = accountName.split("@")[0].trim();
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    id: `current-${currentUser?.id || currentUser?.email || "user"}`,
    name: displayName,
    role: currentUser?.role || "Member",
    email: currentUser?.email,
  };
};

const TEAMS = [
  "Product",
  "Engineering",
  "Developer",
  "Marketing",
  "Sales",
  "Operations",
];

function CreateGoalModal({ isOpen, onClose, onCreateGoal, currentUser }) {
  const [goalName, setGoalName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [timePeriod, setTimePeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");
  const [team, setTeam] = useState("");
  const [progress, setProgress] = useState(0);
  const [privacy, setPrivacy] = useState("public");
  const availableOwners = [getCurrentOwner(currentUser), ...OTHER_OWNERS];

  const resetDropdowns = useCallback(() => {
    setOwnerId("");
    setTimePeriod("");
    setTeam("");
    setStatus("");
  }, []);

  const handleClose = useCallback(() => {
    resetDropdowns();
    onClose();
  }, [onClose, resetDropdowns]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!goalName.trim()) return;
    if (!ownerId || !timePeriod || !team || !status) return;
    if (!startDate || !endDate) {
      setDateError("Select both a start date and an end date.");
      return;
    }
    if (endDate < startDate) {
      setDateError("End date must be on or after the start date.");
      return;
    }
    setDateError("");

    const selectedOwner = ownerId
      ? availableOwners.find((owner) => owner.id === ownerId) || null
      : null;
    if (!selectedOwner) return;

    onCreateGoal({
      name: goalName.trim(),
      description: description.trim(),
      status,
      progress: Number(progress) || 0,
      timePeriod,
      startDate,
      endDate,
      team,
      owner: selectedOwner,
      privacy: privacy || "public",
      isPlaceholder: false,
    });


    setGoalName("");
    setDescription("");
    setProgress(0);
    handleClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true" >

        <div className="modal-header">
          <h2 className="modal-title">Create goal</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label" htmlFor="goal-name">
              Goal title <span className="required-star">*</span>
            </label>
            <input
              id="goal-name"
              type="text"
              className="form-input"
              placeholder="e.g. Launch new initiative"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              autoFocus
              required/>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="goal-description">
              Description
            </label>
            <textarea
              id="goal-description"
              className="form-textarea"
              placeholder="Describe the goal and the outcome you want to achieve"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="goal-start-date">
                Start date <span className="required-star">*</span>
              </label>
              <input
                id="goal-start-date"
                type="date"
                className="form-input"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateError("");
                }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="goal-end-date">
                End date <span className="required-star">*</span>
              </label>
              <input
                id="goal-end-date"
                type="date"
                className="form-input"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateError("");
                }}
                required
              />
            </div>
          </div>
          {dateError && (
            <p className="goal-date-error" role="alert">
              {dateError}
            </p>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="goal-owner">
                Owner <span className="required-star">*</span>
              </label>
              <div className="select-wrapper">
                <select
                  id="goal-owner"
                  className="form-select"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  required
                >
                  <option value="" disabled>Select owner</option>
                  {availableOwners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name} ({owner.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="goal-period">
                Time period <span className="required-star">*</span>
              </label>
              <div className="select-wrapper">
                <select
                  id="goal-period"
                  className="form-select"
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  required
                >
                  <option value="" disabled>Select time period</option>
                  {GOAL_TIME_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="goal-team">
                Accountable team <span className="required-star">*</span>
              </label>
              <div className="select-wrapper">
                <select
                  id="goal-team"
                  className="form-select"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  required
                >
                  <option value="" disabled>Select team</option>
                  {TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="goal-status">
                Initial status <span className="required-star">*</span>
              </label>
              <div className="select-wrapper">
                <select
                  id="goal-status"
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  required
                >
                  <option value="" disabled>Select status</option>
                  <option value="on track">On track</option>
                  <option value="at risk">At risk</option>
                  <option value="off track">Off track</option>
                  <option value="achieved">Achieved</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <div className="form-label-with-value">
              <label className="form-label" htmlFor="goal-progress">
                Starting Progress
              </label>
              <span className="slider-value">{progress}%</span>
            </div>
            <input
              id="goal-progress"
              type="range"
              min="0"
              max="100"
              step="5"
              className="form-range"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}/>
          </div>

          <div className="form-group">
            <label className="form-label">Privacy</label>
            <div className="privacy-options">
              <label className={`radio-card ${privacy === "public" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="privacy"
                  value="public"
                  checked={privacy === "public"}
                  onChange={() => setPrivacy("public")}/>
                <div>
                  <div className="radio-title">Public to workspace</div>
                  <div className="radio-desc">Anyone in your workspace can view this goal</div>
                </div>
              </label>

              <label className={`radio-card ${privacy === "private" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="privacy"
                  value="private"
                  checked={privacy === "private"}
                  onChange={() => setPrivacy("private")}/>
                <div>
                  <div className="radio-title">Private to members</div>
                  <div className="radio-desc">Only invited members can view this goal</div>
                </div>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!goalName.trim()}>
              Create goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGoalModal;
