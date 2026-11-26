import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  FolderKanban,
  LoaderCircle,
  RefreshCw,
  Target,
} from "lucide-react";
import { fetchProjects } from "../Projects/projectsApi";
import { allSprintsApi } from "../MyTasks/AllSprints/allSprintsApi";
import { getApiError } from "../Report/reportApi";
import "./resourcing.css";

const TASK_STATUS_GROUPS = [
  { label: "Ready to start", color: "#38bdf8", matches: ["ready to start", "not started", "todo"] },
  { label: "In progress", color: "#f59e0b", matches: ["in progress"] },
  { label: "In review", color: "#a78bfa", matches: ["in review", "review"] },
  { label: "Completed", color: "#34d399", matches: ["done", "completed", "closed"] },
  { label: "Other", color: "#94a3b8", matches: [] },
];

const getProjectRefs = (project) =>
  [project?.id, project?._id, project?.key]
    .filter(Boolean)
    .map(String);

const belongsToProject = (projectRef, project) =>
  Boolean(projectRef) && getProjectRefs(project).includes(String(projectRef));

const isActiveSprint = (sprint) =>
  sprint.isStarted && !sprint.isCompleted;

const isTaskCompleted = (task) =>
  ["done", "completed", "closed"].includes(String(task.status || "").toLowerCase());

function getTaskGroup(task) {
  const status = String(task.status || "").trim().toLowerCase();
  return TASK_STATUS_GROUPS.find((group) => group.matches.includes(status)) || TASK_STATUS_GROUPS.at(-1);
}

function DonutChart({ tasks }) {
  const counts = TASK_STATUS_GROUPS.map((group) => ({
    ...group,
    count: tasks.filter((task) => getTaskGroup(task).label === group.label).length,
  }));
  const total = tasks.length;
  let end = 0;
  const gradient = total
    ? counts
      .filter((group) => group.count)
      .map((group) => {
        const start = end;
        end += (group.count / total) * 100;
        return `${group.color} ${start}% ${end}%`;
      })
      .join(", ")
    : "var(--resourcing-track) 0% 100%";

  return (
    <div className="resourcing-donut-layout">
      <div
        className="resourcing-donut"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label={`Task status breakdown for ${total} tasks`}
      >
        <div className="resourcing-donut-center">
          <strong>{total}</strong>
          <span>tasks</span>
        </div>
      </div>
      <ul className="resourcing-legend">
        {counts.map((group) => (
          <li key={group.label}>
            <span className="resourcing-legend-dot" style={{ backgroundColor: group.color }} />
            <span>{group.label}</span>
            <strong>{group.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Resourcing() {
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadResourcingData = useCallback(async () => {
    try {
      const [projectRows, overview] = await Promise.all([
        fetchProjects(),
        allSprintsApi.getOverview(),
      ]);
      setError("");
      setProjects(projectRows);
      setSprints(overview.sprints);
      setTasks(overview.tasks);
      setSelectedProjectId((current) =>
        current === "all" || projectRows.some((project) => String(project.id) === current)
          ? current
          : "all",
      );
    } catch (loadError) {
      setError(getApiError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(loadResourcingData, 0);
    return () => window.clearTimeout(request);
  }, [loadResourcingData]);

  const refreshResourcingData = () => {
    setLoading(true);
    loadResourcingData();
  };

  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId);
  const sprintsById = useMemo(
    () => new Map(sprints.map((sprint) => [String(sprint.id), sprint])),
    [sprints],
  );
  const projectSprints = useMemo(
    () => selectedProject
      ? sprints.filter((sprint) => belongsToProject(sprint.projectId, selectedProject))
      : sprints,
    [selectedProject, sprints],
  );
  const activeSprints = projectSprints.filter(isActiveSprint);
  const visibleSprints = sprintFilter === "active"
    ? activeSprints
    : sprintFilter === "all"
      ? projectSprints
      : projectSprints.filter((sprint) => String(sprint.id) === sprintFilter);

  const projectTasks = useMemo(
    () => tasks.filter((task) => {
      if (!selectedProject) return true;
      const sprintProjectId = sprintsById.get(String(task.sprintId))?.projectId;
      return belongsToProject(task.projectId, selectedProject)
        || belongsToProject(sprintProjectId, selectedProject);
    }),
    [selectedProject, sprintsById, tasks],
  );
  const visibleTasks = projectTasks.filter((task) => {
    if (sprintFilter === "all") return true;
    if (sprintFilter === "active") {
      return activeSprints.some((sprint) => String(sprint.id) === String(task.sprintId));
    }
    return String(task.sprintId) === sprintFilter;
  });

  const projectProgressRows = (selectedProject ? [selectedProject] : projects).map((project) => {
    const projectRefs = getProjectRefs(project);
    const projectSprintIds = new Set(
      sprints
        .filter((sprint) => projectRefs.includes(String(sprint.projectId)))
        .map((sprint) => String(sprint.id)),
    );
    const assignedTasks = tasks.filter((task) =>
      projectRefs.includes(String(task.projectId))
      || projectSprintIds.has(String(task.sprintId)),
    );
    const completed = assignedTasks.filter(isTaskCompleted).length;
    const savedProgress = Number(project.progress);
    const progress = assignedTasks.length
      ? Math.round((completed / assignedTasks.length) * 100)
      : Number.isFinite(savedProgress)
        ? Math.max(0, Math.min(100, savedProgress))
        : 0;
    return { project, progress, taskCount: assignedTasks.length };
  });

  const scopedProjectRows = selectedProject
    ? projectProgressRows
    : projectProgressRows.slice(0, 8);
  const doneTasks = visibleTasks.filter(isTaskCompleted).length;
  const overallProgress = visibleTasks.length
    ? Math.round((doneTasks / visibleTasks.length) * 100)
    : 0;

  return (
    <main className="resourcing-page">
      <header className="resourcing-header">
        <div>
          <div className="resourcing-eyebrow">TRACKER / RESOURCING</div>
          <h1>Resourcing</h1>
          <p>Explore project delivery, sprint activity, and task progress from live workspace data.</p>
        </div>
        <button
          type="button"
          className="resourcing-refresh"
          onClick={refreshResourcingData}
          disabled={loading}
          aria-busy={loading}
        >
          <RefreshCw size={16} className={loading ? "resourcing-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      <section className="resourcing-filters" aria-label="Resourcing filters">
        <label>
          Project
          <select
            value={selectedProjectId}
            onChange={(event) => {
              setSelectedProjectId(event.target.value);
              setSprintFilter("all");
            }}
          >
            <option value="all">All assigned projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label>
          Sprint
          <select value={sprintFilter} onChange={(event) => setSprintFilter(event.target.value)}>
            <option value="all">All sprints</option>
            <option value="active">Active sprints</option>
            {projectSprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
            ))}
          </select>
        </label>
      </section>

      {error && <div className="resourcing-error" role="alert">{error}</div>}

      <section className="resourcing-metrics" aria-label="Delivery metrics">
        <article className="resourcing-metric">
          <span className="resourcing-metric-icon indigo"><FolderKanban size={18} /></span>
          <div><span>Projects</span><strong>{selectedProject ? 1 : projects.length}</strong></div>
        </article>
        <article className="resourcing-metric">
          <span className="resourcing-metric-icon cyan"><Activity size={18} /></span>
          <div><span>Active sprints</span><strong>{activeSprints.length}</strong></div>
        </article>
        <article className="resourcing-metric">
          <span className="resourcing-metric-icon amber"><Target size={18} /></span>
          <div><span>Tasks in view</span><strong>{visibleTasks.length}</strong></div>
        </article>
        <article className="resourcing-metric">
          <span className="resourcing-metric-icon green"><CheckCircle2 size={18} /></span>
          <div><span>Task completion</span><strong>{overallProgress}%</strong></div>
        </article>
      </section>

      {loading ? (
        <div className="resourcing-loading" role="status"><LoaderCircle className="resourcing-spin" size={20} />Loading project and sprint data…</div>
      ) : (
        <>
          <section className="resourcing-charts">
            <article className="resourcing-card">
              <div className="resourcing-card-heading">
                <div><span className="resourcing-card-icon"><BarChart3 size={17} /></span><h2>Project progress</h2></div>
                <span>{selectedProject ? selectedProject.name : `${projects.length} projects`}</span>
              </div>
              {scopedProjectRows.length ? (
                <div className="resourcing-project-bars">
                  {scopedProjectRows.map(({ project, progress, taskCount }) => (
                    <div className="resourcing-bar-row" key={project.id}>
                      <div className="resourcing-bar-label">
                        <strong>{project.name}</strong><span>{progress}% · {taskCount} tasks</span>
                      </div>
                      <div className="resourcing-bar-track">
                        <div className="resourcing-bar-fill project" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="resourcing-empty">No project data is available.</p>}
            </article>

            <article className="resourcing-card">
              <div className="resourcing-card-heading">
                <div><span className="resourcing-card-icon"><Activity size={17} /></span><h2>Task status</h2></div>
                <span>{sprintFilter === "active" ? "Active sprint tasks" : sprintFilter === "all" ? "All sprint tasks" : "Selected sprint tasks"}</span>
              </div>
              <DonutChart tasks={visibleTasks} />
            </article>
          </section>

          <section className="resourcing-card resourcing-sprint-card">
            <div className="resourcing-card-heading">
              <div><span className="resourcing-card-icon"><Target size={17} /></span><h2>{sprintFilter === "active" ? "Active sprint delivery" : "Sprint delivery"}</h2></div>
              <span>{visibleSprints.length} {visibleSprints.length === 1 ? "sprint" : "sprints"}</span>
            </div>
            {visibleSprints.length ? (
              <div className="resourcing-sprint-list">
                {visibleSprints.map((sprint) => {
                  const sprintTasks = projectTasks.filter((task) => String(task.sprintId) === String(sprint.id));
                  const completed = sprintTasks.filter(isTaskCompleted).length;
                  const progress = sprintTasks.length ? Math.round((completed / sprintTasks.length) * 100) : 0;
                  return (
                    <div className="resourcing-sprint-row" key={sprint.id}>
                      <div className="resourcing-sprint-title">
                        <strong>{sprint.name}</strong>
                        <span className={`resourcing-status ${isActiveSprint(sprint) ? "active" : sprint.isCompleted ? "completed" : ""}`}>
                          {sprint.isCompleted ? "Completed" : isActiveSprint(sprint) ? "Active" : "Planned"}
                        </span>
                      </div>
                      <div className="resourcing-sprint-progress">
                        <div className="resourcing-bar-track">
                          <div className={`resourcing-bar-fill ${isActiveSprint(sprint) ? "active" : ""}`} style={{ width: `${progress}%` }} />
                        </div>
                        <span>{completed}/{sprintTasks.length} tasks · {progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="resourcing-empty">No sprints match the selected project and sprint filters.</p>}
          </section>

          <section className="resourcing-card resourcing-active-card">
            <div className="resourcing-card-heading">
              <div><span className="resourcing-card-icon"><CheckCircle2 size={17} /></span><h2>Active sprint overview</h2></div>
              <span>{activeSprints.length} active</span>
            </div>
            {activeSprints.length ? (
              <div className="resourcing-active-grid">
                {activeSprints.map((sprint) => {
                  const sprintTasks = projectTasks.filter((task) => String(task.sprintId) === String(sprint.id));
                  const completed = sprintTasks.filter(isTaskCompleted).length;
                  const progress = sprintTasks.length ? Math.round((completed / sprintTasks.length) * 100) : 0;
                  return (
                    <article className="resourcing-active-item" key={sprint.id}>
                      <div><strong>{sprint.name}</strong><span>{sprintTasks.length} tasks · {progress}% complete</span></div>
                      <div className="resourcing-bar-track"><div className="resourcing-bar-fill active" style={{ width: `${progress}%` }} /></div>
                    </article>
                  );
                })}
              </div>
            ) : <p className="resourcing-empty">No active sprints in this project scope.</p>}
          </section>
        </>
      )}
    </main>
  );
}
