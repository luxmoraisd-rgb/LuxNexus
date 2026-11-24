import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  FolderKanban,
  Layers3,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { fetchProject, deleteProject } from "./projectsApi";
import { backlogClient, sprintApi, taskApi } from "../MyTasks/Backlog/backlogApi";
import "./ProjectDetails.css";

const STORY_POINTS = [1, 2, 3, 5, 7, 9, 10, 12, 13];

export default function ProjectDetails({ rolePermissions, currentUser }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const [sprintName, setSprintName] = useState("");
  const [sprintGoal, setSprintGoal] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskSprint, setTaskSprint] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskStatus, setTaskStatus] = useState("Ready to start");
  const [taskType, setTaskType] = useState("Task");
  const [taskSP, setTaskSP] = useState(3);
  const [taskDueDate, setTaskDueDate] = useState("");

  const effectiveRole = rolePermissions?.current_role || currentUser?.role || "user";
  const isElevated = effectiveRole === "admin" || effectiveRole === "team_lead";
  const canManageSprints = isElevated && rolePermissions?.manage_sprints !== false;
  const canDeleteSprints = effectiveRole === "admin" && canManageSprints;
  const canManageTasks = isElevated && rolePermissions?.manage_tasks !== false;
  const canManageProject = isElevated && rolePermissions?.manage_portfolios !== false;

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [projectData, sprintResponse, taskData, assigneeResponse] = await Promise.all([
        fetchProject(projectId),
        backlogClient.get("/backlog/sprints/", { params: { project_id: projectId } }),
        taskApi.getAll({ project_id: projectId }),
        backlogClient.get("/backlog/users/"),
      ]);
      const projectSprints = (Array.isArray(sprintResponse.data) ? sprintResponse.data : [])
        .filter((sprint) =>
          String(sprint.project_id || sprint.projectId || "") === String(projectId)
        );
      const projectSprintIds = new Set(projectSprints.map((sprint) => String(sprint.id)));
      const projectTasks = (Array.isArray(taskData) ? taskData : []).filter((task) => {
        const taskProjectId = task.project_id || task.projectId;
        if (taskProjectId) return String(taskProjectId) === String(projectId);
        const sprintId = task.sprintId || task.sprint_id || task.sprint?.id;
        return sprintId && projectSprintIds.has(String(sprintId));
      });
      setProject(projectData);
      setSprints(projectSprints);
      setTasks(projectTasks);
      setAssignees(Array.isArray(assigneeResponse.data) ? assigneeResponse.data : []);
    } catch (loadError) {
      setError(loadError.response?.data?.detail || "Unable to load project details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const completedTasks = tasks.filter((task) => task.status === "Done").length;
  const activeSprint = sprints.find((sprint) => sprint.status === "active");
  const projectProgress = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round((completedTasks / tasks.length) * 100);
  }, [completedTasks, tasks.length]);

  const createSprint = async (event) => {
    event.preventDefault();
    if (!sprintName.trim()) return;
    try {
      const created = await sprintApi.create({
        name: sprintName.trim(),
        goal: sprintGoal.trim(),
        dates: sprintStart && sprintEnd ? `${sprintStart} - ${sprintEnd}` : "",
        startDate: sprintStart,
        endDate: sprintEnd,
        project_id: projectId,
      });
      setSprints((current) => [...current, created]);
      setModal(null);
      setSprintName("");
      setSprintGoal("");
      setSprintStart("");
      setSprintEnd("");
      showToast("Sprint created successfully.");
    } catch (createError) {
      showToast(createError.response?.data?.detail || "Unable to create sprint.");
    }
  };

  const deleteSprint = async (sprint) => {
    if (!canDeleteSprints) {
      showToast("Only admins can delete sprints.");
      return;
    }
    if (!window.confirm(`Delete "${sprint.name}"?`)) return;
    try {
      await sprintApi.delete(sprint.id);
      setSprints((current) => current.filter((item) => String(item.id) !== String(sprint.id)));
      showToast("Sprint deleted.");
    } catch (deleteError) {
      showToast(deleteError.response?.data?.detail || "Unable to delete sprint.");
    }
  };

  const createTask = async (event) => {
    event.preventDefault();
    if (!taskTitle.trim() || !taskSprint) return;
    try {
      await taskApi.create({
        title: taskTitle.trim(),
        sprintId: taskSprint,
        sprint_id: taskSprint,
        project_id: projectId,
        projectId,
        owner: taskAssignee || null,
        status: taskStatus,
        type: taskType,
        sp: taskSP,
        dueDate: taskDueDate,
      });
      await load();
      setModal(null);
      setTaskTitle("");
      setTaskAssignee("");
      setTaskDueDate("");
      showToast("Task created successfully.");
    } catch (createError) {
      showToast(createError.response?.data?.detail || "Unable to create task.");
    }
  };

  const deleteProjectRecord = async () => {
    if (!project || !window.confirm(`Delete "${project.name}" and its project data?`)) return;
    await deleteProject(project.id);
    navigate("/work/projects");
  };

  if (loading) {
    return <div className="project-details-page project-details-loading"><RefreshCw className="spin" size={22} /> Loading project...</div>;
  }

  if (error || !project) {
    return (
      <div className="project-details-page project-details-error">
        <button type="button" onClick={() => navigate("/work/projects")}><ArrowLeft size={16} /> Projects</button>
        <h2>{error || "Project not found"}</h2>
      </div>
    );
  }

  return (
    <div className="project-details-page">
      <header className="project-details-header">
        <button type="button" className="project-details-back" onClick={() => navigate("/work/projects")}>
          <ArrowLeft size={16} /> Projects
        </button>
        <div className="project-details-heading">
          <div className="project-details-icon" style={{ color: project.color || "#6366f1" }}>
            <FolderKanban size={24} />
          </div>
          <div>
            <div className="project-details-title-row">
              <h1>{project.name}</h1>
              <span className="project-details-key">{project.key}</span>
              <span className="project-details-status">{project.status || "Active"}</span>
            </div>
            <p>{project.description || "No project description."}</p>
          </div>
        </div>
        {canManageProject && (
          <button type="button" className="project-details-delete" onClick={deleteProjectRecord}>
            <Trash2 size={15} /> Delete
          </button>
        )}
      </header>

      <nav className="project-details-tabs" aria-label="Project sections">
        {["overview", "sprints", "tasks"].map((item) => (
          <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item === "overview" ? "Overview" : item === "sprints" ? "Sprints" : "Tasks"}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="project-details-content">
          <section className="project-overview-grid">
            <article className="project-overview-card">
              <span>Project Progress</span>
              <strong>{projectProgress}%</strong>
              <div className="project-progress-track"><div style={{ width: `${projectProgress}%`, background: project.color || "#6366f1" }} /></div>
            </article>
            <article className="project-overview-card"><span>Sprints</span><strong>{sprints.length}</strong><small>{activeSprint ? `Active: ${activeSprint.name}` : "No active sprint"}</small></article>
            <article className="project-overview-card"><span>Tasks</span><strong>{tasks.length}</strong><small>{completedTasks} completed</small></article>
          </section>
          <section className="project-info-grid">
            <div><UserRound size={15} /><span>Project Lead</span><strong>{project.lead || project.project_lead || "Unassigned"}</strong></div>
            <div><Calendar size={15} /><span>Start Date</span><strong>{project.start_date || project.startDate || "Not set"}</strong></div>
            <div><Calendar size={15} /><span>End Date</span><strong>{project.end_date || project.endDate || "Not set"}</strong></div>
            <div><Layers3 size={15} /><span>Category</span><strong>{project.category || "General"}</strong></div>
          </section>
        </div>
      )}

      {tab === "sprints" && (
        <div className="project-details-content">
          <div className="project-section-toolbar">
            <h2>Sprints</h2>
            {canManageSprints && <button type="button" onClick={() => setModal("sprint")}><Plus size={15} /> Create Sprint</button>}
          </div>
          {sprints.length ? (
            <div className="project-sprint-list">
              {sprints.map((sprint) => (
                <article key={sprint.id} className="project-sprint-card">
                  <div>
                    <strong>{sprint.name}</strong>
                    <span>{sprint.goals || sprint.goal || "No sprint goal"}</span>
                  </div>
                  <div className="project-sprint-meta">
                    <span>{sprint.status || "future"}</span>
                    <span>{sprint.duration_text || sprint.dates || "Dates not set"}</span>
                    {canDeleteSprints && <button type="button" onClick={() => deleteSprint(sprint)} title="Delete sprint" aria-label={`Delete ${sprint.name}`}><Trash2 size={14} /></button>}
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="project-empty-state"><Layers3 size={30} /><h3>No sprints in this project</h3></div>}
        </div>
      )}

      {tab === "tasks" && (
        <div className="project-details-content">
          <div className="project-section-toolbar">
            <h2>Tasks</h2>
            {canManageTasks && sprints.length > 0 && <button type="button" onClick={() => { setTaskSprint(String(sprints[0].id)); setModal("task"); }}><Plus size={15} /> Create Task</button>}
          </div>
          {tasks.length ? (
            <div className="project-task-list">
              {tasks.map((task) => (
                <article key={task.id} className="project-task-row">
                  {task.status === "Done" ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                  <strong>{task.taskId || task.task_key || task.id}</strong>
                  <span>{task.title}</span>
                  <b>{task.sp || task.estimated_sp || 0} SP</b>
                </article>
              ))}
            </div>
          ) : <div className="project-empty-state"><Circle size={30} /><h3>No tasks in this project</h3></div>}
        </div>
      )}

      {modal === "sprint" && (
        <div className="project-details-modal-backdrop" onClick={() => setModal(null)}>
          <form className="project-details-modal" onSubmit={createSprint} onClick={(event) => event.stopPropagation()}>
            <div className="project-details-modal-header"><h2>Create Sprint</h2><button type="button" onClick={() => setModal(null)}><X size={16} /></button></div>
            <label>Sprint Name<input required value={sprintName} onChange={(event) => setSprintName(event.target.value)} /></label>
            <label>Sprint Goal<textarea value={sprintGoal} onChange={(event) => setSprintGoal(event.target.value)} /></label>
            <div className="project-details-modal-row">
              <label>Start Date<input type="date" value={sprintStart} onChange={(event) => setSprintStart(event.target.value)} /></label>
              <label>End Date<input type="date" min={sprintStart || undefined} value={sprintEnd} onChange={(event) => setSprintEnd(event.target.value)} /></label>
            </div>
            <div className="project-details-modal-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="submit">Create Sprint</button></div>
          </form>
        </div>
      )}

      {modal === "task" && (
        <div className="project-details-modal-backdrop" onClick={() => setModal(null)}>
          <form className="project-details-modal" onSubmit={createTask} onClick={(event) => event.stopPropagation()}>
            <div className="project-details-modal-header"><h2>Create Task</h2><button type="button" onClick={() => setModal(null)}><X size={16} /></button></div>
            <label>Task Title<input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /></label>
            <label>Sprint<select value={taskSprint} onChange={(event) => setTaskSprint(event.target.value)}>{sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></label>
            <label>Assignee<select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}><option value="">Unassigned</option>{assignees.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <div className="project-details-modal-row">
              <label>Status<select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)}><option>Ready to start</option><option>In Progress</option><option>In Review</option><option>Done</option></select></label>
              <label>Type<select value={taskType} onChange={(event) => setTaskType(event.target.value)}><option>Task</option><option>Feature</option><option>Bug</option><option>Quality</option></select></label>
            </div>
            <div className="project-details-modal-row">
              <label>Story Points<select value={taskSP} onChange={(event) => setTaskSP(Number(event.target.value))}>{STORY_POINTS.map((value) => <option key={value} value={value}>{value} SP</option>)}</select></label>
              <label>Due Date<input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></label>
            </div>
            <div className="project-details-modal-actions"><button type="button" onClick={() => setModal(null)}>Cancel</button><button type="submit">Create Task</button></div>
          </form>
        </div>
      )}

      {toast && <div className="project-details-toast">{toast}</div>}
    </div>
  );
}
