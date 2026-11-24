import { useState, useEffect, useRef } from "react";
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

const getTodayDate = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
};

const toDateInputValue = (value) => {
  if (!value || value === "Set a custom due date") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "";
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDueDate = (value) => {
  const dateValue = toDateInputValue(value);
  if (!dateValue) return value;

  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

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

const AVAILABLE_OWNERS = [];

const COMMENT_EMOJIS = ["😀", "😄", "😊", "😂", "🎉", "👍", "❤️", "🚀"];

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

const GOAL_LIKES_STORAGE_KEY = "nexus_goals_liked";

const getStoredLikedGoalIds = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(GOAL_LIKES_STORAGE_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((goalId) => typeof goalId === "string")
      : [];
  } catch (error) {
    console.warn("[GoalDetails] Could not read liked goals:", error);
    return [];
  }
};

function GoalDetails({ goal, onClose, onSave, currentUser }) {
  const [name, setName] = useState(goal?.name || "");
  const [owner, setOwner] = useState(
    goal?.owner || null
  );
  const [timePeriod, setTimePeriod] = useState(
    goal?.timePeriod || ""
  );
  const [dueDate, setDueDate] = useState(
    goal?.dueDate || "Set a custom due date"
  );
  const [dueDateDraft, setDueDateDraft] = useState(toDateInputValue(goal?.dueDate));
  const [dueDateError, setDueDateError] = useState("");
  const [team, setTeam] = useState(goal?.team || "");

  const [status, setStatus] = useState(goal?.status || "");

  const [statusSummary, setStatusSummary] = useState(
    goal?.statusSummary || ""
  );
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(goal?.comments || []);
  const [attachment, setAttachment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [isAppreciation, setIsAppreciation] = useState(false);
  const commentInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingStatusSummary, setIsEditingStatusSummary] =
    useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [likedGoalIds, setLikedGoalIds] = useState(getStoredLikedGoalIds);
  const [showGoalMenu, setShowGoalMenu] = useState(false);
  const [copyLinkFeedback, setCopyLinkFeedback] = useState("");
  const [showHeaderOwnerPicker, setShowHeaderOwnerPicker] = useState(false);
  const isLiked = likedGoalIds.includes(String(goal?.id || ""));

  useEffect(() => {
    if (goal) {
      setName(goal.name || "");
      setOwner(
        goal.owner || null
      );
      setTimePeriod(goal.timePeriod || "");
      setDueDate(
        goal.dueDate || "Set a custom due date"
      );
      setDueDateDraft(toDateInputValue(goal.dueDate));
      setDueDateError("");
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

  const saveDueDate = () => {
    if (dueDateDraft && dueDateDraft < getTodayDate()) {
      setDueDateError("Due date must be today or a future date.");
      return;
    }

    const nextDueDate = dueDateDraft || "Set a custom due date";
    setDueDate(nextDueDate);
    setDueDateError("");
    setIsEditingDueDate(false);
    updateGoalField("dueDate", nextDueDate);
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
    setShowHeaderOwnerPicker(false);
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
      author: currentUser?.name || currentUser?.username || "",
      authorInitials: currentUser?.initials || "",
      text: commentText.trim(),
      createdAt: "Just now",
      ...(attachment && {
        attachment: {
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
        },
      }),
      ...(isAppreciation && { appreciation: true }),
    };

    const updatedComments = [...comments, newComment];

    setComments(updatedComments);
    setCommentText("");
    setAttachment(null);
    setIsAppreciation(false);
    setShowEmojiPicker(false);
    setShowMentionPicker(false);

    updateGoalField("comments", updatedComments);
  };

  const insertAtCursor = (text) => {
    const input = commentInputRef.current;
    const start = input?.selectionStart ?? commentText.length;
    const end = input?.selectionEnd ?? start;
    const updatedText = `${commentText.slice(0, start)}${text}${commentText.slice(end)}`;

    setCommentText(updatedText);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const handleFileSelection = (event) => {
    const file = event.target.files?.[0];
    if (file) setAttachment(file);
    event.target.value = "";
  };

  const handleToggleLike = () => {
    const goalId = String(goal?.id || "");
    if (!goalId) return;

    setLikedGoalIds((current) => {
      const next = current.includes(goalId)
        ? current.filter((id) => id !== goalId)
        : [...current, goalId];
      try {
        localStorage.setItem(GOAL_LIKES_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn("[GoalDetails] Could not save liked goals:", error);
      }
      return next;
    });
  };

  const copyGoalLink = async () => {
    const link = window.location.href;
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        copied = true;
      }
    } catch (error) {
      console.warn("[GoalDetails] Clipboard API unavailable; trying document copy:", error);
    }

    if (!copied) {
      const copyField = document.createElement("textarea");
      copyField.value = link;
      copyField.setAttribute("readonly", "");
      copyField.style.position = "fixed";
      copyField.style.opacity = "0";
      document.body.appendChild(copyField);
      copyField.select();

      try {
        copied = document.execCommand("copy");
      } catch (error) {
        console.error("[GoalDetails] Could not copy goal link:", error);
      } finally {
        copyField.remove();
      }
    }

    if (copied) {
      setCopyLinkFeedback("Link copied");
      window.setTimeout(() => setCopyLinkFeedback(""), 2000);
    } else {
      window.prompt("Copy goal link", link);
    }
  };

  const handleShareGoal = async () => {
    if (typeof navigator.share !== "function") {
      await copyGoalLink();
      return;
    }
    try {
      await navigator.share({
        title: name || "Goal",
        text: `Goal: ${name || "Untitled goal"}`,
        url: window.location.href,
      });
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("[GoalDetails] Could not share goal:", error);
      await copyGoalLink();
    }
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
          <div className="meta-picker-wrapper">
            <button
              type="button"
              className="avatar-group-badge"
              style={{ border: 0, padding: 0, background: "transparent" }}
              aria-label="Change goal owner"
              aria-haspopup="menu"
              aria-expanded={showHeaderOwnerPicker}
              onClick={() => setShowHeaderOwnerPicker((open) => !open)}>
              <span className="owner-badge-avatar">
                {owner?.initials || ""}
              </span>
              <span className="avatar-add-icon">+</span>
            </button>
            {showHeaderOwnerPicker && (
              <div className="meta-popover" role="menu" aria-label="Select goal owner">
                <div className="popover-heading">Select Owner</div>
                {AVAILABLE_OWNERS.map((user) => (
                  <button
                    key={user.name}
                    type="button"
                    className="popover-item"
                    role="menuitem"
                    onClick={() => handleOwnerChange(user)}>
                    <span className="owner-avatar-circle">{user.initials}</span>
                    <span>{user.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn-share-pill"
            aria-label="Share goal"
            onClick={handleShareGoal}>
            <ShareIcon size={13} />
            <span>Share</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            data-tooltip={isLiked ? "Unlike" : "Like"}
            aria-label={isLiked ? "Unlike goal" : "Like goal"}
            aria-pressed={isLiked}
            style={isLiked ? { color: "#60a5fa" } : undefined}
            onClick={handleToggleLike}>
            <ThumbsUpIcon size={14} />
          </button>

          <button
            type="button"
            className="icon-btn"
            data-tooltip={copyLinkFeedback || "Copy link"}
            aria-label={copyLinkFeedback || "Copy goal link"}
            onClick={copyGoalLink}>
            <LinkIcon size={14} />
          </button>

          <div className="meta-picker-wrapper">
            <button
              type="button"
              className="icon-btn"
              data-tooltip="More options"
              aria-label="More goal options"
              aria-haspopup="menu"
              aria-expanded={showGoalMenu}
              onClick={() => setShowGoalMenu((open) => !open)}>
              <DotsIcon size={14} />
            </button>
            {showGoalMenu && (
              <div className="meta-popover right-aligned" role="menu">
                <button
                  type="button"
                  className="popover-item"
                  role="menuitem"
                  onClick={() => {
                    setShowGoalMenu(false);
                    setIsEditingTitle(true);
                  }}>
                  Edit goal title
                </button>
                <button
                  type="button"
                  className="popover-item"
                  role="menuitem"
                  onClick={() => {
                    setShowGoalMenu(false);
                    copyGoalLink();
                  }}>
                  Copy goal link
                </button>
                <button
                  type="button"
                  className="popover-item"
                  role="menuitem"
                  onClick={() => {
                    setShowGoalMenu(false);
                    onClose();
                  }}>
                  Close details
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="icon-btn close-panel-btn"
            onClick={onClose}
            data-tooltip="Close panel"
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
                    {owner?.name || ""}
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
                <div className="goal-due-date-editor">
                  <input
                    type="date"
                    className="meta-inline-input"
                    value={dueDateDraft}
                    min={getTodayDate()}
                    aria-invalid={Boolean(dueDateError)}
                    aria-describedby={dueDateError ? "goal-due-date-error" : undefined}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDueDateDraft(value);
                      setDueDateError(
                        value && value < getTodayDate()
                          ? "Due date must be today or a future date."
                          : ""
                      );
                    }}
                    onBlur={saveDueDate}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    autoFocus
                  />
                  {dueDateError && (
                    <span id="goal-due-date-error" className="goal-due-date-error" role="alert">
                      {dueDateError}
                    </span>
                  )}
                </div>
              ) : (
                <span
                  className={`meta-value-text ${
                    dueDate === "Set a custom due date"
                      ? "placeholder"
                      : ""
                  }`}
                  onClick={() => setIsEditingDueDate(true)}
                  title="Click to set due date" >
                  {formatDueDate(dueDate)}
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
                  data-tooltip="Add reaction">
                  <SmileyIcon size={13} />
                </button>

                <button
                  type="button"
                  className="icon-btn mini"
                  data-tooltip="Copy link"
                  onClick={() => alert("Update link copied")}>
                  <LinkIcon size={13} />
                </button>

                <button
                  type="button"
                  className="icon-btn mini"
                  data-tooltip="More options">
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
                ref={commentInputRef}
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

              {attachment && (
                <div className="comment-selected-attachment">
                  <span className="comment-selected-attachment-name" title={attachment.name}>
                    {attachment.name}
                  </span>
                  <button
                    type="button"
                    className="comment-remove-attachment"
                    aria-label="Remove attached file"
                    onClick={() => setAttachment(null)}>
                    ×
                  </button>
                </div>
              )}

              <div className="comment-bottom-toolbar">
                <div className="comment-tools-left">
                  <input
                    ref={attachmentInputRef}
                    className="comment-file-input"
                    type="file"
                    onChange={handleFileSelection}
                    tabIndex={-1}
                    aria-label="Choose a file to attach"
                  />
                  <button
                    type="button"
                    className="comment-tool-btn"
                    title="Attach file"
                    aria-label="Attach file"
                    onClick={() => attachmentInputRef.current?.click()}>
                    <PlusIcon size={14} />
                  </button>

                  <div className="comment-tool-menu-wrapper">
                    <button
                      type="button"
                      className="comment-tool-btn"
                      title="Add emoji"
                      aria-label="Add emoji"
                      aria-expanded={showEmojiPicker}
                      onClick={() => {
                        setShowEmojiPicker((shown) => !shown);
                        setShowMentionPicker(false);
                      }}>
                      <SmileyIcon size={14} />
                    </button>
                    {showEmojiPicker && (
                      <div className="comment-tool-popover emoji-picker" role="group" aria-label="Choose an emoji">
                        {COMMENT_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="emoji-option"
                            aria-label={`Insert ${emoji}`}
                            onClick={() => {
                              insertAtCursor(emoji);
                              setShowEmojiPicker(false);
                            }}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="comment-tool-menu-wrapper">
                    <button
                      type="button"
                      className="comment-tool-btn"
                      title="Mention teammate"
                      aria-label="Mention teammate"
                      aria-expanded={showMentionPicker}
                      onClick={() => {
                        setShowMentionPicker((shown) => !shown);
                        setShowEmojiPicker(false);
                      }}>
                      <AtIcon size={14} />
                    </button>
                    {showMentionPicker && (
                      <div className="comment-tool-popover mention-picker" role="listbox" aria-label="Select a teammate to mention">
                        {AVAILABLE_OWNERS.map((person) => (
                          <button
                            key={person.name}
                            type="button"
                            className="mention-option"
                            role="option"
                            onClick={() => {
                              insertAtCursor(`@${person.name} `);
                              setShowMentionPicker(false);
                            }}>
                            <span className="owner-avatar-circle small">{person.initials}</span>
                            <span>{person.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className={`comment-tool-btn ${isAppreciation ? "active" : ""}`}
                    title="Star / Appreciation"
                    aria-label="Mark comment as appreciation"
                    aria-pressed={isAppreciation}
                    onClick={() => setIsAppreciation((appreciation) => !appreciation)}>
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
                      {comment.attachment && (
                        <div className="comment-attachment" title="Attached file">
                          <span aria-hidden="true">📎</span>
                          <span>{comment.attachment.name}</span>
                        </div>
                      )}
                      {comment.appreciation && (
                        <span className="comment-appreciation" title="Appreciation">
                          <StarIcon size={12} />
                          Appreciation
                        </span>
                      )}
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