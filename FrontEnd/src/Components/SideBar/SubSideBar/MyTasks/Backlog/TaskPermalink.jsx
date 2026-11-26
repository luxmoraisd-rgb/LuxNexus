import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  FolderKanban,
  LoaderCircle,
  MessageSquare,
} from 'lucide-react';
import { fetchProject } from '../../Projects/projectsApi';
import { getApiError, reportApi } from '../../Report/reportApi';
import { sprintApi, taskApi } from './backlogApi';
import './TaskPermalink.css';

const TASK_PROGRESS = {
  'Ready to start': 0,
  'In Progress': 50,
  'In Review': 75,
  Done: 100,
};

const getTaskProjectId = (task) => String(task?.project_id || task?.projectId || '');

const getErrorMessage = (error) =>
  error?.response?.data?.detail ||
  error?.response?.data?.error ||
  error?.message ||
  'Unable to load this information.';

const formatDate = (value) => {
  if (!value) return 'No date set';
  const dateOnly = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [year, month, day] = dateOnly.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const ReportEntries = ({ entries, loading, error, emptyMessage }) => {
  if (loading) {
    return <p className="task-link-muted"><LoaderCircle className="task-link-spin" size={16} /> Loading reports…</p>;
  }
  if (error) {
    return <p className="task-link-inline-error" role="alert"><AlertCircle size={16} /> {error}</p>;
  }
  if (!entries.length) return <p className="task-link-muted">{emptyMessage}</p>;

  return (
    <div className="task-link-report-list">
      {entries.map((entry) => (
        <article className="task-link-report" key={entry.id}>
          <div className="task-link-report-heading">
            <div>
              <strong>{entry.title || entry.period || 'Report'}</strong>
              <span>{entry.employee || 'Team member'} · {formatDate(entry.report_date)}</span>
            </div>
            {entry.status && <span className="task-link-status">{entry.status}</span>}
          </div>
          {entry.activity && <p>{entry.activity}</p>}
          {entry.progress !== null && entry.progress !== undefined && (
            <span className="task-link-report-progress">{entry.progress}% progress</span>
          )}
        </article>
      ))}
    </div>
  );
};

export default function TaskPermalink() {
  const { taskKey = '' } = useParams();
  const normalizedTaskKey = taskKey.trim().toUpperCase();
  const [task, setTask] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [project, setProject] = useState(null);
  const [comments, setComments] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskError, setTaskError] = useState('');
  const [commentsError, setCommentsError] = useState('');
  const [projectError, setProjectError] = useState('');
  const [dailyError, setDailyError] = useState('');
  const [monthlyError, setMonthlyError] = useState('');

  useEffect(() => {
    let active = true;

    const loadTaskPage = async () => {
      setLoading(true);
      setTaskError('');
      setCommentsError('');
      setProjectError('');
      setDailyError('');
      setMonthlyError('');
      setProject(null);
      setComments([]);
      setDailyReports([]);
      setMonthlyReports([]);

      try {
        const [taskList, sprintList] = await Promise.all([
          taskApi.getAll(),
          sprintApi.getAll(),
        ]);
        if (!active) return;

        const matchedTask = taskList.find(
          (item) => String(item.taskId || '').trim().toUpperCase() === normalizedTaskKey
        );
        if (!matchedTask) {
          setTask(null);
          setTaskError(`Task ${normalizedTaskKey} was not found or you do not have access to it.`);
          return;
        }

        const taskSprint = sprintList.find(
          (item) => String(item.id) === String(matchedTask.sprintId)
        );
        const projectId =
          getTaskProjectId(matchedTask) ||
          String(taskSprint?.project_id || taskSprint?.projectId || '');

        setTask(
          projectId && !getTaskProjectId(matchedTask)
            ? { ...matchedTask, project_id: projectId }
            : matchedTask
        );
        setAllTasks(taskList);
        setSprints(sprintList);

        const [taskCommentsResult, projectResult, dailyResult, monthlyResult] = await Promise.allSettled([
          taskApi.getComments(matchedTask.id),
          projectId ? fetchProject(projectId) : Promise.resolve(null),
          projectId
            ? reportApi.getReports({ type: 'daily', project: projectId })
            : Promise.resolve({ results: [] }),
          projectId
            ? reportApi.getReports({ type: 'monthly', project: projectId })
            : Promise.resolve({ results: [] }),
        ]);
        if (!active) return;

        if (taskCommentsResult.status === 'fulfilled') {
          setComments(taskCommentsResult.value);
        } else {
          setCommentsError(getErrorMessage(taskCommentsResult.reason));
        }

        if (projectResult.status === 'fulfilled') {
          setProject(projectResult.value);
          if (!projectId) setProjectError('This task is not assigned to a project.');
        } else {
          setProjectError(getErrorMessage(projectResult.reason));
        }

        if (dailyResult.status === 'fulfilled') {
          setDailyReports(Array.isArray(dailyResult.value?.results) ? dailyResult.value.results : []);
        } else {
          setDailyError(getApiError(dailyResult.reason));
        }

        if (monthlyResult.status === 'fulfilled') {
          setMonthlyReports(Array.isArray(monthlyResult.value?.results) ? monthlyResult.value.results : []);
        } else {
          setMonthlyError(getApiError(monthlyResult.reason));
        }

        if (!projectId) {
          setDailyError('Project EOD reports are unavailable because this task has no project assignment.');
          setMonthlyError('Monthly reports are unavailable because this task has no project assignment.');
        }
      } catch (error) {
        if (active) setTaskError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTaskPage();
    return () => {
      active = false;
    };
  }, [normalizedTaskKey]);

  const projectTasks = useMemo(() => {
    if (!task) return [];
    const projectId = getTaskProjectId(task);
    const projectSprintIds = new Set(
      sprints
        .filter((sprint) => String(sprint.project_id || sprint.projectId || '') === projectId)
        .map((sprint) => String(sprint.id))
    );
    return allTasks.filter((item) => {
      const itemProjectId = getTaskProjectId(item);
      if (projectId && itemProjectId) return itemProjectId === projectId;
      return projectSprintIds.has(String(item.sprintId || ''));
    });
  }, [allTasks, sprints, task]);

  const sprintTasks = useMemo(() => {
    if (!task?.sprintId || task.sprintId === 'backlog') return [];
    return allTasks.filter((item) => String(item.sprintId) === String(task.sprintId));
  }, [allTasks, task]);

  const taskProgress = TASK_PROGRESS[task?.status] ?? 0;
  const completedProjectTasks = projectTasks.filter((item) => item.status === 'Done').length;
  const completedSprintTasks = sprintTasks.filter((item) => item.status === 'Done').length;
  const completedComments = comments;

  if (loading) {
    return (
      <main className="task-link-page task-link-state">
        <LoaderCircle className="task-link-spin" size={24} />
        <span>Loading task details…</span>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="task-link-page task-link-state">
        <div className="task-link-alert" role="alert"><AlertCircle size={18} /> {taskError}</div>
        <Link className="task-link-button secondary" to="/work/backlog"><ArrowLeft size={16} /> Back to backlog</Link>
      </main>
    );
  }

  const sprint = sprints.find((item) => String(item.id) === String(task.sprintId));

  return (
    <main className="task-link-page">
      <header className="task-link-header">
        <div>
          <Link className="task-link-back" to="/work/backlog"><ArrowLeft size={16} /> Back to backlog</Link>
          <p className="task-link-eyebrow">TASK / {task.taskId}</p>
          <h1>{task.title || task.taskId}</h1>
          <p className="task-link-description">{task.description || 'No task description.'}</p>
        </div>
        <div className="task-link-header-actions">
          {project?.id && (
            <Link className="task-link-button secondary" to={`/work/projects/${project.id}`}>
              <FolderKanban size={16} /> View project
            </Link>
          )}
          {project?.id && (
            <Link className="task-link-button secondary" to={`/work/projects/${project.id}/eod`}>
              <ExternalLink size={16} /> Open reports
            </Link>
          )}
        </div>
      </header>

      {taskError && <div className="task-link-alert" role="alert"><AlertCircle size={17} /> {taskError}</div>}

      <section className="task-link-overview-grid" aria-label="Task and project progress">
        <article className="task-link-panel task-link-primary-panel">
          <div className="task-link-panel-heading">
            <div className="task-link-panel-icon"><CheckCircle2 size={18} /></div>
            <div><h2>Task progress</h2><p>{task.status || 'Status unavailable'}</p></div>
          </div>
          <div className="task-link-progress-track" role="progressbar" aria-valuenow={taskProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Task status progress">
            <span style={{ width: `${taskProgress}%` }} />
          </div>
          <div className="task-link-task-meta">
            <span><strong>Type</strong>{task.type || '—'}</span>
            <span><strong>Story points</strong>{task.sp ?? '—'}</span>
            <span><strong>Due date</strong>{formatDate(task.dueDate || task.due_date)}</span>
            <span><strong>Assignee</strong>{task.owner?.name || task.owner?.username || task.owner || 'Unassigned'}</span>
          </div>
        </article>

        <article className="task-link-panel">
          <div className="task-link-panel-heading">
            <div className="task-link-panel-icon"><CalendarDays size={18} /></div>
            <div>
              <h2>{sprint?.name || 'Backlog'}</h2>
              <p>{sprint ? `${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)}` : 'This task is not assigned to a sprint.'}</p>
            </div>
          </div>
          {sprint && (
            <>
              <div className="task-link-progress-track" role="progressbar" aria-valuenow={sprintTasks.length ? Math.round((completedSprintTasks / sprintTasks.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label="Sprint task completion">
                <span style={{ width: `${sprintTasks.length ? (completedSprintTasks / sprintTasks.length) * 100 : 0}%` }} />
              </div>
              <p className="task-link-progress-caption">
                {completedSprintTasks} of {sprintTasks.length} sprint tasks completed
              </p>
              {sprint.goals && <p className="task-link-goal"><strong>Sprint goal:</strong> {sprint.goals}</p>}
            </>
          )}
        </article>

        <article className="task-link-panel">
          <div className="task-link-panel-heading">
            <div className="task-link-panel-icon"><FolderKanban size={18} /></div>
            <div><h2>{project?.name || 'Project progress'}</h2><p>{project?.key || projectError || 'Project information unavailable'}</p></div>
          </div>
          {project && (
            <>
              <div className="task-link-progress-track" role="progressbar" aria-valuenow={projectTasks.length ? Math.round((completedProjectTasks / projectTasks.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label="Project task completion">
                <span style={{ width: `${projectTasks.length ? (completedProjectTasks / projectTasks.length) * 100 : 0}%` }} />
              </div>
              <p className="task-link-progress-caption">
                {completedProjectTasks} of {projectTasks.length} project tasks completed
              </p>
            </>
          )}
        </article>
      </section>

      <section className="task-link-panel task-link-comments">
        <div className="task-link-section-heading">
          <div><MessageSquare size={18} /><h2>Task comments</h2></div>
          <span>{completedComments.length} {completedComments.length === 1 ? 'comment' : 'comments'}</span>
        </div>
        {commentsError ? (
          <p className="task-link-inline-error" role="alert"><AlertCircle size={16} /> {commentsError}</p>
        ) : completedComments.length ? (
          <div className="task-link-comment-list">
            {completedComments.map((comment) => (
              <article className="task-link-comment" key={comment.id}>
                <div className="task-link-comment-avatar">{comment.initial || comment.author?.[0]?.toUpperCase() || 'U'}</div>
                <div>
                  <div className="task-link-comment-meta"><strong>{comment.author || 'Team member'}</strong><time>{comment.time || formatDate(comment.created_at)}</time></div>
                  <p>{comment.text}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="task-link-muted">No comments have been added to this task.</p>
        )}
      </section>

      <section className="task-link-panel">
        <div className="task-link-section-heading">
          <div><FileText size={18} /><h2>Project daily EODs</h2></div>
          <span>{dailyReports.length} {dailyReports.length === 1 ? 'entry' : 'entries'}</span>
        </div>
        <ReportEntries
          entries={dailyReports}
          loading={false}
          error={dailyError}
          emptyMessage="No daily EOD reports are available for this project."
        />
      </section>

      <section className="task-link-panel">
        <div className="task-link-section-heading">
          <div><BarChart3 size={18} /><h2>Project monthly reports</h2></div>
          <span>{monthlyReports.length} {monthlyReports.length === 1 ? 'report' : 'reports'}</span>
        </div>
        <ReportEntries
          entries={monthlyReports}
          loading={false}
          error={monthlyError}
          emptyMessage="No monthly reports are available for this project."
        />
      </section>

      <footer className="task-link-footer">
        <Circle size={14} /> This link shows information available to your signed-in account.
      </footer>
    </main>
  );
}
