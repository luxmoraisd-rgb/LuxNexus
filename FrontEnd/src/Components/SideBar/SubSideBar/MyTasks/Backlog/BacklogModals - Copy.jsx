import { useState, useEffect, useRef, memo } from 'react';
import {
  Plus,
  FileUp,
  Link as LinkIcon,
  Archive,
  Download,
  ExternalLink,
} from 'lucide-react';
import authApi from '../../../../Auth/authApi';
import { boardAssetApi } from './backlogApi';
import {
  CloseIcon,
  CheckIcon,
  GithubIcon,
  CheckCircleIcon,
  CommentBubblePlusIcon,
  KeyIcon,
  ShieldIcon,
  EditIcon,
  RefreshIcon,
  ThumbsUpIcon,
  SendIcon,
  CheckSquareIcon,
  TrashIcon,
} from './BacklogIcons';
import {
  STATUS_CONFIG,
  TYPE_CONFIG,
  TEAM_MEMBERS,
  generateUniqueTaskId,
  getNextJiraTaskId,
  isPastDate,
  isTaskIncomplete,
  isTaskPastDueAndIncomplete,
} from './TaskRowUtils';

const getAnchorStyle = (anchorRect, { align = 'left', width = 180, offset = 4, flipThreshold = 220 } = {}) => {
  if (!anchorRect) {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10000,
    };
  }

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const flipUp = spaceBelow < flipThreshold && anchorRect.top > spaceBelow;

  const style = {
    position: 'fixed',
    width: `${width}px`,
    maxWidth: `${width}px`,
    boxSizing: 'border-box',
    zIndex: 10000,
  };

  if (flipUp) {
    style.bottom = `${Math.round(window.innerHeight - anchorRect.top + offset)}px`;
    style.top = 'auto';
  } else {
    style.top = `${Math.round(anchorRect.bottom + offset)}px`;
    style.bottom = 'auto';
  }

  if (align === 'right') {
    const rightOffset = window.innerWidth - anchorRect.right;
    const boundedRight = Math.max(12, Math.min(window.innerWidth - width - 12, rightOffset));
    style.right = `${Math.round(boundedRight)}px`;
    style.left = 'auto';
  } else if (align === 'center') {
    const centerLeft = anchorRect.left + (anchorRect.width / 2) - (width / 2);
    const boundedLeft = Math.max(12, Math.min(window.innerWidth - width - 12, centerLeft));
    style.left = `${Math.round(boundedLeft)}px`;
    style.right = 'auto';
  } else {
    const boundedLeft = Math.max(12, Math.min(window.innerWidth - width - 12, anchorRect.left));
    style.left = `${Math.round(boundedLeft)}px`;
    style.right = 'auto';
  }

  return style;
};

const PRESET_PALETTE = [
  '#0073ea', // Blue
  '#00c875', // Green
  '#ffab40', // Amber/Orange
  '#e2445c', // Red
  '#a25ddc', // Purple
  '#00c7e6', // Cyan
  '#f783ac', // Pink
  '#579bfc', // Slate blue
  '#784bd1', // Deep violet
  '#20d997', // Emerald
];

const CalendarIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <line x1="16" y1="3" x2="16" y2="7" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="3" y1="11" x2="21" y2="11" />
  </svg>
);

const BacklogModals = memo(({
  activeModal,
  onClose,
  anchorRect,
  activeTaskTarget,
  canUploadTaskAssets = false,
  sprint1Tasks,
  backlogTasks,
  allTasks = [],
  sprints = [],
  sprint1SPSum,
  backlogSPSum,
  sprint1StatusStats,
  isSprint1Started,
  sprint1Dates,
  setSprint1Dates,
  onUpdateSprintDates,
  onDeleteSprint,
  automations,
  setAutomations,
  statusConfig,
  typeConfig,
  onUpdateStatusColor,
  onUpdateTypeColor,
  selectedPersonFilter,
  setSelectedPersonFilter,
  personFilterMembers = TEAM_MEMBERS,
  personFilterTitle = 'Filter by Person',
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  sortBy,
  setSortBy,
  onStatusChange,
  onTypeChange,
  onOwnerChange,
  onSPChange,
  onEpicChange,
  onGithubLink,
  onPostComment,
  onToggleCommentLike,
  onDeleteComment,
  onUpdateTaskDetails,
  onMoveTask,
  onDeleteTask,
  onCreateTask,
  onUpdateTaskId,
  projectKey = 'LUX',
  canInviteElevatedRoles = false,
  onUpdateProjectKey,
  onCreateSprint,
  onStartSprint,
  onCompleteSprint,
  onMoveAllToBacklog,
  onSelectAllTasks,
  onClearSelection,
  onSelectBoardView,
  showToast,
  navigate,
}) => {
  const [colorTab, setColorTab] = useState('status');
  const [commentInput, setCommentInput] = useState('');
  const [selectedCommentAuthor, setSelectedCommentAuthor] = useState('Sivakumar');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');

  const handleSelectMention = (memberName) => {
    setCommentInput((prev) => {
      const lastAtIdx = prev.lastIndexOf('@');
      if (lastAtIdx !== -1 && lastAtIdx >= prev.length - 25) {
        return prev.slice(0, lastAtIdx) + `@${memberName} `;
      }
      return `${prev ? prev.trimEnd() + ' ' : ''}@${memberName} `;
    });
    setShowMentionMenu(false);
    setMentionFilter('');
  };
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isEditingCardTitle, setIsEditingCardTitle] = useState(false);
  const [cardTitleDraft, setCardTitleDraft] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [activeCardTab, setActiveCardTab] = useState('updates');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSprint, setTaskSprint] = useState(sprints?.[0]?.id || 'backlog');
  const [taskType, setTaskType] = useState('Frontend');
  const [taskStatus, setTaskStatus] = useState('Ready to start');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskSP, setTaskSP] = useState(3);
  const [customTaskId, setCustomTaskId] = useState('');
  const [showCustomKeyEditor, setShowCustomKeyEditor] = useState(false);
  const [newProjectKeyInput, setNewProjectKeyInput] = useState('LUX');
  const [editTaskIdInput, setEditTaskIdInput] = useState('');
  const [isEditingDrawerTaskId, setIsEditingDrawerTaskId] = useState(false);
  const [drawerTaskIdInput, setDrawerTaskIdInput] = useState('');
  const [sprintName, setSprintName] = useState(`Sprint ${(sprints?.length || 1) + 1}`);
  const [sprintGoal, setSprintGoal] = useState('Deliver core features and authentication');
  const [sprintDatesInput, setSprintDatesInput] = useState('');
  const [showSprintDatePicker, setShowSprintDatePicker] = useState(false);
  const [sprintStartDateDraft, setSprintStartDateDraft] = useState('');
  const [sprintEndDateDraft, setSprintEndDateDraft] = useState('');
  const [manualDatesText, setManualDatesText] = useState('');
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [standupText, setStandupText] = useState('');
  const [taskAssets, setTaskAssets] = useState([]);
  const [isTaskAssetMenuOpen, setIsTaskAssetMenuOpen] = useState(false);
  const [isTaskLinkFormOpen, setIsTaskLinkFormOpen] = useState(false);
  const [taskLinkTitle, setTaskLinkTitle] = useState('');
  const [taskLinkUrl, setTaskLinkUrl] = useState('');
  const [isUploadingTaskAsset, setIsUploadingTaskAsset] = useState(false);
  const [taskAssetPendingDelete, setTaskAssetPendingDelete] = useState(null);
  const taskAssetFileInputRef = useRef(null);
  const [standupUpdates, setStandupUpdates] = useState([
    { id: 1, author: 'Sivakumar', update: 'Yesterday: Built Google OAuth UI. Today: Adding full interactions to Backlog. Blockers: None.' },
    { id: 2, author: 'Franklin ', update: 'Yesterday: Setup Postgres schema. Today: Unit tests for sprint controllers. Blockers: None.' },
  ]);

  // Sync manual date editor with active sprint target whenever modal opens
  useEffect(() => {
    if (activeModal === 'sprintDates' && activeTaskTarget) {
      const existingDates = activeTaskTarget.dates;
      setManualDatesText(existingDates && existingDates !== 'Add Sprint dates' ? existingDates : '');
    }
  }, [activeModal, activeTaskTarget]);

  // Keep new sprint name suggestion in sync
  useEffect(() => {
    if (activeModal === 'createSprint') {
      setSprintName(`Sprint ${(sprints?.length || 1) + 1}`);
      setSprintDatesInput('');
      setSprintStartDateDraft('');
      setSprintEndDateDraft('');
      setShowSprintDatePicker(false);
    }
  }, [activeModal, sprints?.length]);

  // Sync custom Task ID whenever createTask modal opens (defaults to auto-continuous sequence)
  useEffect(() => {
    if (activeModal === 'createTask') {
      setShowCustomKeyEditor(false);
      setCustomTaskId(getNextJiraTaskId(allTasks, projectKey).taskId);
      setTaskSprint(sprints?.[0]?.id || 'backlog');
      setTaskDueDate('');
    }
  }, [activeModal, allTasks, projectKey, sprints]);

  // Sync Project Key settings modal input
  useEffect(() => {
    if (activeModal === 'projectKeySettings') {
      setNewProjectKeyInput(projectKey || 'LUX');
    }
  }, [activeModal, projectKey]);

  // Sync edit Task ID input whenever editTaskId modal opens
  useEffect(() => {
    if (activeModal === 'editTaskId' && activeTaskTarget) {
      setEditTaskIdInput(activeTaskTarget.taskId || '');
    }
  }, [activeModal, activeTaskTarget]);

  // Reset and sync task card state when card opens or target changes
  useEffect(() => {
    if ((activeModal === 'taskComments' || activeModal === 'taskDetails') && activeTaskTarget) {
      setIsEditingDrawerTaskId(false);
      setDrawerTaskIdInput(activeTaskTarget.taskId || '');
      setDescriptionDraft(activeTaskTarget.description || '');
      setCardTitleDraft(activeTaskTarget.title || '');
      setIsEditingDescription(false);
      setIsEditingCardTitle(false);
      setCommentInput('');
      setNewChecklistItem('');
      setActiveCardTab('updates');
      setTaskAssets([]);
      setIsTaskAssetMenuOpen(false);
      setIsTaskLinkFormOpen(false);
      setTaskLinkTitle('');
      setTaskLinkUrl('');
      setTaskAssetPendingDelete(null);
    }
  }, [activeModal, activeTaskTarget]);

  useEffect(() => {
    if ((activeModal !== 'taskComments' && activeModal !== 'taskDetails') || !activeTaskTarget?.id) {
      return undefined;
    }

    let isCurrent = true;
    boardAssetApi.getAll(activeTaskTarget.id)
      .then((assets) => {
        if (isCurrent) setTaskAssets(assets);
      })
      .catch((error) => {
        console.error('[TaskDetails] Unable to load task attachments.', error);
        if (isCurrent) showToast('Unable to load task attachments. Please try again.', 'error');
      });
    return () => {
      isCurrent = false;
    };
  }, [activeModal, activeTaskTarget?.id, showToast]);

  const getTaskAssetErrorMessage = (error) => {
    const responseData = error.response?.data;
    if (responseData instanceof Blob) return error.message || 'Please try again.';
    if (responseData && typeof responseData === 'object') {
      return Object.entries(responseData)
        .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
        .join('; ');
    }
    return error.message || 'Please try again.';
  };

  const handleTaskFileUpload = async (event, task) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    setIsTaskAssetMenuOpen(false);
    if (!files.length) return;

    const tooLarge = files.find((file) => file.size > 25 * 1024 * 1024);
    if (tooLarge) {
      showToast(`${tooLarge.name} exceeds the 25 MB per-file limit.`, 'error');
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024) {
      showToast('Selected files exceed the 100 MB total upload limit.', 'error');
      return;
    }

    setIsUploadingTaskAsset(true);
    try {
      const asset = await boardAssetApi.uploadFiles(files, task.id);
      setTaskAssets((previous) => [asset, ...previous]);
      showToast(`Uploaded ${asset.filename} to ${task.taskId}.`, 'success');
    } catch (error) {
      console.error('[TaskDetails] Unable to upload task files.', error);
      showToast(`Unable to upload files: ${getTaskAssetErrorMessage(error)}`, 'error');
    } finally {
      setIsUploadingTaskAsset(false);
    }
  };

  const handleTaskLinkSubmit = async (event, task) => {
    event.preventDefault();
    setIsUploadingTaskAsset(true);
    try {
      const asset = await boardAssetApi.createLink({
        title: taskLinkTitle.trim(),
        url: taskLinkUrl.trim(),
        taskId: task.id,
      });
      setTaskAssets((previous) => [asset, ...previous]);
      setTaskLinkTitle('');
      setTaskLinkUrl('');
      setIsTaskLinkFormOpen(false);
      setIsTaskAssetMenuOpen(false);
      showToast('Link added to this task.', 'success');
    } catch (error) {
      console.error('[TaskDetails] Unable to save task link.', error);
      showToast(`Unable to add link: ${getTaskAssetErrorMessage(error)}`, 'error');
    } finally {
      setIsUploadingTaskAsset(false);
    }
  };

  const handleTaskAssetDownload = async (asset) => {
    try {
      const blob = await boardAssetApi.download(asset.id);
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = asset.filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error('[TaskDetails] Unable to download task archive.', error);
      showToast(`Unable to download archive: ${getTaskAssetErrorMessage(error)}`, 'error');
    }
  };

  const handleTaskAssetDelete = async (asset) => {
    const assetName = asset.kind === 'archive' ? asset.filename : asset.title;
    setTaskAssetPendingDelete({ asset, name: assetName });
  };

  const confirmTaskAssetDelete = async () => {
    if (!taskAssetPendingDelete || isUploadingTaskAsset) return;
    const { asset } = taskAssetPendingDelete;
    setIsUploadingTaskAsset(true);
    try {
      await boardAssetApi.delete(asset.id);
      setTaskAssets((previous) => previous.filter((item) => item.id !== asset.id));
      setTaskAssetPendingDelete(null);
      showToast('Attachment deleted.', 'success');
    } catch (error) {
      console.error('[TaskDetails] Unable to delete task attachment.', error);
      showToast(`Unable to delete attachment: ${getTaskAssetErrorMessage(error)}`, 'error');
    } finally {
      setIsUploadingTaskAsset(false);
    }
  };

  if (!activeModal) return null;

  return (
    <>

      {activeModal === 'sidebar' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-sidebar-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-drawer-header">
              <h3>Jira Clone Navigation</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="backlog-drawer-menu">
              <button type="button" className="backlog-drawer-item active" onClick={onClose}>
                <span>📋 Backlog</span>
              </button>
              <button
                type="button"
                className="backlog-drawer-item"
                onClick={() => {
                  onClose();
                  navigate('/work/tasks');
                }}
              >
                <span>📊 Kanban Board</span>
              </button>
              <button
                type="button"
                className="backlog-drawer-item"
                onClick={() => {
                  onClose();
                  showToast('Roadmap view activated', 'info');
                }}
              >
                <span>🗺 Roadmap & Timeline</span>
              </button>
              <button
                type="button"
                className="backlog-drawer-item"
                onClick={() => {
                  onClose();
                  showToast('Opening Releases', 'info');
                }}
              >
                <span>🚀 Releases & Versions</span>
              </button>
              <div className="backlog-drawer-divider" />
              <button
                type="button"
                className="backlog-drawer-item"
                onClick={() => {
                  onClose();
                  navigate('/signin');
                }}
              >
                <span>🚪 Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {activeModal === 'tasksDropdown' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 250 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Switch Workspace</div>
            <button
              type="button"
              className="backlog-popover-list-item active"
              onClick={() => {
                showToast('Switched to Core Platform Tasks', 'info');
                onClose();
              }}
            >
              <span>📁 Core Platform Tasks</span>
              <CheckIcon size={14} />
            </button>
            <button
              type="button"
              className="backlog-popover-list-item"
              onClick={() => {
                showToast('Switched to Frontend Dev Board', 'info');
                onClose();
              }}
            >
              <span>⚛ Frontend Web App</span>
            </button>
            <button
              type="button"
              className="backlog-popover-list-item"
              onClick={() => {
                showToast('Switched to Mobile API & Microservices', 'info');
                onClose();
              }}
            >
              <span>📱 Mobile Services</span>
            </button>
          </div>
        </div>
      )}


      {activeModal === 'sprintsOverview' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <h3>Sprints Overview & Velocity</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="backlog-dialog-body">
              <div className="backlog-stats-grid">
                <div className="backlog-stat-card">
                  <span className="stat-label">Sprint 1 Velocity</span>
                  <span className="stat-val">{sprint1SPSum} SP</span>
                  <span className="stat-sub">Committed: {sprint1Tasks.length} tasks</span>
                </div>
                <div className="backlog-stat-card">
                  <span className="stat-label">Backlog Size</span>
                  <span className="stat-val">{backlogTasks.length} tasks</span>
                  <span className="stat-sub">{backlogSPSum} SP estimated</span>
                </div>
                <div className="backlog-stat-card">
                  <span className="stat-label">Sprint 1 Status</span>
                  <span className="stat-val" style={{ color: isSprint1Started ? '#00c875' : '#ffab40' }}>
                    {isSprint1Started ? 'Active' : 'Planning'}
                  </span>
                  <span className="stat-sub">{sprint1Dates}</span>
                </div>
              </div>
              <div className="backlog-progress-overview">
                <span className="overview-title">Sprint 1 Status Distribution</span>
                <div className="backlog-segmented-bar large">
                  {sprint1StatusStats.map((seg) => (
                    <div
                      key={seg.status}
                      className="backlog-segment-piece"
                      style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
                      title={`${seg.status}: ${seg.count}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="backlog-dialog-footer">
              <button type="button" className="backlog-btn-primary-blue" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. INTEGRATIONS MODAL (GITHUB) */}
      {activeModal === 'integrate' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <div className="backlog-dialog-title-group">
                <GithubIcon />
                <h3>GitHub Integration</h3>
              </div>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="backlog-dialog-body">
              <div className="backlog-integration-item">
                <div className="backlog-integration-info">
                  <span className="repo-name">office_task/AppCore</span>
                  <span className="repo-status connected">● Connected & Synced</span>
                </div>
                <button
                  type="button"
                  className="backlog-btn-secondary-dark"
                  onClick={() => showToast('Synced repository branches & commits!', 'success')}
                >
                  Sync now
                </button>
              </div>
              <div className="backlog-sync-details">
                <p>Linked branches:</p>
                <div className="backlog-branch-tags">
                  <span className="branch-tag">main</span>
                  <span className="branch-tag">feat/google-popup</span>
                  <span className="branch-tag">feat/backlog-ui</span>
                </div>
              </div>
            </div>
            <div className="backlog-dialog-footer">
              <button
                type="button"
                className="backlog-btn-primary-blue"
                onClick={() => {
                  showToast('GitHub webhook settings updated.', 'success');
                  onClose();
                }}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. AUTOMATIONS MODAL */}
      {activeModal === 'automate' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <h3>Automations & Workflows</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="backlog-dialog-body">
              <div className="backlog-recipes-list">
                {automations.map((item) => (
                  <div key={item.id} className="backlog-recipe-card">
                    <span className="recipe-text">{item.name}</span>
                    <button
                      type="button"
                      className={`backlog-toggle-switch ${item.enabled ? 'on' : 'off'}`}
                      onClick={() => {
                        setAutomations((prev) =>
                          prev.map((a) => (a.id === item.id ? { ...a, enabled: !a.enabled } : a))
                        );
                        showToast(`Automation rule ${item.enabled ? 'paused' : 'activated'}`, 'info');
                      }}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="backlog-dialog-footer">
              <button
                type="button"
                className="backlog-btn-secondary-dark"
                onClick={() => showToast('New automation recipe wizard opened', 'info')}
              >
                + Add recipe
              </button>
              <button type="button" className="backlog-btn-primary-blue" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. AGENTS MODAL */}
      {activeModal === 'agents' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <h3>AI & DevOps Agents</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="backlog-dialog-body">
              <div className="agent-item">
                <div className="agent-badge active">Active</div>
                <div className="agent-details">
                  <h4>Code Reviewer Agent</h4>
                  <p>Automatically scans pull requests, detects lint errors and suggests optimizations.</p>
                </div>
              </div>
              <div className="agent-item">
                <div className="agent-badge active">Active</div>
                <div className="agent-details">
                  <h4>Story Point Estimator Agent</h4>
                  <p>Uses team historical velocity to predict estimation points for new tasks.</p>
                </div>
              </div>
            </div>
            <div className="backlog-dialog-footer">
              <button type="button" className="backlog-btn-primary-blue" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. INVITE MODAL */}
      {activeModal === 'invite' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <h3>Invite Teammates</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSendingInvite(true);
                try {
                  const { data } = await authApi.createTeamInvitation({
                    email: inviteEmail.trim(),
                    role: inviteRole,
                  });
                  showToast(data.message || `Invitation sent to ${inviteEmail.trim()}.`, 'success');
                  setInviteEmail('');
                  onClose();
                } catch (error) {
                  const detail = error.response?.data?.detail
                    || error.response?.data?.email?.[0]
                    || error.response?.data?.role?.[0]
                    || error.message;
                  showToast(`Unable to send invitation: ${detail}`, 'error');
                } finally {
                  setIsSendingInvite(false);
                }
              }}
            >
              <div className="backlog-dialog-body">
                <div className="dialog-field-group">
                  <label htmlFor="invite-email-input">Email Address</label>
                  <input
                    id="invite-email-input"
                    type="email"
                    className="dialog-input"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="dialog-field-group">
                  <label htmlFor="invite-role-select">Role</label>
                  <select
                    id="invite-role-select"
                    className="dialog-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    {canInviteElevatedRoles && <option value="admin">Admin (Full Control)</option>}
                    {canInviteElevatedRoles && <option value="team_lead">Team Lead (Manage Tasks & Sprints)</option>}
                    <option value="user">User (Standard Access)</option>
                  </select>
                </div>
              </div>
              <div className="backlog-dialog-footer">
                <button type="button" className="backlog-btn-secondary-dark" onClick={onClose} disabled={isSendingInvite}>
                  Cancel
                </button>
                <button type="submit" className="backlog-btn-primary-blue" disabled={isSendingInvite}>
                  {isSendingInvite ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. HEADER MORE MENU */}
      {activeModal === 'headerMenu' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'right', width: 210 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Board Options</div>
            <button
              type="button"
              className="backlog-popover-list-item"
              onClick={() => {
                showToast('Board exported as CSV!', 'success');
                onClose();
              }}
            >
              <span>📥 Export Board as CSV</span>
            </button>
            <button
              type="button"
              className="backlog-popover-list-item"
              onClick={() => {
                showToast('Board permissions updated', 'info');
                onClose();
              }}
            >
              <span>🔒 Board Permissions</span>
            </button>
            <button
              type="button"
              className="backlog-popover-list-item"
              onClick={() => {
                showToast('Notification preferences saved', 'info');
                onClose();
              }}
            >
              <span>🔔 Notification Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* 9. BOARD VIEWS POPOVER (MATCHING USER SCREENSHOT) */}
      {activeModal === 'addView' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker board-views-popover"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 235, offset: 6, flipThreshold: 450 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="board-views-header">
              <span className="board-views-title">Board views</span>
              <button
                type="button"
                className="board-views-info-btn"
                title="Board views allow you to visualize your tasks in different formats"
                onClick={() => showToast('Select a board view to visualize your tasks', 'info')}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 7.5v4" strokeLinecap="round" />
                  <circle cx="8" cy="5" r="0.75" fill="currentColor" />
                </svg>
              </button>
            </div>

            <div className="board-views-menu">
              {[
                {
                  id: 'Table',
                  label: 'Table',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
                      <path d="M2 6.5h12M2 10h12M7.5 2.5v11" />
                    </svg>
                  ),
                },
                {
                  id: 'Gantt',
                  label: 'Gantt',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M2.5 4h5M5.5 8h7.5M2.5 12h5.5" />
                    </svg>
                  ),
                },
                {
                  id: 'Chart',
                  label: 'Chart',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="8" cy="8" r="6.2" />
                      <path d="M8 8V4.5M8 8l-2.8 2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  id: 'Calendar',
                  label: 'Calendar',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="2.5" y="3.5" width="11" height="10.5" rx="1.5" />
                      <path d="M2.5 6.5h11M5 2v3M11 2v3" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  id: 'Kanban',
                  label: 'Kanban',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="2.5" y="2.5" width="4.5" height="11" rx="1" />
                      <rect x="9" y="2.5" width="4.5" height="8" rx="1" />
                    </svg>
                  ),
                },
                {
                  id: 'Roadmap tracker',
                  label: 'Roadmap tracker',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="2.5" y="3.5" width="11" height="10.5" rx="1.5" />
                      <path d="M2.5 6.5h11M5 2v3M11 2v3" strokeLinecap="round" />
                      <path d="M5.5 10.5l1.8 1.8 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  id: 'Hierarchy',
                  label: 'Hierarchy',
                  isNew: true,
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <circle cx="8" cy="3.5" r="1.5" />
                      <circle cx="4" cy="12.5" r="1.5" />
                      <circle cx="12" cy="12.5" r="1.5" />
                      <path d="M8 5v3.5M4 11V8.5h8V11" />
                    </svg>
                  ),
                },
                {
                  id: 'Agile insights',
                  label: 'Agile insights',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M2 13.5h12M3 11l3.5-4.5 3 3L13.5 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  id: 'Doc',
                  label: 'Doc',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M3.5 2.5h6l3.5 3.5v7.5a1 1 0 01-1 1h-8.5a1 1 0 01-1-1V3a1 1 0 011-1z" />
                      <path d="M9.5 2.5v3.5h3.5" />
                    </svg>
                  ),
                },
                {
                  id: 'Dashboard',
                  label: 'Dashboard',
                  icon: (
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
                      <path d="M5 11.5v-3M8 11.5v-5M11 11.5v-2" strokeLinecap="round" />
                    </svg>
                  ),
                },
              ].map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className="board-view-option-item"
                  onClick={() => {
                    if (onSelectBoardView) {
                      onSelectBoardView(view.label);
                    } else {
                      showToast(`Switched to ${view.label} view`, 'success');
                      onClose();
                    }
                  }}
                >
                  <span className="board-view-option-icon">{view.icon}</span>
                  <span className="board-view-option-label">{view.label}</span>
                  {view.isNew && <span className="board-view-new-badge">New</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 10. CREATE TASK MODAL (JIRA-STYLE AUTO-CONTINUOUS NUMBERING) */}
      {activeModal === 'createTask' && (() => {
        const autoSeq = getNextJiraTaskId(allTasks, projectKey);
        const resolvedTaskId = (showCustomKeyEditor && customTaskId.trim())
          ? customTaskId.trim().toUpperCase()
          : autoSeq.taskId;

        const isCurrentDuplicate = Boolean(
          showCustomKeyEditor &&
          customTaskId.trim() &&
          allTasks.some(
            (t) => t.taskId && t.taskId.trim().toUpperCase() === customTaskId.trim().toUpperCase()
          )
        );

        return (
          <div className="backlog-modal-overlay" onClick={onClose}>
            <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
              <div className="backlog-dialog-header">
                <div className="dialog-header-with-badge">
                  <h3>Create New Task</h3>
                  <span className="admin-status-pill">
                    <ShieldIcon size={12} /> Jira Numbering
                  </span>
                </div>
                <button type="button" className="backlog-modal-close" onClick={onClose}>
                  <CloseIcon />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!taskTitle.trim()) return;
                  if (isCurrentDuplicate) {
                    showToast(`Task ID "${resolvedTaskId}" already exists! Admin must provide a unique ID.`, 'error');
                    return;
                  }
                  const isPastIncomplete = isPastDate(taskDueDate) && isTaskIncomplete(taskStatus);
                  onCreateTask({
                    title: taskTitle.trim(),
                    sprint: isPastIncomplete ? 'backlog' : taskSprint,
                    type: taskType,
                    status: taskStatus,
                    sp: Number(taskSP) || null,
                    customTaskId: resolvedTaskId,
                    dueDate: taskDueDate,
                  });
                  setTaskTitle('');
                  setCustomTaskId('');
                  setShowCustomKeyEditor(false);
                  setTaskStatus('Ready to start');
                  setTaskDueDate('');
                  onClose();
                }}
              >
                <div className="backlog-dialog-body">
                  {/* Jira-Style Continuous Auto ID Card */}
                  <div className="jira-auto-id-banner">
                    <div className="jira-auto-id-left">
                      <div className="jira-auto-id-badge-row">
                        <span className="jira-auto-id-badge">
                          <ShieldIcon size={11} /> Auto-Continuous ID
                        </span>
                        <span className="jira-like-pill">Like Jira ⚡</span>
                      </div>
                      <div className="jira-auto-id-title-row">
                        <span className="jira-auto-id-label">Task ID:</span>
                        <span className="jira-auto-id-value">{resolvedTaskId}</span>
                      </div>
                      <span className="jira-auto-id-hint">
                        Automatically continues number sequence (#{autoSeq.number}) from key <strong>{autoSeq.prefix}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="jira-customize-toggle-btn"
                      onClick={() => {
                        setShowCustomKeyEditor(!showCustomKeyEditor);
                        if (!showCustomKeyEditor) {
                          setCustomTaskId(autoSeq.taskId);
                        }
                      }}
                      title="Set a new Project Key once; subsequent tasks will continue from it automatically"
                    >
                      <KeyIcon size={12} />
                      <span>{showCustomKeyEditor ? 'Use Auto' : 'Set Key Once ⚙️'}</span>
                    </button>
                  </div>

                  {/* Optional Custom Key / Sequence editor if Admin wants to change it once */}
                  {showCustomKeyEditor && (
                    <div className="jira-custom-key-box">
                      <div className="dialog-field-label-row">
                        <label htmlFor="create-task-id">
                          Custom Key / Starting ID <span className="dialog-required-mark">*</span>
                        </label>
                        <span className="admin-field-badge">Admin Once</span>
                      </div>
                      <div className="dialog-input-with-button">
                        <input
                          id="create-task-id"
                          type="text"
                          className={`dialog-input ${
                            isCurrentDuplicate ? 'input-error' : 'input-success'
                          }`}
                          placeholder="e.g. CORE-1 or LUX-004"
                          value={customTaskId}
                          onChange={(e) => setCustomTaskId(e.target.value.toUpperCase())}
                          required
                        />
                        <button
                          type="button"
                          className="dialog-inline-action-btn"
                          onClick={() => {
                            setCustomTaskId(autoSeq.taskId);
                            showToast(`Reset to next sequence: ${autoSeq.taskId}`, 'info');
                          }}
                          title="Reset to next sequential ID"
                        >
                          <RefreshIcon />
                          <span>Reset</span>
                        </button>
                      </div>
                      {isCurrentDuplicate ? (
                        <div className="field-validation-message error">
                          ⚠️ Task ID "{customTaskId.trim()}" is already in use! Please choose a unique key.
                        </div>
                      ) : (
                        <span className="dialog-field-hint">
                          Setting this once will automatically continue subsequent tasks from this new sequence (like Jira).
                        </span>
                      )}
                    </div>
                  )}

                  <div className="dialog-field-group">
                    <label htmlFor="create-task-title">Task Title</label>
                    <input
                      id="create-task-title"
                      type="text"
                      className="dialog-input"
                      placeholder="What needs to be done?"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="dialog-field-group">
                    <label htmlFor="create-task-due-date">Due date</label>
                    <input
                      id="create-task-due-date"
                      type="date"
                      className="dialog-input"
                      value={taskDueDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaskDueDate(val);
                        if (isPastDate(val) && isTaskIncomplete(taskStatus)) {
                          setTaskSprint('backlog');
                        }
                      }}
                    />
                    {isPastDate(taskDueDate) && isTaskIncomplete(taskStatus) && (
                      <div className="backlog-past-date-notice">
                        <span className="notice-icon">⏳</span>
                        <span>
                          Past date detected: Incomplete tasks created for past dates automatically route to the <strong>Backlog</strong> page.
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="dialog-field-group">
                    <label htmlFor="create-task-sprint">Sprint / Location</label>
                    <select
                      id="create-task-sprint"
                      className="dialog-select"
                      value={isPastDate(taskDueDate) && isTaskIncomplete(taskStatus) ? 'backlog' : taskSprint}
                      onChange={(e) => setTaskSprint(e.target.value)}
                      disabled={isPastDate(taskDueDate) && isTaskIncomplete(taskStatus)}
                    >
                      {sprints && sprints.length > 0 &&
                        sprints.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.isStarted ? '(Active)' : ''}
                          </option>
                        ))
                      }
                      <option value="backlog">Backlog {isPastDate(taskDueDate) && isTaskIncomplete(taskStatus) ? '(Auto - Past Date)' : ''}</option>
                    </select>
                    {isPastDate(taskDueDate) && isTaskIncomplete(taskStatus) && (
                      <span className="dialog-field-hint" style={{ color: '#f59e0b', marginTop: '4px', display: 'block' }}>
                        Past-due incomplete tasks are automatically assigned to Backlog.
                      </span>
                    )}
                  </div>
                  <div className="dialog-field-row">
                    <div className="dialog-field-group">
                      <label htmlFor="create-task-type">Type</label>
                      <select
                        id="create-task-type"
                        className="dialog-select"
                        value={taskType}
                        onChange={(e) => setTaskType(e.target.value)}
                      >
                        {Object.keys(typeConfig || TYPE_CONFIG).map((tp) => (
                          <option key={tp} value={tp}>
                            {tp}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="dialog-field-group">
                      <label htmlFor="create-task-status">Status</label>
                      <select
                        id="create-task-status"
                        className="dialog-select"
                        value={taskStatus}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTaskStatus(val);
                          if (isPastDate(taskDueDate) && isTaskIncomplete(val)) {
                            setTaskSprint('backlog');
                          }
                        }}
                      >
                        {Object.keys(statusConfig || STATUS_CONFIG).map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="dialog-field-group">
                    <label htmlFor="create-task-sp">Estimated Story Points</label>
                    <input
                      id="create-task-sp"
                      type="number"
                      min="1"
                      max="40"
                      className="dialog-input"
                      value={taskSP}
                      onChange={(e) => setTaskSP(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="backlog-dialog-footer">
                  <button type="button" className="backlog-btn-secondary-dark" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="backlog-btn-primary-blue"
                    disabled={Boolean(isCurrentDuplicate || !resolvedTaskId)}
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* 11. CREATE SPRINT MODAL */}
      {activeModal === 'createSprint' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <h3>Plan and Create Sprint</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onCreateSprint({
                  name: sprintName,
                  goal: sprintGoal,
                  dates: sprintDatesInput,
                });
                setSprintDatesInput('');
                onClose();
              }}
            >
              <div className="backlog-dialog-body">
                <div className="dialog-field-group">
                  <label htmlFor="create-sprint-name">Sprint Name</label>
                  <input
                    id="create-sprint-name"
                    type="text"
                    className="dialog-input"
                    value={sprintName}
                    onChange={(e) => setSprintName(e.target.value)}
                    placeholder="e.g. Sprint 2"
                    required
                    autoFocus
                  />
                </div>
                <div className="dialog-field-group">
                  <label htmlFor="create-sprint-dates">Sprint Dates (Optional manual date range)</label>
                  <div className="sprint-date-field">
                    <input
                      id="create-sprint-dates"
                      type="text"
                      className="dialog-input"
                      value={sprintDatesInput}
                      onChange={(e) => {
                        setSprintDatesInput(e.target.value);
                        setSprintStartDateDraft('');
                        setSprintEndDateDraft('');
                      }}
                      placeholder="e.g. Oct 16 - Oct 30 (2 weeks)"
                    />
                    <button
                      type="button"
                      className="sprint-date-picker-toggle"
                      aria-label="Choose sprint dates from calendar"
                      aria-expanded={showSprintDatePicker}
                      aria-controls="create-sprint-date-picker"
                      onClick={() => setShowSprintDatePicker((isOpen) => !isOpen)}
                    >
                      <CalendarIcon />
                    </button>
                    {showSprintDatePicker && (
                      <div
                        id="create-sprint-date-picker"
                        className="sprint-date-picker"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="sprint-date-picker-fields">
                          <label>
                            Start date
                            <input
                              type="date"
                              value={sprintStartDateDraft}
                              max={sprintEndDateDraft || undefined}
                              onChange={(e) => {
                                setSprintStartDateDraft(e.target.value);
                                if (sprintEndDateDraft && e.target.value > sprintEndDateDraft) {
                                  setSprintEndDateDraft('');
                                }
                              }}
                            />
                          </label>
                          <label>
                            End date
                            <input
                              type="date"
                              value={sprintEndDateDraft}
                              min={sprintStartDateDraft || undefined}
                              onChange={(e) => setSprintEndDateDraft(e.target.value)}
                            />
                          </label>
                        </div>
                        <div className="sprint-date-picker-actions">
                          <button
                            type="button"
                            className="backlog-btn-secondary-dark"
                            onClick={() => setShowSprintDatePicker(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="backlog-btn-primary-blue"
                            disabled={!sprintStartDateDraft || !sprintEndDateDraft || sprintEndDateDraft < sprintStartDateDraft}
                            onClick={() => {
                              const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              });
                              setSprintDatesInput(`${formatDate(sprintStartDateDraft)} - ${formatDate(sprintEndDateDraft)}`);
                              setShowSprintDatePicker(false);
                            }}
                          >
                            Set dates
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="dialog-field-group">
                  <label htmlFor="create-sprint-goal">Sprint Goal</label>
                  <textarea
                    id="create-sprint-goal"
                    className="dialog-textarea"
                    rows={3}
                    value={sprintGoal}
                    onChange={(e) => setSprintGoal(e.target.value)}
                    placeholder="What does the team aim to achieve in this sprint?"
                  />
                </div>
              </div>
              <div className="backlog-dialog-footer">
                <button type="button" className="backlog-btn-secondary-dark" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="backlog-btn-primary-blue">
                  Create Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 12. FILTER MENU POPOVER */}
      {activeModal === 'filterMenu' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 260 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Filter by Status</div>
            {['all', 'Ready to start', 'In Progress', 'In Review', 'Done'].map((st) => (
              <button
                key={st}
                type="button"
                className={`backlog-popover-list-item ${statusFilter === st ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter(st);
                  onClose();
                }}
              >
                <span>{st === 'all' ? 'All Statuses' : st}</span>
                {statusFilter === st && <CheckIcon size={14} />}
              </button>
            ))}
            <div className="backlog-drawer-divider" />
            <div className="backlog-popover-title">Filter by Type</div>
            {['all', ...Object.keys(typeConfig || TYPE_CONFIG)].map((tp) => (
              <button
                key={tp}
                type="button"
                className={`backlog-popover-list-item ${typeFilter === tp ? 'active' : ''}`}
                onClick={() => {
                  setTypeFilter(tp);
                  onClose();
                }}
              >
                <span>{tp === 'all' ? 'All Types' : tp}</span>
                {typeFilter === tp && <CheckIcon size={14} />}
              </button>
            ))}
            {(statusFilter !== 'all' || typeFilter !== 'all') && (
              <>
                <div className="backlog-drawer-divider" />
                <button
                  type="button"
                  className="backlog-popover-list-item backlog-popover-clear-item"
                  onClick={() => {
                    setStatusFilter('all');
                    setTypeFilter('all');
                    onClose();
                  }}
                >
                  <span>Reset All Filters</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* SORT MENU POPOVER */}
      {activeModal === 'sortMenu' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 230 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Sort Tasks</div>
            {[
              { id: null, label: 'Default' },
              { id: 'title-asc', label: 'Title (A → Z)' },
              { id: 'title-desc', label: 'Title (Z → A)' },
              { id: 'id-asc', label: 'Key / ID (Ascending)' },
              { id: 'id-desc', label: 'Key / ID (Descending)' },
              { id: 'sp-desc', label: 'Story Points (Highest)' },
              { id: 'sp-asc', label: 'Story Points (Lowest)' },
              { id: 'status', label: 'Status' },
            ].map(({ id, label }) => (
              <button
                key={label}
                type="button"
                className={`backlog-popover-list-item ${sortBy === id ? 'active' : ''}`}
                onClick={() => {
                  setSortBy(id);
                  if (showToast) {
                    showToast(id ? `Sorted by ${label}` : 'Sorting reset to default', 'info');
                  }
                  onClose();
                }}
              >
                <span>{label}</span>
                {sortBy === id && <CheckIcon size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 15. SPRINT MORE OPTIONS POPOVER */}
      {activeModal === 'sprintMore' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'right', width: 220 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">{activeTaskTarget?.name || 'Sprint'} Options</div>
            <button
              type="button"
              className="backlog-popover-list-item"
              onClick={() => {
                onClose();
                showToast(`Sprint Goal: "${activeTaskTarget?.goal || 'No goal set yet'}"`, 'info');
              }}
            >
              🎯 View Sprint Goal
            </button>
            <button
              type="button"
              className="backlog-popover-list-item"
              onClick={() => onMoveAllToBacklog(activeTaskTarget?.id)}
            >
              📦 Move all tasks to Backlog
            </button>
            {sprints && sprints.length > 1 && (
              <button
                type="button"
                className="backlog-popover-list-item"
                style={{ color: '#e2445c' }}
                onClick={() => onDeleteSprint(activeTaskTarget?.id)}
              >
                🗑️ Delete Sprint
              </button>
            )}
          </div>
        </div>
      )}

      {/* 16. PERSON FILTER POPOVER */}
      {activeModal === 'personFilter' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 220 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">{personFilterTitle}</div>
            <button
              type="button"
              className={`backlog-popover-list-item ${selectedPersonFilter === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedPersonFilter('all');
                onClose();
              }}
            >
              <span>All Persons</span>
              {selectedPersonFilter === 'all' && <CheckIcon size={14} />}
            </button>
            {personFilterMembers.length > 0 ? personFilterMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`backlog-popover-list-item ${selectedPersonFilter === m.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPersonFilter(m.id);
                  onClose();
                }}
              >
                <div className="flex-row-center">
                  <div className="tiny-avatar" style={{ backgroundColor: m.avatarBg }}>
                    {m.initial}
                  </div>
                  <span>{m.name}</span>
                </div>
                {selectedPersonFilter === m.id && <CheckIcon size={14} />}
              </button>
            )) : (
              <div className="backlog-popover-list-item">No board members yet</div>
            )}
          </div>
        </div>
      )}

      {/* 17. TOOLBAR MORE POPOVER */}
      {activeModal === 'toolbarMore' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker selection-actions-popover"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 340, flipThreshold: 380 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Selection & Actions</div>
            <div className="selection-quick-actions">
              <button
                type="button"
                className="backlog-popover-list-item"
                onClick={onSelectAllTasks}
              >
                ☑ Select all tasks
              </button>
              <button
                type="button"
                className="backlog-popover-list-item"
                onClick={onClearSelection}
              >
                ☐ Clear selection
              </button>
            </div>

            <div className="color-customizer-divider" />

            <div className="color-customizer-section">
              <div className="color-customizer-header">
                <span className="color-customizer-title">Badge Colors</span>
                <span className="color-customizer-sub">Auto-syncs across board</span>
              </div>

              <div className="color-customizer-tabs">
                <button
                  type="button"
                  className={`color-tab-btn ${colorTab === 'status' ? 'active' : ''}`}
                  onClick={() => setColorTab('status')}
                >
                  Status Colors
                </button>
                <button
                  type="button"
                  className={`color-tab-btn ${colorTab === 'type' ? 'active' : ''}`}
                  onClick={() => setColorTab('type')}
                >
                  Type Colors
                </button>
              </div>

              <div className="color-customizer-list">
                {colorTab === 'status' &&
                  Object.keys(statusConfig || STATUS_CONFIG).map((st) => {
                    const currentBg = (statusConfig && statusConfig[st]?.bg) || STATUS_CONFIG[st]?.bg || '#ffab40';
                    const currentText = (statusConfig && statusConfig[st]?.text) || STATUS_CONFIG[st]?.text || '#ffffff';
                    return (
                      <div key={st} className="color-customizer-row">
                        <div className="color-row-meta">
                          <span
                            className="color-preview-badge"
                            style={{ backgroundColor: currentBg, color: currentText }}
                          >
                            {st}
                          </span>
                          <span className="color-hex-label">{currentBg.toUpperCase()}</span>
                        </div>
                        <div className="color-swatches-wrap">
                          {PRESET_PALETTE.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              className={`color-swatch-circle ${currentBg.toLowerCase() === hex.toLowerCase() ? 'selected' : ''}`}
                              style={{ backgroundColor: hex }}
                              onClick={() => onUpdateStatusColor(st, hex)}
                              title={`Change ${st} to ${hex}`}
                            />
                          ))}
                          <label className="color-picker-native-label" title="Pick custom color">
                            <input
                              type="color"
                              value={currentBg}
                              onChange={(e) => onUpdateStatusColor(st, e.target.value)}
                              className="color-picker-native-input"
                            />
                            <span className="color-picker-icon">🎨</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}

                {colorTab === 'type' &&
                  Object.keys(typeConfig || TYPE_CONFIG).map((tp) => {
                    const currentBg = (typeConfig && typeConfig[tp]?.bg) || TYPE_CONFIG[tp]?.bg || '#f783ac';
                    const currentText = (typeConfig && typeConfig[tp]?.text) || TYPE_CONFIG[tp]?.text || '#ffffff';
                    return (
                      <div key={tp} className="color-customizer-row">
                        <div className="color-row-meta">
                          <span
                            className="color-preview-badge"
                            style={{ backgroundColor: currentBg, color: currentText }}
                          >
                            {tp}
                          </span>
                          <span className="color-hex-label">{currentBg.toUpperCase()}</span>
                        </div>
                        <div className="color-swatches-wrap">
                          {PRESET_PALETTE.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              className={`color-swatch-circle ${currentBg.toLowerCase() === hex.toLowerCase() ? 'selected' : ''}`}
                              style={{ backgroundColor: hex }}
                              onClick={() => onUpdateTypeColor(tp, hex)}
                              title={`Change ${tp} to ${hex}`}
                            />
                          ))}
                          <label className="color-picker-native-label" title="Pick custom color">
                            <input
                              type="color"
                              value={currentBg}
                              onChange={(e) => onUpdateTypeColor(tp, e.target.value)}
                              className="color-picker-native-input"
                            />
                            <span className="color-picker-icon">🎨</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 18. SPRINT DATES POPOVER (MANUAL SPRINT DATE EDITOR) */}
      {activeModal === 'sprintDates' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker sprint-dates-manual-popover"
            style={getAnchorStyle(anchorRect, { align: 'right', width: 330, flipThreshold: 420 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">
              {activeTaskTarget?.name ? `${activeTaskTarget.name} Timeline` : 'Sprint Timeline'}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const finalDate = manualDatesText.trim() || 'Add Sprint dates';
                if (onUpdateSprintDates) {
                  onUpdateSprintDates(activeTaskTarget?.id || sprints?.[0]?.id, finalDate);
                } else if (setSprint1Dates) {
                  setSprint1Dates(finalDate);
                }
                showToast(`Sprint dates saved: "${finalDate}"`, 'success');
                onClose();
              }}
              className="sprint-manual-dates-form"
            >
              {/* Direct Manual Text Edit */}
              <div className="dialog-field-group">
                <label htmlFor="manual-sprint-dates">Sprint Dates (Manual Edit)</label>
                <input
                  id="manual-sprint-dates"
                  type="text"
                  className="dialog-input"
                  placeholder="e.g. Oct 1 - Oct 15 (2 weeks)"
                  value={manualDatesText}
                  onChange={(e) => setManualDatesText(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Start & End Date Pickers */}
              <div className="sprint-date-pickers-row">
                <div className="dialog-field-group" style={{ flex: 1 }}>
                  <label htmlFor="sprint-start-date">Start Date</label>
                  <input
                    id="sprint-start-date"
                    type="date"
                    className="dialog-input date-input"
                    value={manualStartDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setManualStartDate(newStart);
                      if (newStart && manualEndDate) {
                        const s = new Date(newStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const end = new Date(manualEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        setManualDatesText(`${s} - ${end}`);
                      }
                    }}
                  />
                </div>
                <div className="dialog-field-group" style={{ flex: 1 }}>
                  <label htmlFor="sprint-end-date">End Date</label>
                  <input
                    id="sprint-end-date"
                    type="date"
                    className="dialog-input date-input"
                    value={manualEndDate}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setManualEndDate(newEnd);
                      if (manualStartDate && newEnd) {
                        const s = new Date(manualStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const end = new Date(newEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        setManualDatesText(`${s} - ${end}`);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Quick Duration Chips */}
              <div className="sprint-quick-durations">
                <span className="quick-duration-label">Quick duration:</span>
                <div className="quick-duration-chips">
                  {[
                    { label: '1 week', days: 7 },
                    { label: '2 weeks', days: 14 },
                    { label: '3 weeks', days: 21 },
                    { label: '4 weeks', days: 28 },
                  ].map((dur) => (
                    <button
                      key={dur.label}
                      type="button"
                      className="quick-dur-btn"
                      onClick={() => {
                        const baseDate = manualStartDate ? new Date(manualStartDate) : new Date();
                        const endDate = new Date(baseDate.getTime() + dur.days * 24 * 60 * 60 * 1000);
                        const sStr = baseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const eStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const formatted = `${sStr} - ${eStr} (${dur.label})`;
                        setManualDatesText(formatted);
                        setManualEndDate(endDate.toISOString().split('T')[0]);
                        if (!manualStartDate) {
                          setManualStartDate(baseDate.toISOString().split('T')[0]);
                        }
                      }}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presets list */}
              <div className="sprint-date-presets-list">
                <span className="quick-duration-label">Or choose a preset:</span>
                {['Oct 1 - Oct 15 (2 weeks)', 'Oct 16 - Oct 30 (2 weeks)', 'Nov 1 - Nov 15 (2 weeks)', 'Nov 16 - Nov 30 (2 weeks)'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="date-preset-item"
                    onClick={() => setManualDatesText(p)}
                  >
                    <span>{p}</span>
                  </button>
                ))}
              </div>

              {/* Form Action Buttons */}
              <div className="sprint-dates-actions">
                <button
                  type="button"
                  className="backlog-btn-secondary-dark"
                  onClick={() => {
                    setManualDatesText('Add Sprint dates');
                    setManualStartDate('');
                    setManualEndDate('');
                  }}
                >
                  Reset
                </button>
                <button type="submit" className="backlog-btn-primary-blue">
                  Save Dates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 19. CAPACITY POPOVER */}
      {activeModal === 'capacity' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'right', width: 280 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Story Points Capacity</div>
            <div style={{ padding: '4px' }}>
              {TEAM_MEMBERS.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '4px',
                  }}
                >
                  <div className="flex-row-center" style={{ gap: '8px' }}>
                    <div className="tiny-avatar" style={{ backgroundColor: m.avatarBg }}>
                      {m.initial}
                    </div>
                    <span style={{ fontSize: '13px', color: '#e0e4f6' }}>{m.name}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffab40' }}>10 SP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 20. DAILY STANDUP MODAL */}
      {activeModal === 'dailyStandup' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <h3>Daily Standup Feed</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="backlog-dialog-body">
              <div className="standup-feed">
                {standupUpdates.map((su) => (
                  <div key={su.id} className="standup-card">
                    <span className="standup-author">{su.author}</span>
                    <p className="standup-text">{su.update}</p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!standupText.trim()) return;
                  setStandupUpdates((prev) => [
                    ...prev,
                    { id: Date.now(), author: 'Sivakumar', update: standupText.trim() },
                  ]);
                  setStandupText('');
                  showToast('Your daily standup update was shared!', 'success');
                }}
                className="standup-composer"
              >
                <textarea
                  className="dialog-textarea"
                  rows={2}
                  placeholder="Yesterday I worked on... Today I will do..."
                  value={standupText}
                  onChange={(e) => setStandupText(e.target.value)}
                  required
                />
                <button type="submit" className="backlog-btn-primary-blue">
                  Post Standup
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 21. START SPRINT MODAL */}
      {activeModal === 'startSprint' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <h3>Start {activeTaskTarget?.name || 'Sprint 1'}</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="backlog-dialog-body">
              <p>Ready to start <strong>{activeTaskTarget?.name || sprints?.[0]?.name || 'Sprint'}</strong>?</p>
              <div className="sprint-summary-box">
                <div>Tasks: <strong>{allTasks.filter(t => t.sprintId === (activeTaskTarget?.id || sprints?.[0]?.id)).length}</strong></div>
                <div>Duration: <strong>{activeTaskTarget?.dates || sprint1Dates || 'Not set'}</strong></div>
              </div>
            </div>
            <div className="backlog-dialog-footer">
              <button type="button" className="backlog-btn-secondary-dark" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="backlog-btn-primary-blue"
                onClick={() => onStartSprint(activeTaskTarget?.id || sprints?.[0]?.id)}
              >
                Start Sprint 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 22. COMPLETE SPRINT MODAL (NEW: Full Lifecycle Working Process) */}
      {activeModal === 'completeSprint' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <h3>Complete {activeTaskTarget?.name || sprints?.[0]?.name || 'Sprint'}</h3>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="backlog-dialog-body">
              <p>Review sprint outcomes and wrap up {activeTaskTarget?.name || sprints?.[0]?.name || 'Sprint'}:</p>
              <div className="sprint-completion-stats">
                <div className="stat-pill done">
                  <CheckCircleIcon size={16} />
                  <span>
                    {allTasks.filter((t) => t.sprintId === (activeTaskTarget?.id || sprints?.[0]?.id) && t.status === 'Done').length} Completed
                  </span>
                </div>
                <div className="stat-pill pending">
                  <span>
                    {allTasks.filter((t) => t.sprintId === (activeTaskTarget?.id || sprints?.[0]?.id) && t.status !== 'Done').length} Incomplete
                  </span>
                </div>
              </div>
              <p className="sprint-complete-hint">
                Incomplete tasks will be automatically moved to the Backlog.
              </p>
            </div>
            <div className="backlog-dialog-footer">
              <button type="button" className="backlog-btn-secondary-dark" onClick={onClose}>
                Keep Running
              </button>
              <button
                type="button"
                className="backlog-btn-primary-blue"
                onClick={() => onCompleteSprint(activeTaskTarget?.id || sprints?.[0]?.id)}
              >
                Complete Sprint 🎉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 23. FULL TASK CARD DIALOG (JIRA & MONDAY.COM STYLE) */}
      {(activeModal === 'taskComments' || activeModal === 'taskDetails') && activeTaskTarget && (() => {
        const liveTask = allTasks.find((t) => t.id === activeTaskTarget.id) || activeTaskTarget;
        const currentSprint = sprints.find((s) => s.id === liveTask.sprintId);
        const ownerObj = TEAM_MEMBERS.find((m) => m.id === liveTask.owner);
        const comments = liveTask.comments || [];
        const checklist = liveTask.checklist || [];
        const completedChecklistCount = checklist.filter((item) => item.done).length;
        const checklistPercent = checklist.length > 0 ? Math.round((completedChecklistCount / checklist.length) * 100) : 0;
        const priority = liveTask.priority || 'Medium';

        return (
          <div className="backlog-modal-overlay backlog-task-card-overlay" onClick={onClose}>
            <div
              className="backlog-task-card-dialog"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* TOP HEADER / BREADCRUMB */}
              <div className="task-card-top-bar">
                <div className="task-card-breadcrumbs">
                  <span className="task-card-project-pill">
                    <span className="project-dot" /> {projectKey}
                  </span>
                  <span className="breadcrumb-divider">/</span>
                  <span className="task-card-sprint-pill">
                    {currentSprint ? currentSprint.name : 'Backlog'}
                  </span>
                  <span className="breadcrumb-divider">/</span>
                  {!isEditingDrawerTaskId ? (
                    <div className="task-card-id-wrapper">
                      <span
                        className="task-card-id-pill"
                        title="Click to copy ID"
                        onClick={() => {
                          navigator.clipboard.writeText(liveTask.taskId);
                          showToast(`Copied ${liveTask.taskId} to clipboard!`, 'info');
                        }}
                      >
                        {liveTask.taskId}
                      </span>
                      <button
                        type="button"
                        className="task-card-edit-id-btn"
                        onClick={() => {
                          setDrawerTaskIdInput(liveTask.taskId || '');
                          setIsEditingDrawerTaskId(true);
                        }}
                        title="Edit Task ID"
                      >
                        <EditIcon size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="task-card-id-inline-editor">
                      <input
                        type="text"
                        className="drawer-task-id-input"
                        value={drawerTaskIdInput}
                        onChange={(e) => setDrawerTaskIdInput(e.target.value.toUpperCase())}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="backlog-btn-primary-blue-sm"
                        onClick={() => {
                          const trimmed = drawerTaskIdInput.trim().toUpperCase();
                          if (!trimmed) return;
                          if (onUpdateTaskId) {
                            onUpdateTaskId(liveTask.id, trimmed);
                          }
                          setIsEditingDrawerTaskId(false);
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="backlog-btn-secondary-dark-sm"
                        onClick={() => setIsEditingDrawerTaskId(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="task-card-top-actions">
                  <button
                    type="button"
                    className="task-card-action-btn"
                    title="Copy direct card link"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      showToast('Task link copied to clipboard!', 'info');
                    }}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className="task-card-close-btn"
                    onClick={onClose}
                    title="Close card (Esc)"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              </div>

              {/* CARD MAIN BODY - 2 COLUMNS */}
              <div className="task-card-body-layout">
                {/* LEFT COLUMN: TITLE, DESCRIPTION, CHECKLIST, COMMENTS & UPDATES */}
                <div className="task-card-main-col">
                  {/* TITLE AREA */}
                  <div className="task-card-title-section">
                    {isTaskPastDueAndIncomplete(liveTask) && (
                      <div className="task-card-past-due-banner">
                        <span className="past-due-badge">Backlog</span>
                        <span>
                          Task date has finished ({liveTask.dueDate || liveTask.due_date}) but task is still incomplete. Assigned to <strong>Backlog</strong> field.
                        </span>
                      </div>
                    )}
                    {!isEditingCardTitle ? (
                      <h1
                        className="task-card-title-heading"
                        onClick={() => {
                          setCardTitleDraft(liveTask.title);
                          setIsEditingCardTitle(true);
                        }}
                        title="Click to edit task title"
                      >
                        {liveTask.title}
                        <span className="title-edit-hint"><EditIcon size={14} /></span>
                      </h1>
                    ) : (
                      <div className="task-card-title-editor">
                        <textarea
                          className="task-card-title-input"
                          value={cardTitleDraft}
                          onChange={(e) => setCardTitleDraft(e.target.value)}
                          rows={2}
                          autoFocus
                        />
                        <div className="task-card-editor-btn-row">
                          <button
                            type="button"
                            className="backlog-btn-primary-blue-sm"
                            onClick={() => {
                              const trimmed = cardTitleDraft.trim();
                              if (trimmed && onUpdateTaskDetails) {
                                onUpdateTaskDetails(liveTask.id, { title: trimmed });
                              }
                              setIsEditingCardTitle(false);
                            }}
                          >
                            Save Title
                          </button>
                          <button
                            type="button"
                            className="backlog-btn-secondary-dark-sm"
                            onClick={() => setIsEditingCardTitle(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QUICK TOOLBAR (JIRA STYLE) */}
                  <div className="task-card-quick-toolbar">
                    <button
                      type="button"
                      className="task-card-tool-chip"
                      onClick={() => setIsEditingDescription(true)}
                    >
                      <EditIcon size={12} /> Description
                    </button>
                    <button
                      type="button"
                      className="task-card-tool-chip"
                      onClick={() => {
                        const defaultItems = [
                          { id: 1, text: 'Review PR requirements', done: false },
                          { id: 2, text: 'Run automated checks & unit tests', done: false },
                        ];
                        if (onUpdateTaskDetails) {
                          onUpdateTaskDetails(liveTask.id, {
                            checklist: liveTask.checklist?.length ? liveTask.checklist : defaultItems,
                          });
                        }
                      }}
                    >
                      <CheckSquareIcon size={12} /> Checklist
                    </button>
                    {liveTask.githubLink ? (
                      <div className="task-card-github-chip">
                        <GithubIcon />
                        <span>{liveTask.githubLink}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="task-card-tool-chip"
                        onClick={() => {
                          const branch = `feature/${liveTask.taskId.toLowerCase()}`;
                          if (onGithubLink) onGithubLink(liveTask.id, branch);
                        }}
                      >
                        <GithubIcon /> Link Branch
                      </button>
                    )}
                  </div>

                  {/* DESCRIPTION SECTION */}
                  <div className="task-card-section">
                    <div className="task-card-section-header">
                      <h3>Description</h3>
                      <div className="task-card-section-actions">
                        {!isEditingDescription && (
                          <button
                            type="button"
                            className="task-card-section-edit-btn"
                            onClick={() => {
                              setDescriptionDraft(liveTask.description || '');
                              setIsEditingDescription(true);
                            }}
                          >
                            <EditIcon size={12} /> Edit
                          </button>
                        )}
                        {canUploadTaskAssets && (
                          <div className="task-attachment-menu-wrapper">
                            <button
                              type="button"
                              className="task-attachment-add-btn"
                              title="Add a ZIP file or link to this task"
                              aria-label="Add files or links to this task"
                              aria-haspopup="menu"
                              aria-expanded={isTaskAssetMenuOpen}
                              disabled={isUploadingTaskAsset}
                              onClick={() => setIsTaskAssetMenuOpen((open) => !open)}
                            >
                              <Plus size={15} />
                            </button>
                            {isTaskAssetMenuOpen && (
                              <div className="task-attachment-menu" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => taskAssetFileInputRef.current?.click()}
                                >
                                  <FileUp size={15} />
                                  <span>Upload files as ZIP</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setIsTaskAssetMenuOpen(false);
                                    setIsTaskLinkFormOpen(true);
                                  }}
                                >
                                  <LinkIcon size={15} />
                                  <span>Add a link</span>
                                </button>
                              </div>
                            )}
                            <input
                              ref={taskAssetFileInputRef}
                              type="file"
                              multiple
                              hidden
                              aria-label="Choose files to bundle into a task ZIP"
                              onChange={(event) => handleTaskFileUpload(event, liveTask)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {isTaskLinkFormOpen && (
                      <form
                        className="task-attachment-link-form"
                        onSubmit={(event) => handleTaskLinkSubmit(event, liveTask)}
                      >
                        <label>
                          Link title
                          <input
                            type="text"
                            maxLength={255}
                            value={taskLinkTitle}
                            onChange={(event) => setTaskLinkTitle(event.target.value)}
                            placeholder="Optional title"
                          />
                        </label>
                        <label>
                          URL
                          <input
                            type="url"
                            required
                            value={taskLinkUrl}
                            onChange={(event) => setTaskLinkUrl(event.target.value)}
                            placeholder="https://example.com"
                          />
                        </label>
                        <div className="task-attachment-form-actions">
                          <button
                            type="button"
                            className="task-attachment-cancel-btn"
                            onClick={() => {
                              setIsTaskLinkFormOpen(false);
                              setTaskLinkTitle('');
                              setTaskLinkUrl('');
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="task-attachment-save-btn"
                            disabled={isUploadingTaskAsset}
                          >
                            {isUploadingTaskAsset ? 'Saving…' : 'Add link'}
                          </button>
                        </div>
                      </form>
                    )}

                    {taskAssets.length > 0 && (
                      <div className="task-attachment-list" aria-label="Task attachments">
                        {taskAssets.map((asset) => (
                          <article key={asset.id} className="task-attachment-card">
                            <span className="task-attachment-icon">
                              {asset.kind === 'archive' ? <Archive size={16} /> : <LinkIcon size={16} />}
                            </span>
                            <div className="task-attachment-details">
                              <strong>{asset.kind === 'archive' ? asset.filename : asset.title}</strong>
                              <small>
                                {asset.kind === 'archive'
                                  ? `${asset.file_count} file${asset.file_count === 1 ? '' : 's'} · ZIP archive`
                                  : asset.url}
                              </small>
                            </div>
                            {asset.kind === 'archive' ? (
                              <>
                                <button
                                  type="button"
                                  className="task-attachment-action"
                                  aria-label={`Download ${asset.filename}`}
                                  title="Download ZIP archive"
                                  onClick={() => handleTaskAssetDownload(asset)}
                                >
                                  <Download size={15} />
                                </button>
                                {canUploadTaskAssets && (
                                  <button
                                    type="button"
                                    className="task-attachment-action danger"
                                    aria-label={`Delete ${asset.filename}`}
                                    title="Delete ZIP archive"
                                    disabled={isUploadingTaskAsset}
                                    onClick={() => handleTaskAssetDelete(asset)}
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <a
                                  className="task-attachment-action"
                                  href={asset.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Open ${asset.title}`}
                                  title="Open link"
                                >
                                  <ExternalLink size={15} />
                                </a>
                                {canUploadTaskAssets && (
                                  <button
                                    type="button"
                                    className="task-attachment-action danger"
                                    aria-label={`Delete ${asset.title}`}
                                    title="Delete link"
                                    disabled={isUploadingTaskAsset}
                                    onClick={() => handleTaskAssetDelete(asset)}
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                )}
                              </>
                            )}
                          </article>
                        ))}
                      </div>
                    )}

                    {taskAssetPendingDelete && (
                      <div
                        className="task-attachment-confirm-overlay"
                        onClick={() => !isUploadingTaskAsset && setTaskAssetPendingDelete(null)}
                      >
                        <div
                          className="task-attachment-confirm-dialog"
                          role="alertdialog"
                          aria-modal="true"
                          aria-labelledby="task-attachment-confirm-title"
                          aria-describedby="task-attachment-confirm-description"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <h3 id="task-attachment-confirm-title">Delete attachment?</h3>
                          <p id="task-attachment-confirm-description">
                            Are you sure you want to delete <strong>{taskAssetPendingDelete.name}</strong> from this task?
                            This action cannot be undone.
                          </p>
                          <div className="task-attachment-confirm-actions">
                            <button
                              type="button"
                              className="task-attachment-confirm-cancel"
                              disabled={isUploadingTaskAsset}
                              onClick={() => setTaskAssetPendingDelete(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="task-attachment-confirm-delete"
                              disabled={isUploadingTaskAsset}
                              onClick={confirmTaskAssetDelete}
                            >
                              {isUploadingTaskAsset ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isEditingDescription ? (
                      <div
                        className="task-card-description-preview"
                        onClick={() => {
                          setDescriptionDraft(liveTask.description || '');
                          setIsEditingDescription(true);
                        }}
                        title="Click to edit description"
                      >
                        {liveTask.description ? (
                          <p className="description-text">{liveTask.description}</p>
                        ) : (
                          <div className="description-placeholder">
                            <span>Add a detailed description, acceptance criteria, or technical implementation notes...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="task-card-description-editor">
                        <textarea
                          className="task-card-description-textarea"
                          value={descriptionDraft}
                          onChange={(e) => setDescriptionDraft(e.target.value)}
                          placeholder="Type markdown or details about this task..."
                          rows={4}
                          autoFocus
                        />
                        <div className="task-card-editor-btn-row">
                          <button
                            type="button"
                            className="backlog-btn-primary-blue-sm"
                            onClick={() => {
                              if (onUpdateTaskDetails) {
                                onUpdateTaskDetails(liveTask.id, { description: descriptionDraft });
                              }
                              setIsEditingDescription(false);
                              showToast('Description updated!', 'success');
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="backlog-btn-secondary-dark-sm"
                            onClick={() => setIsEditingDescription(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CHECKLIST / SUBTASKS (MONDAY.COM STYLE) */}
                  {checklist.length > 0 && (
                    <div className="task-card-section task-card-checklist-section">
                      <div className="task-card-section-header">
                        <div className="checklist-title-with-progress">
                          <h3>Subtasks & Checklist</h3>
                          <span className="checklist-progress-text">
                            {completedChecklistCount} of {checklist.length} completed ({checklistPercent}%)
                          </span>
                        </div>
                      </div>
                      <div className="checklist-progress-bar-bg">
                        <div
                          className="checklist-progress-bar-fill"
                          style={{ width: `${checklistPercent}%` }}
                        />
                      </div>
                      <div className="checklist-items-list">
                        {checklist.map((item) => (
                          <div key={item.id} className={`checklist-item-row ${item.done ? 'item-done' : ''}`}>
                            <input
                              type="checkbox"
                              className="backlog-custom-checkbox"
                              checked={item.done}
                              onChange={() => {
                                const updated = checklist.map((i) =>
                                  i.id === item.id ? { ...i, done: !i.done } : i
                                );
                                if (onUpdateTaskDetails) {
                                  onUpdateTaskDetails(liveTask.id, { checklist: updated });
                                }
                              }}
                            />
                            <span className="checklist-item-text">{item.text}</span>
                            <button
                              type="button"
                              className="checklist-item-delete"
                              onClick={() => {
                                const updated = checklist.filter((i) => i.id !== item.id);
                                if (onUpdateTaskDetails) {
                                  onUpdateTaskDetails(liveTask.id, { checklist: updated });
                                }
                              }}
                              title="Delete subtask"
                            >
                              <CloseIcon size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newChecklistItem.trim()) return;
                          const newItem = { id: Date.now(), text: newChecklistItem.trim(), done: false };
                          const updated = [...checklist, newItem];
                          if (onUpdateTaskDetails) {
                            onUpdateTaskDetails(liveTask.id, { checklist: updated });
                          }
                          setNewChecklistItem('');
                        }}
                        className="checklist-add-form"
                      >
                        <input
                          type="text"
                          className="checklist-add-input"
                          placeholder="+ Add another subtask item..."
                          value={newChecklistItem}
                          onChange={(e) => setNewChecklistItem(e.target.value)}
                        />
                      </form>
                    </div>
                  )}

                  {/* COMMENTS & UPDATES STREAM (JIRA + MONDAY.COM SIGNATURE SECTION) */}
                  <div className="task-card-section task-card-comments-section">
                    <div className="task-card-tab-nav">
                      <button
                        type="button"
                        className={`task-card-tab-btn ${activeCardTab === 'updates' ? 'active' : ''}`}
                        onClick={() => setActiveCardTab('updates')}
                      >
                        <CommentBubblePlusIcon />
                        <span>Developer Updates & Discussion</span>
                        <span className="task-card-tab-counter">{comments.length}</span>
                      </button>
                      <button
                        type="button"
                        className={`task-card-tab-btn ${activeCardTab === 'activity' ? 'active' : ''}`}
                        onClick={() => setActiveCardTab('activity')}
                      >
                        <span>History & Audit</span>
                      </button>
                    </div>

                    {activeCardTab === 'updates' ? (
                      <div className="monday-updates-wrapper">
                        {/* COMMENT COMPOSER (MONDAY.COM & JIRA STYLE) */}
                        <div className="monday-composer-card">
                          <div className="composer-header-row">
                            <div className="composer-author-picker">
                              <span className="composer-as-label">Commenting as:</span>
                              <div className="composer-member-pill">
                                <span
                                  className="composer-author-avatar"
                                  style={{
                                    backgroundColor:
                                      TEAM_MEMBERS.find((m) => m.name === selectedCommentAuthor)?.avatarBg || '#137333',
                                  }}
                                >
                                  {(selectedCommentAuthor || 'S')[0]}
                                </span>
                                <select
                                  className="composer-author-select"
                                  value={selectedCommentAuthor}
                                  onChange={(e) => setSelectedCommentAuthor(e.target.value)}
                                >
                                  {TEAM_MEMBERS.map((m) => (
                                    <option key={m.id} value={m.name}>
                                      {m.name} ({m.role || 'Dev'})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Quick formatting toolbar */}
                            <div className="composer-toolbar-chips">
                              <div className="composer-mention-wrapper">
                                <button
                                  type="button"
                                  className={`toolbar-format-btn ${showMentionMenu ? 'active' : ''}`}
                                  title="Mention team member (@)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMentionMenu((prev) => !prev);
                                    setMentionFilter('');
                                  }}
                                >
                                  @
                                </button>

                                {showMentionMenu && (
                                  <div
                                    className="composer-mention-dropdown"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="mention-dropdown-header">
                                      <span className="mention-header-title">Mention team member</span>
                                      <button
                                        type="button"
                                        className="mention-close-btn"
                                        onClick={() => setShowMentionMenu(false)}
                                        title="Close list"
                                      >
                                        <CloseIcon size={12} />
                                      </button>
                                    </div>

                                    <div className="mention-search-box">
                                      <input
                                        type="text"
                                        className="mention-search-input"
                                        placeholder="Search member..."
                                        value={mentionFilter}
                                        onChange={(e) => setMentionFilter(e.target.value)}
                                        autoFocus
                                      />
                                    </div>

                                    <div className="mention-members-list">
                                      {TEAM_MEMBERS.filter((m) =>
                                        !mentionFilter.trim() ||
                                        m.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
                                        (m.role && m.role.toLowerCase().includes(mentionFilter.toLowerCase()))
                                      ).map((m) => (
                                        <button
                                          key={m.id}
                                          type="button"
                                          className="mention-member-row"
                                          onClick={() => handleSelectMention(m.name)}
                                        >
                                          <div className="mention-avatar-wrapper">
                                            <div
                                              className="tiny-avatar mention-avatar"
                                              style={{ backgroundColor: m.avatarBg }}
                                            >
                                              {m.initial}
                                            </div>
                                            <span className="mention-online-dot" />
                                          </div>
                                          <div className="mention-member-info">
                                            <span className="mention-member-name">{m.name}</span>
                                            <span className="mention-member-role">{m.role || 'Developer'}</span>
                                          </div>
                                          <span className="mention-insert-badge">@mention</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!commentInput.trim()) return;
                              onPostComment(liveTask.id, commentInput.trim(), selectedCommentAuthor);
                              setCommentInput('');
                              setShowMentionMenu(false);
                            }}
                          >
                            <textarea
                              className="monday-composer-textarea"
                              placeholder="Write an update, discuss code review, or type @ to mention a teammate..."
                              value={commentInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCommentInput(val);
                                const lastWord = val.slice(0, e.target.selectionStart || val.length).split(/\s+/).pop();
                                if (lastWord && lastWord.startsWith('@')) {
                                  setShowMentionMenu(true);
                                  setMentionFilter(lastWord.slice(1));
                                } else if (showMentionMenu && !lastWord?.startsWith('@')) {
                                  setShowMentionMenu(false);
                                }
                              }}
                              rows={3}
                              required
                            />

                            <div className="monday-composer-footer">
                              <span className="composer-hint">ProTip: Use @mention to notify other developers</span>
                              <button
                                type="submit"
                                className="backlog-btn-primary-blue composer-submit-btn"
                                disabled={!commentInput.trim()}
                              >
                                <SendIcon size={13} />
                                <span>Post Update</span>
                              </button>
                            </div>
                          </form>
                        </div>

                        {/* DEVELOPER COMMENTS FEED */}
                        <div className="monday-comments-feed">
                          {comments.length > 0 ? (
                            comments.map((c) => {
                              const authorMember = TEAM_MEMBERS.find((m) => m.name === c.author);
                              const avatarBg = c.avatarBg || authorMember?.avatarBg || '#1a73e8';
                              const role = c.role || authorMember?.role || 'Developer';
                              const initial = c.initial || c.author?.[0] || 'D';

                              return (
                                <div key={c.id} className="monday-comment-item">
                                  <div
                                    className="developer-comment-avatar"
                                    style={{ backgroundColor: avatarBg }}
                                  >
                                    {initial}
                                    <span className="online-indicator" />
                                  </div>

                                  <div className="developer-comment-card">
                                    <div className="developer-comment-header">
                                      <div className="developer-info-meta">
                                        <span className="developer-name">{c.author}</span>
                                        <span className="developer-role-tag">{role}</span>
                                        <span className="developer-comment-time">{c.time}</span>
                                      </div>

                                      {onDeleteComment && (
                                        <button
                                          type="button"
                                          className="developer-comment-delete-btn"
                                          onClick={() => onDeleteComment(liveTask.id, c.id)}
                                          title="Delete comment"
                                        >
                                          <TrashIcon size={12} />
                                        </button>
                                      )}
                                    </div>

                                    <div className="developer-comment-body">
                                      <p>{c.text}</p>
                                    </div>

                                    {/* Monday.com style interaction footer */}
                                    <div className="monday-comment-footer-actions">
                                      <button
                                        type="button"
                                        className={`monday-like-btn ${c.isLiked ? 'liked' : ''}`}
                                        onClick={() => onToggleCommentLike && onToggleCommentLike(liveTask.id, c.id)}
                                        title={c.isLiked ? 'Unlike update' : 'Like update'}
                                      >
                                        <ThumbsUpIcon size={13} />
                                        <span>{c.likes > 0 ? `${c.likes} Liked` : 'Like'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        className="monday-reply-btn"
                                        onClick={() => {
                                          setCommentInput(`@${c.author} `);
                                        }}
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="monday-empty-comments-state">
                              <CommentBubblePlusIcon />
                              <p className="empty-title">No developer discussion yet</p>
                              <p className="empty-sub">
                                Keep your team in sync by sharing updates, review feedback, or blockers above.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ACTIVITY LOG TAB */
                      <div className="jira-activity-log-wrapper">
                        <div className="activity-timeline-item">
                          <span className="timeline-dot" />
                          <div className="timeline-content">
                            <strong>{ownerObj ? ownerObj.name : 'Team'}</strong> updated this task status to{' '}
                            <span className="timeline-status-badge">{liveTask.status}</span>
                            <span className="timeline-time">Recently</span>
                          </div>
                        </div>
                        <div className="activity-timeline-item">
                          <span className="timeline-dot" />
                          <div className="timeline-content">
                            <strong>Franklin</strong> created task{' '}
                            <span className="timeline-key">{liveTask.taskId}</span>
                            <span className="timeline-time">Sprint iteration</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: ATTRIBUTES SIDEBAR (JIRA & MONDAY.COM INSPECTOR) */}
                <div className="task-card-sidebar-col">
                  <div className="task-card-sidebar-panel">
                    <h4 className="sidebar-group-heading">Details & Attributes</h4>

                    {/* STATUS */}
                    <div className="sidebar-attr-row">
                      <span className="sidebar-attr-label">Status</span>
                      <div className="sidebar-attr-value">
                        <select
                          className="sidebar-select-standard"
                          value={liveTask.status}
                          onChange={(e) => onStatusChange && onStatusChange(liveTask.id, e.target.value)}
                        >
                          {Object.keys(statusConfig || STATUS_CONFIG).map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* ASSIGNEE */}
                    <div className="sidebar-attr-row">
                      <span className="sidebar-attr-label">Assignee</span>
                      <div className="sidebar-attr-value">
                        <select
                          className="sidebar-select-standard"
                          value={liveTask.owner || ''}
                          onChange={(e) => onOwnerChange && onOwnerChange(liveTask.id, e.target.value)}
                        >
                          {TEAM_MEMBERS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.role || 'Member'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* REPORTER */}
                    <div className="sidebar-attr-row">
                      <span className="sidebar-attr-label">Reporter</span>
                      <div className="sidebar-attr-value">
                        <span className="sidebar-text-readonly">Franklin (QA Lead)</span>
                      </div>
                    </div>

                    {/* SPRINT */}
                    <div className="sidebar-attr-row">
                      <span className="sidebar-attr-label">Sprint</span>
                      <div className="sidebar-attr-value">
                        <select
                          className="sidebar-select-standard"
                          value={isTaskPastDueAndIncomplete(liveTask) ? 'backlog' : (liveTask.sprintId || 'backlog')}
                          onChange={(e) => onMoveTask && onMoveTask(liveTask.id, e.target.value)}
                          disabled={isTaskPastDueAndIncomplete(liveTask)}
                        >
                          {sprints.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.isStarted ? '(Active)' : ''}
                            </option>
                          ))}
                          <option value="backlog">Backlog {isTaskPastDueAndIncomplete(liveTask) ? '(Auto - Past Date)' : ''}</option>
                        </select>
                      </div>
                    </div>

                    <div className="sidebar-attr-row">
                      <label className="sidebar-attr-label" htmlFor="task-due-date">
                        Due date
                      </label>
                      <div className="sidebar-attr-value">
                        <input
                          id="task-due-date"
                          className="sidebar-select-standard"
                          type="date"
                          value={liveTask.dueDate || liveTask.due_date || ''}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            const isPastIncomplete = isPastDate(newDate) && isTaskIncomplete(liveTask.status);
                            onUpdateTaskDetails?.(liveTask.id, {
                              dueDate: newDate,
                              due_date: newDate,
                              ...(isPastIncomplete ? { sprintId: 'backlog', sprint_id: null } : {}),
                            });
                            if (isPastIncomplete) {
                              showToast('Due date is in the past! Incomplete task moved to Backlog', 'warning');
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* STORY POINTS */}
                    <div className="sidebar-attr-row">
                      <span className="sidebar-attr-label">Story Points</span>
                      <div className="sidebar-attr-value">
                        <select
                          className="sidebar-select-standard"
                          value={liveTask.sp ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : Number(e.target.value);
                            if (onSPChange) onSPChange(liveTask.id, val);
                          }}
                        >
                          <option value="">None</option>
                          <option value="1">1 SP</option>
                          <option value="2">2 SP</option>
                          <option value="3">3 SP</option>
                          <option value="5">5 SP</option>
                          <option value="8">8 SP</option>
                          <option value="13">13 SP</option>
                        </select>
                      </div>
                    </div>

                    {/* PRIORITY (JIRA STYLE) */}
                    <div className="sidebar-attr-row">
                      <span className="sidebar-attr-label">Priority</span>
                      <div className="sidebar-attr-value">
                        <select
                          className="sidebar-select-standard"
                          value={priority}
                          onChange={(e) => {
                            if (onUpdateTaskDetails) {
                              onUpdateTaskDetails(liveTask.id, { priority: e.target.value });
                            }
                          }}
                        >
                          <option value="Highest">Highest 🔴</option>
                          <option value="High">High 🟠</option>
                          <option value="Medium">Medium 🟡</option>
                          <option value="Low">Low 🔵</option>
                        </select>
                      </div>
                    </div>

                    {/* TYPE */}
                    <div className="sidebar-attr-row">
                      <span className="sidebar-attr-label">Issue Type</span>
                      <div className="sidebar-attr-value">
                        <select
                          className="sidebar-select-standard"
                          value={liveTask.type}
                          onChange={(e) => onTypeChange && onTypeChange(liveTask.id, e.target.value)}
                        >
                          {Object.keys(typeConfig || TYPE_CONFIG).map((tp) => (
                            <option key={tp} value={tp}>
                              {tp}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* EPIC */}
                    <div className="sidebar-attr-row">
                      <span className="sidebar-attr-label">Epic</span>
                      <div className="sidebar-attr-value">
                        <select
                          className="sidebar-select-standard"
                          value={liveTask.epic || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (onUpdateTaskDetails) {
                              onUpdateTaskDetails(liveTask.id, { epic: val });
                            } else if (onEpicChange) {
                              onEpicChange(liveTask.id, val);
                            }
                            if (showToast) {
                              showToast(val ? `Epic set to "${val}"` : 'Epic removed', 'info');
                            }
                          }}
                        >
                          <option value="">None</option>
                          {['Infrastructure', 'Database Maintenance', 'Automation - Website Services', 'Operations', ...(allTasks || []).map((t) => t.epic).filter(Boolean)]
                            .filter((val, idx, arr) => arr.indexOf(val) === idx)
                            .map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="sidebar-divider" />

                    {/* DATES META */}
                    <div className="sidebar-dates-box">
                      <div className="date-meta-item">
                        <span>Created:</span>
                        <strong>Oct 1, 2026</strong>
                      </div>
                      <div className="date-meta-item">
                        <span>Updated:</span>
                        <strong>Just now</strong>
                      </div>
                    </div>

                    {/* DELETE ACTION */}
                    {onDeleteTask && (
                      <div className="sidebar-danger-zone">
                        <button
                          type="button"
                          className="sidebar-delete-task-btn"
                          onClick={() => {
                            if (window.confirm(`Delete task "${liveTask.title}"?`)) {
                              onDeleteTask(liveTask.id);
                              onClose();
                            }
                          }}
                        >
                          <TrashIcon size={13} /> Delete Issue
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 24. OWNER PICKER POPOVER */}
      {activeModal === 'ownerPicker' && activeTaskTarget && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 220 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Assign to</div>
            {TEAM_MEMBERS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`backlog-popover-list-item ${activeTaskTarget.owner === m.id ? 'active' : ''}`}
                onClick={() => onOwnerChange(activeTaskTarget.id, m.id)}
              >
                <div className="flex-row-center">
                  <div className="tiny-avatar" style={{ backgroundColor: m.avatarBg }}>
                    {m.initial}
                  </div>
                  <span>{m.name}</span>
                </div>
                {activeTaskTarget.owner === m.id && <CheckIcon size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 25. STATUS PICKER POPOVER */}
      {activeModal === 'statusPicker' && activeTaskTarget && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker status-picker-popover"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 135 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Change Status</div>
            {Object.keys(statusConfig || STATUS_CONFIG).map((st) => (
              <button
                key={st}
                type="button"
                className="backlog-popover-badge-option"
                style={{
                  backgroundColor: (statusConfig && statusConfig[st]?.bg) || STATUS_CONFIG[st]?.bg,
                  color: (statusConfig && statusConfig[st]?.text) || STATUS_CONFIG[st]?.text,
                }}
                onClick={() => onStatusChange(activeTaskTarget.id, st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 26. TYPE PICKER POPOVER */}
      {activeModal === 'typePicker' && activeTaskTarget && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker type-picker-popover"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 130 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Change Type</div>
            <div className="backlog-popover-badges-list">
              {Object.keys(typeConfig || TYPE_CONFIG).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  className="backlog-popover-badge-option"
                  style={{
                    backgroundColor: (typeConfig && typeConfig[tp]?.bg) || TYPE_CONFIG[tp]?.bg,
                    color: (typeConfig && typeConfig[tp]?.text) || TYPE_CONFIG[tp]?.text,
                  }}
                  onClick={() => onTypeChange(activeTaskTarget.id, tp)}
                >
                  {tp}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 27. STORY POINTS PICKER POPOVER */}
      {activeModal === 'spPicker' && activeTaskTarget && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'center', width: 200 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Estimated Story Points</div>
            <div className="sp-grid-options">
              {[1, 2, 3, 5, 8, 13, null].map((val) => (
                <button
                  key={val === null ? 'none' : val}
                  type="button"
                  className={`sp-grid-btn ${activeTaskTarget.sp === val ? 'active' : ''}`}
                  onClick={() => onSPChange(activeTaskTarget.id, val)}
                >
                  {val === null ? 'Clear' : `${val} SP`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 28. EPIC PICKER POPOVER (DROPDOWN MENU) */}
      {activeModal === 'epicPicker' && activeTaskTarget && (() => {
        const DEFAULT_EPIC_LIST = [
          'Infrastructure',
          'Database Maintenance',
          'Automation - Website Services',
          'Operations',
        ];

        // Also check if any existing tasks in allTasks have extra custom epics
        const existingEpics = new Set(DEFAULT_EPIC_LIST.map((e) => e.toLowerCase()));
        const extraEpics = [];
        (allTasks || []).forEach((t) => {
          if (t.epic && t.epic.trim() && !existingEpics.has(t.epic.trim().toLowerCase())) {
            existingEpics.add(t.epic.trim().toLowerCase());
            extraEpics.push(t.epic.trim());
          }
        });

        const allEpics = [...DEFAULT_EPIC_LIST, ...extraEpics];

        return (
          <div className="backlog-popover-backdrop" onClick={onClose}>
            <div
              className="backlog-popover-dialog anchored-picker epic-picker-dialog"
              style={getAnchorStyle(anchorRect, { align: 'left', width: 230 })}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="backlog-popover-title">Select Epic</div>

              <div className="epic-picker-list">
                {allEpics.map((epicName) => {
                  const isSelected =
                    (activeTaskTarget.epic || '').trim().toLowerCase() === epicName.toLowerCase();
                  return (
                    <button
                      key={epicName}
                      type="button"
                      className={`backlog-popover-list-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        onEpicChange(activeTaskTarget.id, epicName);
                        onClose();
                      }}
                    >
                      <div className="flex-row-center" style={{ gap: '8px' }}>
                        <span className="epic-bullet-icon">⚡</span>
                        <span>{epicName}</span>
                      </div>
                      {isSelected && <CheckIcon size={14} />}
                    </button>
                  );
                })}

                {/* Option to clear epic if currently assigned */}
                {activeTaskTarget.epic && (
                  <>
                    <div style={{ height: '1px', background: '#2c3358', margin: '4px 0' }} />
                    <button
                      type="button"
                      className="backlog-popover-list-item text-danger"
                      onClick={() => {
                        onEpicChange(activeTaskTarget.id, '');
                        onClose();
                      }}
                    >
                      <div className="flex-row-center" style={{ gap: '8px' }}>
                        <CloseIcon size={12} />
                        <span>Clear Epic (None)</span>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 29. GITHUB BRANCH LINK POPOVER */}
      {activeModal === 'githubPicker' && activeTaskTarget && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'left', width: 240 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Link GitHub Branch</div>
            {['main', 'feat/login-flow', 'fix/backlog-buttons', 'feat/sprint-capacity', 'PR #42'].map((b) => (
              <button
                key={b}
                type="button"
                className={`backlog-popover-list-item ${activeTaskTarget.githubLink === b ? 'active' : ''}`}
                onClick={() => onGithubLink(activeTaskTarget.id, b)}
              >
                <div className="flex-row-center">
                  <GithubIcon />
                  <span>{b}</span>
                </div>
                {activeTaskTarget.githubLink === b && <CheckIcon size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 29. EDIT TASK ID ANCHORED POPOVER (ADMIN UNIQUE ID CONTROLS) */}
      {activeModal === 'editTaskId' && activeTaskTarget && (() => {
        const isConflict = Boolean(
          editTaskIdInput.trim() &&
          allTasks.some(
            (t) =>
              t.id !== activeTaskTarget.id &&
              t.taskId?.trim().toUpperCase() === editTaskIdInput.trim().toUpperCase()
          )
        );
        const isBlank = !editTaskIdInput.trim();

        return (
          <div className="backlog-popover-backdrop" onClick={onClose}>
            <div
              className="backlog-popover-dialog anchored-picker task-id-popover"
              style={getAnchorStyle(anchorRect, { align: 'left', width: 280 })}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="backlog-popover-title">
                <KeyIcon size={14} />
                <span>Admin: Edit Task ID</span>
              </div>
              <div className="task-id-popover-body">
                <div className="dialog-field-label-row">
                  <span className="task-id-current-label">
                    Current: <strong>{activeTaskTarget.taskId}</strong>
                  </span>
                  <span className="admin-field-badge">Unique ID</span>
                </div>
                <div className="dialog-input-with-button">
                  <input
                    type="text"
                    className={`dialog-input ${
                      isBlank
                        ? 'input-error'
                        : isConflict
                        ? 'input-error'
                        : 'input-success'
                    }`}
                    value={editTaskIdInput}
                    onChange={(e) => setEditTaskIdInput(e.target.value.toUpperCase())}
                    placeholder="e.g. LUX-005"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="dialog-inline-action-btn"
                    onClick={() => {
                      const nextId = generateUniqueTaskId(allTasks);
                      setEditTaskIdInput(nextId);
                      showToast(`Generated unique ID: ${nextId}`, 'info');
                    }}
                    title="Auto-generate next unique Task ID"
                  >
                    <RefreshIcon /> Auto
                  </button>
                </div>
                {/* Validation message */}
                {isConflict ? (
                  <div className="field-validation-message error">
                    ⚠️ Task ID already taken by another task!
                  </div>
                ) : !isBlank ? (
                  <div className="field-validation-message success">
                    ✓ Unique ID available
                  </div>
                ) : (
                  <div className="field-validation-message error">
                    ⚠️ ID cannot be empty
                  </div>
                )}
                <div className="popover-action-buttons">
                  <button
                    type="button"
                    className="backlog-btn-secondary-dark-sm"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="backlog-btn-primary-blue-sm"
                    disabled={isBlank || isConflict}
                    onClick={() => {
                      const trimmed = editTaskIdInput.trim().toUpperCase();
                      if (!trimmed) return;
                      if (onUpdateTaskId) {
                        const success = onUpdateTaskId(activeTaskTarget.id, trimmed);
                        if (success !== false) {
                          onClose();
                        }
                      }
                    }}
                  >
                    Save Unique ID
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 30. PROJECT KEY SETTINGS (ADMIN ONCE CONFIGURATION) */}
      {activeModal === 'projectKeySettings' && (
        <div className="backlog-modal-overlay" onClick={onClose}>
          <div className="backlog-dialog-card project-key-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="backlog-dialog-header">
              <div className="dialog-header-with-badge">
                <KeyIcon size={16} />
                <h3>Configure Project Key</h3>
                <span className="admin-status-pill">Like Jira</span>
              </div>
              <button type="button" className="backlog-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = (newProjectKeyInput || '').trim().toUpperCase();
                if (!trimmed) {
                  showToast('Project Key prefix cannot be empty', 'error');
                  return;
                }
                if (onUpdateProjectKey) {
                  onUpdateProjectKey(trimmed);
                }
                onClose();
              }}
            >
              <div className="backlog-dialog-body">
                <p className="project-key-dialog-desc">
                  Set your Project Key prefix once (like Jira). All future tasks created inline or via modal will automatically continue the sequential numbering.
                </p>
                <div className="dialog-field-group">
                  <label htmlFor="settings-project-key">Project Key Prefix</label>
                  <input
                    id="settings-project-key"
                    type="text"
                    className="dialog-input"
                    placeholder="e.g. LUX, CORE, PROJ, DEV"
                    value={newProjectKeyInput}
                    onChange={(e) => setNewProjectKeyInput(e.target.value.toUpperCase())}
                    required
                    autoFocus
                  />
                </div>
                <div className="project-key-preview-banner">
                  <span className="preview-label">Next Task Created:</span>
                  <strong className="preview-val">
                    {getNextJiraTaskId(allTasks, newProjectKeyInput || projectKey).taskId}
                  </strong>
                  <span className="preview-desc">
                    Every task created afterwards automatically continues the sequence like Jira.
                  </span>
                </div>
              </div>
              <div className="backlog-dialog-footer">
                <button type="button" className="backlog-btn-secondary-dark" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="backlog-btn-primary-blue">
                  Save Project Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 31. ADD COLUMN POPOVER */}
      {activeModal === 'addColumn' && (
        <div className="backlog-popover-backdrop" onClick={onClose}>
          <div
            className="backlog-popover-dialog anchored-picker"
            style={getAnchorStyle(anchorRect, { align: 'right', width: 180 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backlog-popover-title">Add Column</div>
            {['Priority', 'Due Date', 'Tags', 'Time Tracking', 'Milestone'].map((col) => (
              <button
                key={col}
                type="button"
                className="backlog-popover-list-item"
                onClick={() => {
                  showToast(`Column "${col}" added to table!`, 'success');
                  onClose();
                }}
              >
                <span>+ {col}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
});

BacklogModals.displayName = 'BacklogModals';

export default BacklogModals;
