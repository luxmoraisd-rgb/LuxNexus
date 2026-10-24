import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Check,
  ChevronDown,
  Lock,
  ArrowUpRight,
  FolderKanban,
  Zap,
  AlertCircle,
  Sparkles,
  Maximize2,
  Minimize2,
  ListTodo,
} from "lucide-react";
import { TEAM_MEMBERS } from "../../MyTasks/Backlog/TaskRowUtils";
import {
  getStoredProjectKey,
  getStoredSprints,
  getStoredTasks,
  saveToStorage,
  STORAGE_KEYS,
} from "../../MyTasks/Backlog/backlogApi";
import "./dashboard.css";

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTaskDueDate(task) {
  const dueDate = task.dueDate || task.endDate;
  return typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    ? dueDate
    : "";
}

function formatDate(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "No due date"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getCurrentOwnerId(currentUser, profileName) {
  const identityValues = [
    currentUser?.id,
    currentUser?.username,
    currentUser?.name,
    currentUser?.email,
    profileName,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, ""));

  return TEAM_MEMBERS.find((member) => {
    const memberValues = [member.id, member.name, member.email]
      .map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
    return identityValues.some((identity) => memberValues.includes(identity));
  })?.id || "";
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/*
|--------------------------------------------------------------------------
| Header Component
|--------------------------------------------------------------------------
*/

function DashboardHeader({
  completedTasks,
  pendingTasks,
  activeSprintName,
  profileName,
  timeframe,
  onTimeframeChange,
}) {
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const dropdownRef = useRef(null);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const greeting = getGreeting();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setTimeframeOpen(false);
      }
    };
    if (timeframeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [timeframeOpen]);

  const timeframeOptions = ["This week", "Today", "This month"];

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-top">
        <div className="date-badge">
          <CalendarDays size={14} className="date-badge-icon" />
          <span>{todayLabel}</span>
        </div>

        {/* Timeframe Pill Dropdown */}
        <div className="timeframe-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="timeframe-pill-btn"
            onClick={() => setTimeframeOpen((prev) => !prev)}
            aria-expanded={timeframeOpen}
            aria-haspopup="listbox"
          >
            <span>{timeframe}</span>
            <ChevronDown size={15} className={`chevron-icon ${timeframeOpen ? "open" : ""}`} />
          </button>

          {timeframeOpen && (
            <div className="timeframe-dropdown" role="listbox">
              {timeframeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={timeframe === opt}
                  className={`timeframe-option ${timeframe === opt ? "active" : ""}`}
                  onClick={() => {
                    onTimeframeChange(opt);
                    setTimeframeOpen(false);
                  }}
                >
                  <span>{opt}</span>
                  {timeframe === opt && <Check size={14} className="timeframe-check" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-header-main">
        <div className="dashboard-welcome">
          <h1>
            {greeting},{" "}
            <span className="welcome-name">{profileName || "User"}</span>
          </h1>
          <p className="dashboard-subtitle">
            Here is what is happening across your sprints and assignments for {timeframe.toLowerCase()}.
          </p>
        </div>

        {/* Executive Stats Strip */}
        <div className="dashboard-stats-strip">
          <div className="header-stat-chip completed-chip">
            <div className="stat-chip-icon">
              <CheckCircle2 size={16} />
            </div>
            <div className="stat-chip-info">
              <span className="stat-chip-value">{completedTasks}</span>
              <span className="stat-chip-label">Completed</span>
            </div>
          </div>

          <div className="header-stat-chip pending-chip">
            <div className="stat-chip-icon">
              <Clock size={16} />
            </div>
            <div className="stat-chip-info">
              <span className="stat-chip-value">{pendingTasks}</span>
              <span className="stat-chip-label">In Progress</span>
            </div>
          </div>

          {activeSprintName && (
            <div className="header-stat-chip sprint-chip">
              <div className="stat-chip-icon">
                <Zap size={16} />
              </div>
              <div className="stat-chip-info">
                <span className="stat-chip-value">{activeSprintName}</span>
                <span className="stat-chip-label">Active Sprint</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/*
|--------------------------------------------------------------------------
| Tasks Card Component
|--------------------------------------------------------------------------
*/

function TasksCard({
  tasks,
  profileName,
  size,
  onSizeChange,
  onToggleStatus,
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Upcoming");

  const filteredTasks = useMemo(() => {
    if (activeTab === "Completed") {
      return tasks.filter((task) => task.completed);
    }
    if (activeTab === "Overdue") {
      return tasks.filter((task) => task.overdue && !task.completed);
    }
    return tasks.filter((task) => !task.completed && !task.overdue);
  }, [tasks, activeTab]);

  const upcomingCount = tasks.filter((task) => !task.completed && !task.overdue).length;
  const overdueCount = tasks.filter((task) => task.overdue && !task.completed).length;
  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <section className={`dashboard-card tasks-card ${size === "full" ? "full-size" : ""}`}>
      {/* Card Header */}
      <div className="card-header">
        <div className="card-title-group">
          <div className="user-avatar-glow">
            {profileName?.trim()?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <div className="card-heading-row">
              <h2
                onClick={() => navigate("/work/tasks")}
                className="clickable-title"
                title="Open My Tasks"
              >
                My tasks
              </h2>
              <span className="privacy-badge" title="Assigned exclusively to you">
                <Lock size={12} />
                <span>Private</span>
              </span>
            </div>
            <span className="card-subtitle-badge">
              {tasks.length} total assignment{tasks.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="card-header-actions">
          <button
            type="button"
            className="card-quick-link"
            onClick={() => navigate("/work/tasks")}
            title="Open full My Tasks view"
          >
            <span>View all</span>
            <ArrowUpRight size={14} />
          </button>
          <button
            type="button"
            className="card-size-btn"
            onClick={() => onSizeChange(size === "full" ? "half" : "full")}
            title={size === "full" ? "Collapse to half width" : "Expand to full width"}
            aria-label="Toggle card width"
          >
            {size === "full" ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Segmented Filter Tabs */}
      <div className="task-tabs-strip">
        <button
          type="button"
          className={`task-tab-btn ${activeTab === "Upcoming" ? "active" : ""}`}
          onClick={() => setActiveTab("Upcoming")}
        >
          <span>Upcoming</span>
          <span className="tab-count-pill">{upcomingCount}</span>
        </button>

        <button
          type="button"
          className={`task-tab-btn ${activeTab === "Overdue" ? "active" : ""}`}
          onClick={() => setActiveTab("Overdue")}
        >
          <span>Overdue</span>
          <span className={`tab-count-pill ${overdueCount > 0 ? "alert-pill" : ""}`}>
            {overdueCount}
          </span>
        </button>

        <button
          type="button"
          className={`task-tab-btn ${activeTab === "Completed" ? "active" : ""}`}
          onClick={() => setActiveTab("Completed")}
        >
          <span>Completed</span>
          <span className="tab-count-pill">{completedCount}</span>
        </button>
      </div>

      {/* Task List */}
      <div className="task-list-container">
        {filteredTasks.length === 0 ? (
          <div className="empty-tasks-state">
            <div className="empty-icon-wrap">
              <Sparkles size={26} className="empty-sparkle-icon" />
            </div>
            <p className="empty-primary">You are all caught up!</p>
            <p className="empty-secondary">
              {activeTab === "Overdue"
                ? "No overdue tasks on your radar."
                : activeTab === "Completed"
                ? "No tasks completed yet in this timeframe."
                : "No upcoming tasks pending for you."}
            </p>
          </div>
        ) : (
          <div className="task-items-list">
            {filteredTasks.map((task) => {
              const dueDate = getTaskDueDate(task);
              return (
                <div
                  className={`task-item-row ${task.completed ? "task-completed" : ""}`}
                  key={task.id}
                  onClick={() => navigate("/work/tasks")}
                  title="Click to view details in My Tasks"
                >
                  <button
                    type="button"
                    className={`task-status-circle ${task.completed ? "checked" : ""}`}
                    onClick={(e) => onToggleStatus(e, task)}
                    title={task.completed ? "Mark incomplete" : "Mark completed"}
                    aria-label={`Toggle task completion for ${task.title}`}
                  >
                    <Check size={12} className="check-mark-icon" />
                  </button>

                  <div className="task-content-col">
                    <span className="task-title-text">{task.title}</span>
                    {task.taskId && (
                      <span className="task-code-tag">{task.taskId}</span>
                    )}
                  </div>

                  <div className="task-meta-col">
                    <span
                      className={`task-due-chip ${
                        task.overdue ? "due-overdue" : task.completed ? "due-done" : "due-normal"
                      }`}
                    >
                      {task.overdue ? (
                        <AlertCircle size={13} className="due-icon" />
                      ) : (
                        <CalendarDays size={13} className="due-icon" />
                      )}
                      <span>{formatDate(dueDate)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/*
|--------------------------------------------------------------------------
| Projects / Sprints Card Component
|--------------------------------------------------------------------------
*/

function ProjectsCard({
  projectKey,
  sprints,
  tasks,
  size,
  onSizeChange,
}) {
  const navigate = useNavigate();
  const activeSprint = sprints.find((sprint) => sprint.isStarted && !sprint.isCompleted);
  const upcomingSprints = sprints.filter((sprint) => !sprint.isStarted && !sprint.isCompleted);
  const upcomingSprint = upcomingSprints[0];

  const getSprintTaskCounts = (sprintId) => {
    const sprintTasks = tasks.filter((task) => task.sprintId === sprintId);
    const completed = sprintTasks.filter(
      (task) => task.status === "Done" || task.status === "Completed"
    ).length;
    return {
      total: sprintTasks.length,
      completed,
      percent: sprintTasks.length > 0 ? Math.round((completed / sprintTasks.length) * 100) : 0,
    };
  };

  return (
    <section className={`dashboard-card projects-card ${size === "full" ? "full-size" : ""}`}>
      {/* Header */}
      <div className="card-header">
        <div className="card-title-group">
          <div className="project-icon-badge">
            <FolderKanban size={20} />
          </div>
          <div>
            <div className="card-heading-row">
              <h2
                onClick={() => navigate("/work/all-sprints")}
                className="clickable-title"
                title="Open All Sprints"
              >
                {projectKey} Sprints & Project
              </h2>
            </div>
            <span className="card-subtitle-badge">
              {sprints.length} sprint{sprints.length === 1 ? "" : "s"} tracked
            </span>
          </div>
        </div>

        <div className="card-header-actions">
          <button
            type="button"
            className="card-quick-link"
            onClick={() => navigate("/work/all-sprints")}
            title="Open All Sprints view"
          >
            <span>All sprints</span>
            <ArrowUpRight size={14} />
          </button>
          <button
            type="button"
            className="card-size-btn"
            onClick={() => onSizeChange(size === "full" ? "half" : "full")}
            title={size === "full" ? "Collapse to half width" : "Expand to full width"}
            aria-label="Toggle card width"
          >
            {size === "full" ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Sprints Content Area */}
      <div className="projects-content-area">
        {/* Active Sprint Section */}
        <div className="sprint-section-wrap">
          <div className="section-title-strip">
            <span className="section-label">Active Sprint</span>
            {activeSprint && (
              <span className="live-pulse-badge">
                <span className="live-pulse-dot" />
                Live
              </span>
            )}
          </div>

          {activeSprint ? (
            <ActiveSprintHero
              sprint={activeSprint}
              counts={getSprintTaskCounts(activeSprint.id)}
              onNavigate={() => navigate("/work/active-sprint")}
            />
          ) : (
            <div className="empty-sprint-banner">
              <ListTodo size={18} className="empty-banner-icon" />
              <span>No sprint is currently in progress. Start one in the Backlog.</span>
            </div>
          )}
        </div>

        {/* Upcoming Sprint Section */}
        <div className="sprint-section-wrap">
          <div className="section-title-strip">
            <span className="section-label">Upcoming Sprint</span>
          </div>

          {upcomingSprint ? (
            <UpcomingSprintCard
              sprint={upcomingSprint}
              counts={getSprintTaskCounts(upcomingSprint.id)}
              onNavigate={() => navigate("/work/all-sprints")}
            />
          ) : (
            <div className="empty-sprint-banner">
              <span>No upcoming sprint scheduled yet.</span>
            </div>
          )}
        </div>

        {/* All Sprints Overview */}
        <div className="sprint-section-wrap all-sprints-overview-wrap">
          <div className="section-title-strip">
            <span className="section-label">All Sprints</span>
            <button
              type="button"
              className="text-link-btn"
              onClick={() => navigate("/work/all-sprints")}
            >
              View directory ({sprints.length})
            </button>
          </div>

          <div className="mini-sprint-list">
            {sprints.length ? (
              sprints.slice(0, 4).map((sprint) => {
                const counts = getSprintTaskCounts(sprint.id);
                const isCurrent = sprint.isStarted && !sprint.isCompleted;
                const isDone = sprint.isCompleted;

                return (
                  <div
                    key={sprint.id}
                    className="mini-sprint-item"
                    onClick={() => navigate("/work/all-sprints")}
                  >
                    <div className="mini-sprint-main">
                      <strong className="mini-sprint-name">{sprint.name}</strong>
                      <span
                        className={`mini-status-pill ${
                          isDone ? "done" : isCurrent ? "active" : "upcoming"
                        }`}
                      >
                        {isDone ? "Completed" : isCurrent ? "Current" : "Upcoming"}
                      </span>
                    </div>

                    <div className="mini-sprint-footer">
                      <span className="mini-dates-text">
                        {sprint.dates && sprint.dates !== "Add Sprint dates"
                          ? sprint.dates
                          : "Dates not set"}
                      </span>
                      <span className="mini-progress-text">
                        {counts.completed}/{counts.total} done ({counts.percent}%)
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="empty-muted-text">No sprints created yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ActiveSprintHero({ sprint, counts, onNavigate }) {
  return (
    <article className="active-sprint-hero-card" onClick={onNavigate}>
      <div className="hero-top-row">
        <div>
          <h4 className="hero-sprint-name">{sprint.name}</h4>
          <p className="hero-sprint-goal">
            {sprint.goal || "Focus on delivering core sprint milestones on schedule."}
          </p>
        </div>
        <span className="hero-active-tag">Active Sprint</span>
      </div>

      <div className="hero-progress-group">
        <div className="progress-labels">
          <span className="progress-scope">
            <strong>{counts.completed}</strong> of {counts.total} tasks completed
          </span>
          <span className="progress-percent">{counts.percent}%</span>
        </div>
        <div className="progress-track-bar">
          <div
            className="progress-fill-bar"
            style={{ width: `${Math.min(100, counts.percent)}%` }}
          />
        </div>
      </div>

      <div className="hero-footer-meta">
        <div className="hero-date-info">
          <CalendarDays size={14} />
          <span>
            {sprint.dates && sprint.dates !== "Add Sprint dates"
              ? sprint.dates
              : "Timeline not configured"}
          </span>
        </div>
        <span className="hero-action-link">Open Sprint Board →</span>
      </div>
    </article>
  );
}

function UpcomingSprintCard({ sprint, counts, onNavigate }) {
  return (
    <article className="upcoming-sprint-card" onClick={onNavigate}>
      <div className="upcoming-top-row">
        <strong className="upcoming-sprint-name">{sprint.name}</strong>
        <span className="upcoming-status-tag">Upcoming</span>
      </div>
      <div className="upcoming-footer-row">
        <span className="upcoming-dates-info">
          <CalendarDays size={13} />
          <span>
            {sprint.dates && sprint.dates !== "Add Sprint dates"
              ? sprint.dates
              : "Dates not set"}
          </span>
        </span>
        <span className="upcoming-count-info">{counts.total} tasks planned</span>
      </div>
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| Dashboard Main Page
|--------------------------------------------------------------------------
*/

function Dashboard({ profileName, currentUser }) {
  const [allTasks, setAllTasks] = useState(() => getStoredTasks());
  const [sprints, setSprints] = useState(() => getStoredSprints());
  const [projectKey, setProjectKey] = useState(() => getStoredProjectKey());

  const [timeframe, setTimeframe] = useState("This week");
  const [tasksWidgetSize, setTasksWidgetSize] = useState("half");
  const [projectsWidgetSize, setProjectsWidgetSize] = useState("half");

  useEffect(() => {
    const syncTasks = (event) => {
      setAllTasks(Array.isArray(event?.detail) ? event.detail : getStoredTasks());
    };
    const syncSprints = (event) => {
      setSprints(Array.isArray(event?.detail) ? event.detail : getStoredSprints());
    };
    const syncProjectKey = (event) => {
      setProjectKey(typeof event?.detail === "string" ? event.detail : getStoredProjectKey());
    };
    const syncStorage = (event) => {
      if (event.key === STORAGE_KEYS.TASKS) syncTasks();
      if (event.key === STORAGE_KEYS.SPRINTS) syncSprints();
      if (event.key === STORAGE_KEYS.PROJECT_KEY) syncProjectKey();
    };

    window.addEventListener("nexus:backlog-tasks-changed", syncTasks);
    window.addEventListener("nexus:backlog-sprints-changed", syncSprints);
    window.addEventListener("nexus:project-key-changed", syncProjectKey);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener("nexus:backlog-tasks-changed", syncTasks);
      window.removeEventListener("nexus:backlog-sprints-changed", syncSprints);
      window.removeEventListener("nexus:project-key-changed", syncProjectKey);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  const ownerId = getCurrentOwnerId(currentUser, profileName);

  const tasks = useMemo(() => {
    const today = getLocalDateValue();
    return allTasks
      .filter((task) => task.owner === ownerId)
      .map((task) => {
        const completed = task.status === "Done" || task.status === "Completed";
        const dueDate = getTaskDueDate(task);
        const assignee =
          TEAM_MEMBERS.find((member) => member.id === task.owner)?.name || task.owner;
        return {
          ...task,
          completed,
          overdue: Boolean(dueDate && dueDate < today && !completed),
          assignee,
        };
      });
  }, [allTasks, ownerId]);

  const completedTasks = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.filter((task) => !task.completed).length;

  const activeSprint = sprints.find((sprint) => sprint.isStarted && !sprint.isCompleted);

  const handleToggleTaskStatus = (e, task) => {
    e.stopPropagation();
    const nextStatus = task.completed ? "Ready to start" : "Done";
    const updatedTasks = allTasks.map((t) =>
      t.id === task.id ? { ...t, status: nextStatus } : t
    );
    setAllTasks(updatedTasks);
    saveToStorage(STORAGE_KEYS.TASKS, updatedTasks);
    window.dispatchEvent(
      new CustomEvent("nexus:backlog-tasks-changed", { detail: updatedTasks })
    );
  };

  return (
    <main className="dashboard">
      {/* Header */}
      <DashboardHeader
        completedTasks={completedTasks}
        pendingTasks={pendingTasks}
        activeSprintName={activeSprint?.name}
        profileName={profileName}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />

      {/* Modern Dashboard Grid */}
      <div className="dashboard-grid">
        <TasksCard
          tasks={tasks}
          profileName={profileName}
          size={tasksWidgetSize}
          onSizeChange={setTasksWidgetSize}
          onToggleStatus={handleToggleTaskStatus}
        />

        <ProjectsCard
          projectKey={projectKey}
          sprints={sprints}
          tasks={allTasks}
          size={projectsWidgetSize}
          onSizeChange={setProjectsWidgetSize}
        />
      </div>
    </main>
  );
}

export default Dashboard;