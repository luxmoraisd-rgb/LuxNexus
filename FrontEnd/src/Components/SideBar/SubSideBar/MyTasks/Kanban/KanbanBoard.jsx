import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Trash2,
  MessageSquare,
  Download,
  Layers,
} from 'lucide-react';
import { STATUS_CONFIG, TYPE_CONFIG, isTaskAssignedToUser } from '../Backlog/TaskRowUtils';
import './KanbanBoard.css';

const DEFAULT_COLUMNS = [
  { id: 'Ready to start', title: 'Ready to start', color: '#3b82f6' },
  { id: 'In Progress', title: 'In Progress', color: '#f59e0b' },
  { id: 'In Review', title: 'In Review', color: '#8b5cf6' },
  { id: 'Done', title: 'Done', color: '#10b981' },
];

const KanbanBoard = ({
  allTasks = [],
  currentUser,
  statusConfig = STATUS_CONFIG,
  typeConfig = TYPE_CONFIG,
  onUpdateTaskStatus,
  onDeleteTask,
  canEditTask,
  onOpenModal,
  onOpenComments,
  showToast,
  searchQuery = '',
  selectedPersonFilter = 'all',
  personFilterMembers = [],
  typeFilter = 'all',
  statusFilter = 'all',
  sortBy = null,
}) => {
  // Drag and drop state
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);

  // Filter tasks based on search and filters
  const filteredTasks = useMemo(() => {
    let result = allTasks.filter((task) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(query);
        const matchesKey = task.taskId?.toLowerCase().includes(query);
        const matchesEpic = task.epic?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesKey && !matchesEpic) return false;
      }
      // Person filter
      if (selectedPersonFilter === 'my-tasks') {
        if (!isTaskAssignedToUser(task, currentUser)) return false;
      } else if (selectedPersonFilter !== 'all') {
        const selectedPerson = personFilterMembers.find(
          (member) => String(member.id) === String(selectedPersonFilter)
        );
        const ownerValues = [
          task.owner?.id,
          task.owner?.username,
          task.owner?.name,
          task.owner?.email,
          typeof task.owner === 'string' ? task.owner : '',
        ]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase());
        const selectedValues = [
          selectedPerson?.id,
          selectedPerson?.username,
          selectedPerson?.name,
          selectedPerson?.email,
          selectedPersonFilter,
        ]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase());
        if (!ownerValues.some((owner) => selectedValues.includes(owner))) return false;
      }
      // Type filter
      if (typeFilter !== 'all') {
        if (task.type?.toLowerCase() !== typeFilter.toLowerCase()) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const status = task.status || 'Ready to start';
        if (status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      return true;
    });

    if (sortBy === 'title-asc') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortBy === 'title-desc') {
      result.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    } else if (sortBy === 'id-asc') {
      result.sort((a, b) => (a.taskId || '').localeCompare(b.taskId || ''));
    } else if (sortBy === 'id-desc') {
      result.sort((a, b) => (b.taskId || '').localeCompare(a.taskId || ''));
    } else if (sortBy === 'sp-desc') {
      result.sort((a, b) => (Number(b.sp) || 0) - (Number(a.sp) || 0));
    } else if (sortBy === 'sp-asc') {
      result.sort((a, b) => (Number(a.sp) || 0) - (Number(b.sp) || 0));
    } else if (sortBy === 'status') {
      result.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
    }

    return result;
  }, [allTasks, searchQuery, selectedPersonFilter, personFilterMembers, typeFilter, statusFilter, sortBy]);

  // Group tasks by column
  const columnTasksMap = useMemo(() => {
    const map = {
      'Ready to start': [],
      'In Progress': [],
      'In Review': [],
      'Done': [],
    };

    filteredTasks.forEach((task) => {
      const status = task.status || 'Ready to start';
      if (map[status]) {
        map[status].push(task);
      } else if (status.toLowerCase().includes('progress')) {
        map['In Progress'].push(task);
      } else if (status.toLowerCase().includes('review')) {
        map['In Review'].push(task);
      } else if (status.toLowerCase().includes('done')) {
        map['Done'].push(task);
      } else {
        map['Ready to start'].push(task);
      }
    });

    return map;
  }, [filteredTasks]);

  // Total metrics
  const totalTasks = filteredTasks.length;
  const totalSP = filteredTasks.reduce((acc, t) => acc + (Number(t.sp) || 0), 0);
  const completedTasks = columnTasksMap['Done']?.length || 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Handle Drag Start
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(taskId);
  };

  // Handle Drag Over column
  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  // Handle Drag Leave
  const handleDragLeave = (e, columnId) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverColumnId === columnId) {
      setDragOverColumnId(null);
    }
  };

  // Handle Drop on column
  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    const taskId = Number(taskIdStr) || taskIdStr;
    setDraggingTaskId(null);
    setDragOverColumnId(null);

    if (taskId && onUpdateTaskStatus) {
      onUpdateTaskStatus(taskId, targetStatus);
      if (showToast) {
        showToast(`Task moved to "${targetStatus}"`, 'success');
      }
    }
  };

  // Handle Drag End
  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverColumnId(null);
  };

  // Export board as Word document
  const handleExportBoard = () => {
    const escapeHtml = (val) => String(val ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]);

    const columnSections = DEFAULT_COLUMNS.map((col) => {
      const tasks = columnTasksMap[col.id] || [];
      return `
        <h2>${escapeHtml(col.title)} (${tasks.length})</h2>
        <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;margin-bottom:20px;">
          <thead style="background:#e9eef7;">
            <tr>
              <th>Key</th>
              <th>Title</th>
              <th>Type</th>
              <th>Story Points</th>
              <th>Assignee</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.length > 0 ? tasks.map((t) => `
              <tr>
                <td><strong>${escapeHtml(t.taskId || '')}</strong></td>
                <td>${escapeHtml(t.title || '')}</td>
                <td>${escapeHtml(t.type || 'Frontend')}</td>
                <td>${escapeHtml(t.sp || '-')}</td>
                <td>${escapeHtml(t.owner?.name || t.owner || 'Unassigned')}</td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="text-align:center;color:#888;">No tasks</td></tr>`}
          </tbody>
        </table>
      `;
    }).join('');

    const docContent = `
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><title>Kanban Board Export</title></head>
        <body style="font-family:Arial, sans-serif; padding:20px;">
          <h1 style="color:#202744;">Nexus Kanban Board</h1>
          <p>Exported on ${new Date().toLocaleString()} · Total Tasks: ${totalTasks} · Total SP: ${totalSP}</p>
          ${columnSections}
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', docContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kanban-board-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (showToast) {
      showToast('Exported Kanban Board as Word Document 📄', 'success');
    }
  };

  return (
    <div className="kanban-board-wrapper" role="region" aria-label="Kanban Board">
      {/* 1. TOP METRICS & STATS BAR */}
      <div className="kanban-board-stats-bar">
        <div className="kanban-stats-left">
          <div className="kanban-stat-item">
            <Layers size={16} className="text-indigo-400" />
            <span>Total Tasks:</span>
            <span className="kanban-stat-value">{totalTasks}</span>
          </div>

          <div className="kanban-stat-item">
            <Sparkles size={16} className="text-amber-400" />
            <span>Total Story Points:</span>
            <span className="kanban-stat-value">{totalSP} SP</span>
          </div>

          <div className="kanban-stat-item">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>Completion:</span>
            <span className="kanban-stat-value">{completionRate}%</span>
          </div>
        </div>

        <div className="kanban-stats-right">
          <button
            type="button"
            className="kanban-action-btn"
            onClick={handleExportBoard}
            title="Export Kanban board as Word document"
          >
            <Download size={14} />
            <span>Export Board</span>
          </button>
        </div>
      </div>

      {/* 2. KANBAN COLUMNS GRID */}
      <div className="kanban-columns-grid">
        {DEFAULT_COLUMNS.map((col) => {
          const tasks = columnTasksMap[col.id] || [];
          const colSP = tasks.reduce((acc, t) => acc + (Number(t.sp) || 0), 0);
          const isDragOver = dragOverColumnId === col.id;
          const colColor = statusConfig[col.id]?.bg || col.color;

          return (
            <section
              key={col.id}
              className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              aria-label={`${col.title} column`}
            >
              {/* Column Header */}
              <header className="kanban-column-header">
                <div className="kanban-column-header-left">
                  <span
                    className="kanban-column-dot"
                    style={{ backgroundColor: colColor, color: colColor }}
                  />
                  <h3 className="kanban-column-title">{col.title}</h3>
                  <span className="kanban-column-count-badge">{tasks.length}</span>
                  {colSP > 0 && (
                    <span className="kanban-column-sp-badge">{colSP} SP</span>
                  )}
                </div>

              </header>

              {/* Column Body / Cards */}
              <div className="kanban-column-body">
                {tasks.map((task) => {
                  const typeBg = typeConfig[task.type]?.bg || '#579bfc';
                  const isTaskDragging = draggingTaskId === task.id;
                  const ownerName = task.owner?.name || task.owner || 'Unassigned';
                  const ownerInitial = task.owner?.initial || (ownerName ? ownerName[0].toUpperCase() : 'U');
                  const ownerBg = task.owner?.avatarBg || '#6366f1';

                  return (
                    <article
                      key={task.id}
                      className={`kanban-task-card ${isTaskDragging ? 'is-dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onOpenModal && onOpenModal('taskDetails', task)}
                    >
                      {/* Top: Issue Key & Type Badge */}
                      <div className="kanban-card-top">
                        <span className="kanban-card-key">{task.taskId || 'LUX'}</span>
                        <span
                          className="kanban-card-type-badge"
                          style={{ backgroundColor: typeBg }}
                        >
                          {task.type || 'Frontend'}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="kanban-card-title">{task.title}</h4>

                      {/* Metadata: Epic & SP */}
                      {(task.epic || task.sp) && (
                        <div className="kanban-card-meta">
                          {task.epic && (
                            <span className="kanban-card-epic" title={`Epic: ${task.epic}`}>
                              ⚡ {task.epic}
                            </span>
                          )}
                          {task.sp && (
                            <span className="kanban-card-sp" title={`${task.sp} Story Points`}>
                              {task.sp} SP
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer: Assignee & Quick Actions */}
                      <div className="kanban-card-footer" onClick={(e) => e.stopPropagation()}>
                        <div className="kanban-card-assignee" title={`Assigned to ${ownerName}`}>
                          <div className="kanban-avatar" style={{ backgroundColor: ownerBg }}>
                            {ownerInitial}
                          </div>
                          <span className="kanban-assignee-name">{ownerName}</span>
                        </div>

                        <div className="kanban-card-quick-actions">
                          {/* Quick Move Select */}
                          <select
                            className="kanban-move-select"
                            value={task.status || col.id}
                            title="Move task to another column"
                            disabled={canEditTask && !canEditTask(task.id)}
                            onChange={(e) => {
                              if (onUpdateTaskStatus) {
                                onUpdateTaskStatus(task.id, e.target.value);
                              }
                            }}
                          >
                            {DEFAULT_COLUMNS.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>

                          {/* Comments button */}
                          {onOpenComments && (
                            <button
                              type="button"
                              className="kanban-quick-btn"
                              title="Comments"
                              onClick={(e) => onOpenComments(task, e)}
                            >
                              <MessageSquare size={13} />
                            </button>
                          )}

                          {/* Delete */}
                          {onDeleteTask && (
                            <button
                              type="button"
                              className="kanban-quick-btn danger"
                              title="Delete task"
                              onClick={() => onDeleteTask(task.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}

                {/* Empty Column Drop Target */}
                {tasks.length === 0 && (
                  <div className="kanban-empty-zone">
                    <span>No tasks in this column</span>
                    <span>Drop a card here</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanBoard;
