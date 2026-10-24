import React, { useState, useEffect } from "react";
import "./CreateGoalModel.css";
import { CloseIcon } from "./Icons";

const AVAILABLE_OWNERS = [
  { id: "1", name: "Jagadeep", role: " Developer" },
  { id: "2", name: "Sarah Chen", role: "Engineering Lead" },
  { id: "3", name: "Alex Rivera", role: "Design Lead" },
  { id: "4", name: "Michael Chang", role: "Operations" },
];

const TIME_PERIODS = [
  "Q1 FY26",
  "Q2 FY26",
  "Q3 FY26",
  "Q4 FY26",
  "Full Year 2026",
];

const TEAMS = [
  "Product",
  "Engineering",
  "Developer",
  "Marketing",
  "Sales",
  "Operations",
];

function CreateGoalModal({ isOpen, onClose, onCreateGoal }) {
  const [goalName, setGoalName] = useState("");
  const [status, setStatus] = useState("on track");
  const [ownerId, setOwnerId] = useState("");
  const [timePeriod, setTimePeriod] = useState("Q1 FY26");
  const [team, setTeam] = useState("Engineering");
  const [progress, setProgress] = useState(0);
  const [privacy, setPrivacy] = useState("public");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!goalName.trim()) return;

    const selectedOwner = ownerId
      ? AVAILABLE_OWNERS.find((o) => o.id === ownerId) || null
      : null;

    onCreateGoal({
      name: goalName.trim(),
      status: status || "on track",
      progress: Number(progress) || 0,
      timePeriod: timePeriod || "Q1 FY26",
      team: team || "Engineering",
      owner: selectedOwner,
      privacy: privacy || "public",
      isPlaceholder: false,
    });


    setGoalName("");
    setProgress(0);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
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
            onClick={onClose}
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="goal-owner">
                Owner
              </label>
              <div className="select-wrapper">
                <select
                  id="goal-owner"
                  className="form-select"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)} >
                  <option value="">Unassigned</option>
                  {AVAILABLE_OWNERS.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name} ({owner.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="goal-period">
                Time period
              </label>
              <div className="select-wrapper">
                <select
                  id="goal-period"
                  className="form-select"
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)} >
                  {TIME_PERIODS.map((period) => (
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
                Accountable team
              </label>
              <div className="select-wrapper">
                <select
                  id="goal-team"
                  className="form-select"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}>
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
                Initial status
              </label>
              <div className="select-wrapper">
                <select
                  id="goal-status"
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}>
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
              onClick={onClose}>
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
