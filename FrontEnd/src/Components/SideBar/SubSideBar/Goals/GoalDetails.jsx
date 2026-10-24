import React, { useState, useEffect } from "react";
import "./GoalDetails.css";

import {
  GoalIcon,
  ShareIcon,
  ThumbsUpIcon,
  LinkIcon,
  DotsIcon,
  ClosePanelIcon,
  SmileyIcon,
  AtIcon,
  StarIcon,
  ArrowUpIcon,
  PlusIcon,
  ChevronDownIcon,
  TeamSilhouetteIcon,
} from "./Icons";

const STATUS_CONFIG = {
  "on track": {
    label: "On track",
    color: "#a7e019",
    bg: "rgba(34, 197, 94, 0.15)",
  },
  "at risk": {
    label: "At risk",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.15)",
  },
  "off track": {
    label: "Off track",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
  },
  achieved: {
    label: "Achieved",
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.15)",
  },
  
};

const AVAILABLE_OWNERS = [
  { name: "Jagadeep", initials: "Ja", role: "Developer" },
  { name: "Sarah Chen", initials: "SC", role: "Engineering Lead" },
  { name: "Alex Rivera", initials: "AR", role: "Design Lead" },
];

const TIME_PERIODS = [
  "Q1 FY26",
  "Q2 FY26",
  "Q3 FY26",
  "Q4 FY26",
  "Q1 FY27",
  "Q2 FY27",
  "Full Year 2027",
];

const TEAMS = [
  "No team",
  "Product",
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
  "Operations",
];

function GoalDetails({ goal, onClose, onSave }) {
  const [name, setName] = useState(goal?.name || "");
  const [owner, setOwner] = useState(
    goal?.owner || { name: "Jagadeep", initials: "Ja" }
  );
  const [timePeriod, setTimePeriod] = useState(
    goal?.timePeriod || ""
  );
  const [dueDate, setDueDate] = useState(
    goal?.dueDate || "Set a custom due date"
  );
  const [team, setTeam] = useState(goal?.team || "");

  const [status, setStatus] = useState(goal?.status || "");

  const [statusSummary, setStatusSummary] = useState(
    goal?.statusSummary || ""
  );
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(goal?.comments || []);

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingStatusSummary, setIsEditingStatusSummary] =
    useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);

  useEffect(() => {
    if (goal) {
      setName(goal.name || "");
      setOwner(
        goal.owner || { name: "Jagadeep", initials: "Ja" }
      );
      setTimePeriod(goal.timePeriod || "Q2 FY27");
      setDueDate(
        goal.dueDate || "Set a custom due date"
      );
      setTeam(goal.team || "");

      setStatus(goal.status || "");

      setStatusSummary(goal.statusSummary || "");
      setComments(goal.comments || []);
    }
  }, [goal]);

  const updateGoalField = (field, value) => {
    const updated = {
      ...goal,
      name,
      owner,
      timePeriod,
      dueDate,
      team,
      status,
      statusSummary,
      comments,
      [field]: value,
      isPlaceholder: false,
    };

    if (onSave) {
      onSave(updated);
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);

    const newName = name.trim() || goal?.name || "";
    setName(newName);

    updateGoalField("name", newName);
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setShowStatusPicker(false);
    updateGoalField("status", newStatus);
  };

  const handleOwnerChange = (newOwner) => {
    setOwner(newOwner);
    setShowOwnerPicker(false);
    updateGoalField("owner", newOwner);
  };

  const handlePeriodChange = (newPeriod) => {
    setTimePeriod(newPeriod);
    setShowPeriodPicker(false);
    updateGoalField("timePeriod", newPeriod);
  };

  const handleTeamChange = (newTeam) => {
    const selectedTeam = newTeam === "No team" ? "" : newTeam;

    setTeam(selectedTeam);
    setShowTeamPicker(false);
    updateGoalField("team", selectedTeam);
  };

  const handleStatusSummaryBlur = () => {
    setIsEditingStatusSummary(false);

    const newSummary = statusSummary.trim();
    setStatusSummary(newSummary);

    updateGoalField("statusSummary", newSummary);
  };

  const handleAddComment = (e) => {
    e?.preventDefault();

    if (!commentText.trim()) return;

    const newComment = {
      id: Date.now().toString(),
      author: owner?.name || "Jagadeep",
      authorInitials: owner?.initials || "Ja",
      text: commentText.trim(),
      createdAt: "Just now",
    };

    const updatedComments = [...comments, newComment];

    setComments(updatedComments);
    setCommentText("");

    updateGoalField("comments", updatedComments);
  };

  const statusConfig = status
    ? STATUS_CONFIG[status.toLowerCase().replace(/_/g, " ")]
    : null;

  const statusColor = statusConfig?.color || "#d1d5db";

  return (
    <div className="goal-details-panel">
      <div className="panel-top-bar">
        <div className="panel-top-left">
          <button type="button" className="btn-view-goal-pill">
            <span>View goal</span>
          </button>
        </div>

        <div className="panel-top-right">
          <div className="avatar-group-badge">
            <span className="owner-badge-avatar">
              {owner?.initials || "Ja"}
            </span>
            <span className="avatar-add-icon">+</span>
          </div>

          <button type="button" className="btn-share-pill">
            <ShareIcon size={13} />
            <span>Share</span>
          </button>

          <button type="button" className="icon-btn" title="Like">
            <ThumbsUpIcon size={14} />
          </button>

          <button
            type="button"
            className="icon-btn"
            title="Copy link"
            onClick={() => alert("Link copied to clipboard")}>
            <LinkIcon size={14} />
          </button>

          <button
            type="button"
            className="icon-btn"
            title="More options">
            <DotsIcon size={14} />
          </button>

          <button
            type="button"
            className="icon-btn close-panel-btn"
            onClick={onClose}
            title="Close panel"
            aria-label="Close goal details">
            <ClosePanelIcon size={16} />
          </button>
        </div>
      </div>

      <div className="panel-scroll-content">
        <div className="panel-title-section">
          <div className="goal-icon-badge">
            <GoalIcon size={18} />
          </div>

          {isEditingTitle ? (
            <input
              type="text"
              className="panel-title-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTitleBlur();
                }

                if (e.key === "Escape") {
                  setName(goal?.name || "");
                  setIsEditingTitle(false);
                }
              }}
              autoFocus />
          ) : (
            <h1
              className="panel-goal-title"
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit title">
              {name || "Untitled goal"}
            </h1>
          )}
        </div>

        <div className="panel-meta-table">
          <div className="meta-row">
            <div className="meta-label">Goal owner</div>

            <div className="meta-value">
              <div className="meta-picker-wrapper">
                <button
                  type="button"
                  className="owner-meta-btn"
                  onClick={() =>
                    setShowOwnerPicker(!showOwnerPicker)
                  }>
                  <span className="owner-avatar-circle">
                    {owner?.initials || "Ja"}
                  </span>
                  <span className="owner-name-text">
                    {owner?.name || "Jagadeep"}
                  </span>
                </button>

                {showOwnerPicker && (
                  <div className="meta-popover">
                    <div className="popover-heading">
                      Select Owner
                    </div>

                    {AVAILABLE_OWNERS.map((user) => (
                      <button
                        key={user.name}
                        type="button"
                        className="popover-item"
                        onClick={() => handleOwnerChange(user)} >
                        <span className="owner-avatar-circle">
                          {user.initials}
                        </span>
                        <span>{user.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="meta-row">
            <div className="meta-label">Time period</div>

            <div className="meta-value">
              <div className="meta-picker-wrapper">
                <button
                  type="button"
                  className="meta-value-text clickable"
                  onClick={() =>
                    setShowPeriodPicker(!showPeriodPicker)
                  }>
                  {timePeriod}
                </button>

                {showPeriodPicker && (
                  <div className="meta-popover">
                    <div className="popover-heading">
                      Select Time Period
                    </div>

                    {TIME_PERIODS.map((period) => (
                      <button
                        key={period}
                        type="button"
                        className="popover-item"
                        onClick={() =>
                          handlePeriodChange(period)
                        }>
                        {period}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="meta-row">
            <div className="meta-label">Due date</div>

            <div className="meta-value">
              {isEditingDueDate ? (
                <input
                  type="text"
                  className="meta-inline-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  onBlur={() => {
                    setIsEditingDueDate(false);

                    updateGoalField(
                      "dueDate",
                      dueDate.trim() || "Set a custom due date"
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setIsEditingDueDate(false);

                      updateGoalField(
                        "dueDate",
                        dueDate.trim() || "Set a custom due date"
                      );
                    }
                  }}
                  autoFocus/>
              ) : (
                <span
                  className={`meta-value-text ${
                    dueDate === "Set a custom due date"
                      ? "placeholder"
                      : ""
                  }`}
                  onClick={() => setIsEditingDueDate(true)}
                  title="Click to set due date" >
                  {dueDate}
                </span>
              )}
            </div>
          </div>

          <div className="meta-row">
            <div className="meta-label">Accountable team</div>

            <div className="meta-value">
              <div className="meta-picker-wrapper">
                <button
                  type="button"
                  className="team-meta-btn"
                  onClick={() =>
                    setShowTeamPicker(!showTeamPicker)
                  }>
                  <div className="dashed-team-avatar">
                    <TeamSilhouetteIcon size={14} />
                  </div>

                  <span
                    className={`meta-value-text ${
                      !team ? "placeholder" : ""
                    }`}>
                    {team || "No team"}
                  </span>
                </button>

                {showTeamPicker && (
                  <div className="meta-popover">
                    <div className="popover-heading">
                      Select Team
                    </div>

                    {TEAMS.map((selectedTeam) => (
                      <button
                        key={selectedTeam}
                        type="button"
                        className="popover-item"
                        onClick={() =>
                          handleTeamChange(selectedTeam)
                        } >
                        {selectedTeam}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="meta-row">
            <div className="meta-label">Fields</div>

            <div className="meta-value">
              <button
                type="button"
                className="meta-value-text placeholder add-field-btn"
                onClick={() => alert("Add custom fields feature")}>
                Add field
              </button>
            </div>
          </div>

          <div className="feedback-row">
            <button
              type="button"
              className="send-feedback-link"
              onClick={() => alert("Thank you for your feedback!")}>
              Send feedback
            </button>
          </div>
        </div>

        <div className="panel-status-section">
          <div className="status-section-header">
            <h2 className="status-section-title">Latest status</h2>

            <div className="meta-picker-wrapper">
              <button
                type="button"
                className="btn-update-status"
                onClick={() =>
                  setShowStatusPicker(!showStatusPicker)
                } >
                <span>
                  {statusConfig?.label || "Update status"}
                </span>
                <ChevronDownIcon size={12} />
              </button>

              {showStatusPicker && (
                <div className="meta-popover right-aligned">
                  <div className="popover-heading">
                    Change Status
                  </div>

                  {Object.entries(STATUS_CONFIG).map(
                    ([key, config]) => (
                      <button
                        key={key}
                        type="button"
                        className="popover-item"
                        onClick={() => handleStatusChange(key)}>
                        <span
                          className="status-indicator-dot"
                          style={{
                            backgroundColor: config.color,
                          }}/>
                        <span>{config.label}</span>
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    className="popover-item"
                    onClick={() => handleStatusChange("")}>
                    Clear status
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="status-card">
            <div className="card-top-subbar">
              <span className="mini-view-goal-pill">
                View goal
              </span>

              <div className="card-top-icons">
                <div className="avatar-group-badge mini">
                  <span className="owner-badge-avatar mini">
                    {owner?.initials || "Ja"}
                  </span>
                  <span className="avatar-add-icon mini">+</span>
                </div>

                <button
                  type="button"
                  className="icon-btn mini"
                  title="Add reaction">
                  <SmileyIcon size={13} />
                </button>

                <button
                  type="button"
                  className="icon-btn mini"
                  title="Copy link"
                  onClick={() => alert("Update link copied")}>
                  <LinkIcon size={13} />
                </button>

                <button
                  type="button"
                  className="icon-btn mini"
                  title="More options"  >
                  <DotsIcon size={13} />
                </button>
              </div>
            </div>

            <div
              className="status-color-line"
              style={{ backgroundColor: statusColor }}/>

            <div className="status-summary-wrapper">
              {isEditingStatusSummary ? (
                <input
                  type="text"
                  className="status-summary-input"
                  value={statusSummary}
                  placeholder="Enter status update"
                  onChange={(e) =>
                    setStatusSummary(e.target.value)
                  }
                  onBlur={handleStatusSummaryBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleStatusSummaryBlur();
                    }
                  }}
                  autoFocus/>
              ) : (
                <h3
                  className="status-summary-text"
                  onClick={() =>
                    setIsEditingStatusSummary(true)
                  }
                  title="Click to edit status summary">
                  {statusSummary || "Add a status update"}
                </h3>
              )}
            </div>

            <form
              onSubmit={handleAddComment}
              className="comment-box-container" >
              <textarea
                className="comment-textarea"
                placeholder="Add a comment or @mention a teammate"
                value={commentText}
                onChange={(e) =>
                  setCommentText(e.target.value)
                }
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }} />

              <div className="comment-bottom-toolbar">
                <div className="comment-tools-left">
                  <button
                    type="button"
                    className="comment-tool-btn"
                    title="Attach file" >
                    <PlusIcon size={14} />
                  </button>

                  <button
                    type="button"
                    className="comment-tool-btn"
                    title="Add emoji" >
                    <SmileyIcon size={14} />
                  </button>

                  <button
                    type="button"
                    className="comment-tool-btn"
                    title="Mention teammate">
                    <AtIcon size={14} />
                  </button>

                  <button
                    type="button"
                    className="comment-tool-btn"
                    title="Star / Appreciation" >
                    <StarIcon size={14} />
                  </button>
                </div>

                <button
                  type="submit"
                  className={`comment-submit-btn ${
                    commentText.trim() ? "active" : ""
                  }`}
                  disabled={!commentText.trim()}
                  title="Post update" >
                  <ArrowUpIcon size={13} />
                </button>
              </div>
            </form>

            {comments.length > 0 && (
              <div className="comments-history-list">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="comment-item"
                  >
                    <span className="owner-avatar-circle small">
                      {comment.authorInitials || "Ja"}
                    </span>

                    <div className="comment-body">
                      <div className="comment-author-line">
                        <span className="comment-author-name">
                          {comment.author}
                        </span>
                        <span className="comment-time">
                          {comment.createdAt}
                        </span>
                      </div>

                      <div className="comment-content-text">
                        {comment.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GoalDetails;