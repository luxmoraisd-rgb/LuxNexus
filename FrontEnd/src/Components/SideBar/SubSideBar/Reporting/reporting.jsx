import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Clock,
  Database,
  FileText,
  FolderKanban,
  Gauge,
  ListChecks,
  MoreHorizontal,
  Palette,
  Pencil,
  PieChart,
  Share2,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import "./reporting.css";



import {
  DEFAULT_DASHBOARDS,
  getStoredDashboards,
  reportingApi,
} from "./reportingApi";

const initialDashboards = DEFAULT_DASHBOARDS;

const Reporting = () => {
  const [dashboards, setDashboards] = useState(() => getStoredDashboards());
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dashboardName, setDashboardName] = useState("");
  const [isGridView, setIsGridView] = useState(true);
  const [showRecents, setShowRecents] = useState(true);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [activeDialog, setActiveDialog] = useState(null);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    reportingApi
      .getDashboards()
      .then((data) => {
        if (isCurrent && data) {
          setDashboards(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isCurrent) setLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const createDashboard = async () => {
    const name = dashboardName.trim();
    if (!name) return;

    setShowModal(false);
    setDashboardName("");

    const newDashboard = await reportingApi.createDashboard({
      title: name,
      description: "Custom dashboard",
      type: "purple",
      icon: "chart",
      starred: false,
    });

    setDashboards((prev) => [
      newDashboard,
      ...prev.filter((d) => d.id !== newDashboard.id),
    ]);
  };

  const toggleFavorite = async (dashboardId) => {
    const current = dashboards.find((d) => d.id === dashboardId);
    if (!current) return;
    const newStarred = !current.starred;

    setDashboards((currentDashboards) =>
      currentDashboards.map((dashboard) =>
        dashboard.id === dashboardId
          ? { ...dashboard, starred: newStarred }
          : dashboard
      )
    );

    await reportingApi.updateDashboard(dashboardId, { starred: newStarred });
  };

  const updateDashboard = async (dashboardId, changes) => {
    setDashboards((currentDashboards) =>
      currentDashboards.map((dashboard) =>
        dashboard.id === dashboardId ? { ...dashboard, ...changes } : dashboard
      )
    );

    await reportingApi.updateDashboard(dashboardId, changes);
  };

  const duplicateDashboard = async (dashboard) => {
    const copy = await reportingApi.createDashboard({
      title: `${dashboard.title} copy`,
      description: dashboard.description,
      type: dashboard.type,
      icon: dashboard.icon,
      starred: false,
    });
    setDashboards((currentDashboards) => [copy, ...currentDashboards]);
  };

  const confirmDeleteDashboard = async () => {
    const toDelete = activeDialog?.dashboard;
    if (!toDelete) return;
    setActiveDialog(null);

    setDashboards((currentDashboards) =>
      currentDashboards.filter((dashboard) => dashboard.id !== toDelete.id)
    );

    await reportingApi.deleteDashboard(toDelete.id);
  };

  const startCreateDashboard = () => {
    setDashboardName("");
    setShowModal(true);
  };

  const openDashboard = (dashboard) => {
    setSelectedDashboard(dashboard);
  };

  return (
    <ReportingLayout>


      <ReportingHeader
        onAddDashboard={startCreateDashboard}
      />


      <main className="reporting-content">


        <RecentsHeader
          isOpen={showRecents}
          onToggle={() => setShowRecents((prev) => !prev)}
          isGridView={isGridView}
          onViewChange={() => setIsGridView((prev) => !prev)}
        />

       

        {showRecents && (
          <DashboardGrid
            dashboards={dashboards}
            isGridView={isGridView}
            onOpen={openDashboard}
            onToggleFavorite={toggleFavorite}
            openMenuId={openMenuId}
            onMenuToggle={setOpenMenuId}
            onEdit={(dashboard) => setActiveDialog({ type: "edit", dashboard })}
            onShare={(dashboard) => setActiveDialog({ type: "share", dashboard })}
            onDelete={(dashboard) => setActiveDialog({ type: "delete", dashboard })}
            onDuplicate={duplicateDashboard}
            onUpdateDashboard={updateDashboard}
          />
        )}

      </main>



      {showModal && (
        <CreateDashboardModal
          value={dashboardName}
          onChange={setDashboardName}
          onClose={() => {
            setShowModal(false);
            setDashboardName("");
          }}
          onCreate={createDashboard}
          title="Create dashboard"
        />
      )}

      {activeDialog?.type === "edit" && (
        <EditDashboardDialog
          dashboard={activeDialog.dashboard}
          onClose={() => setActiveDialog(null)}
          onSave={(changes) => {
            updateDashboard(activeDialog.dashboard.id, changes);
            setActiveDialog(null);
          }}
        />
      )}

      {activeDialog?.type === "share" && (
        <ShareDashboardDialog
          dashboard={activeDialog.dashboard}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {activeDialog?.type === "delete" && (
        <DeleteDashboardDialog
          dashboard={activeDialog.dashboard}
          onClose={() => setActiveDialog(null)}
          onConfirm={confirmDeleteDashboard}
        />
      )}


      {selectedDashboard && (
        <DashboardPreview
          dashboard={selectedDashboard}
          onClose={() => setSelectedDashboard(null)}
        />
      )}

    </ReportingLayout>
  );
};



const ReportingLayout = ({ children }) => {
  return (
    <div className="reporting-page">
      {children}
    </div>
  );
};



const ReportingHeader = ({ onAddDashboard }) => {
  return (
    <header className="reporting-header">

      <div className="reporting-header-inner">

        <h1 className="reporting-title">
          Reporting
        </h1>

        <button
          className="add-dashboard-btn"
          onClick={onAddDashboard}
        >
          <span className="plus-icon">+</span>
          Add dashboard
        </button>

      </div>

    </header>
  );
};



const RecentsHeader = ({
  isOpen,
  onToggle,
  isGridView,
  onViewChange,
}) => {
  return (
    <div className="recents-header">

      <button
        className="recents-title-btn"
        onClick={onToggle}
      >
        <span
          className={`chevron ${
            isOpen ? "chevron-open" : ""
          }`}
        >
          ▾
        </span>

        <span>Recents</span>
      </button>

      <button
        className="view-toggle-btn"
        onClick={onViewChange}
        aria-label="Change dashboard view"
      >
        {isGridView ? (
          <GridIcon />
        ) : (
          <ListIcon />
        )}
      </button>

    </div>
  );
};



const DashboardGrid = ({
  dashboards,
  isGridView,
  onOpen,
  onToggleFavorite,
  openMenuId,
  onMenuToggle,
  onEdit,
  onShare,
  onDelete,
  onDuplicate,
  onUpdateDashboard,
}) => {
  return (
    <div
      className={`dashboard-grid ${
        isGridView ? "grid-view" : "list-view"
      }`}
    >
      {dashboards.map((dashboard) => (
        <DashboardCard
          key={dashboard.id}
          dashboard={dashboard}
          onClick={() => onOpen(dashboard)}
          onToggleFavorite={onToggleFavorite}
          menuOpen={openMenuId === dashboard.id}
          onMenuToggle={onMenuToggle}
          onEdit={onEdit}
          onShare={onShare}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onUpdateDashboard={onUpdateDashboard}
        />
      ))}
    </div>
  );
};



const DashboardCard = ({
  dashboard,
  onClick,
  onToggleFavorite,
  menuOpen,
  onMenuToggle,
  onEdit,
  onShare,
  onDelete,
  onDuplicate,
  onUpdateDashboard,
}) => {
  const menuButtonRef = useRef(null);

  return (
    <article
      className="dashboard-card"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="dashboard-card-actions">
        <button
          className={`dashboard-star-button ${dashboard.starred ? "starred" : ""}`}
          type="button"
          aria-label={dashboard.starred ? "Remove favorite" : "Add favorite"}
          aria-pressed={dashboard.starred}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(dashboard.id);
          }}
        >
          <Star size={18} fill={dashboard.starred ? "currentColor" : "none"} />
        </button>
        <button
          ref={menuButtonRef}
          className="dashboard-menu-button"
          type="button"
          aria-label={`Actions for ${dashboard.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            onMenuToggle(menuOpen ? null : dashboard.id);
          }}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {menuOpen && (
        <DashboardMenu
          dashboard={dashboard}
          anchorRef={menuButtonRef}
          onClose={() => onMenuToggle(null)}
          onEdit={() => onEdit(dashboard)}
          onShare={() => onShare(dashboard)}
          onDelete={() => onDelete(dashboard)}
          onDuplicate={() => onDuplicate(dashboard)}
          onToggleFavorite={() => onToggleFavorite(dashboard.id)}
          onUpdateDashboard={(changes) => onUpdateDashboard(dashboard.id, changes)}
        />
      )}

      <div className="dashboard-card-top">
        <div className={`dashboard-icon ${dashboard.type}`}>
          <DashboardIcon icon={dashboard.icon} />
        </div>

        <div className="dashboard-info">
          <h2>{dashboard.title}</h2>
          {dashboard.description && <p>{dashboard.description}</p>}
        </div>
      </div>

      <div className="dashboard-card-divider" />

      <div className="dashboard-owner">
        <div className="owner-avatar">Fr</div>
        <span>owned by you</span>
      </div>

    </article>
  );
};

const dashboardColors = [
  { value: "purple", label: "Purple", swatch: "linear-gradient(135deg, #5b2a8e, #c77dff)" },
  { value: "blue", label: "Blue", swatch: "linear-gradient(135deg, #0a4fb5, #63b3ff)" },
  { value: "pink", label: "Pink", swatch: "linear-gradient(135deg, #9a1458, #ff7cc9)" },
  { value: "green", label: "Green", swatch: "linear-gradient(135deg, #166534, #4ade80)" },
  { value: "amber", label: "Amber", swatch: "linear-gradient(135deg, #b45309, #fbbf24)" },
  { value: "red", label: "Red", swatch: "linear-gradient(135deg, #991b1b, #f87171)" },
  { value: "cyan", label: "Cyan", swatch: "linear-gradient(135deg, #0f766e, #5eead4)" },
  { value: "indigo", label: "Indigo", swatch: "linear-gradient(135deg, #312e81, #818cf8)" },
  { value: "orange", label: "Orange", swatch: "linear-gradient(135deg, #c2410c, #fb923c)" },
  { value: "rose", label: "Rose", swatch: "linear-gradient(135deg, #9f1239, #fb7185)" },
  { value: "teal", label: "Teal", swatch: "linear-gradient(135deg, #115e59, #2dd4bf)" },
  { value: "slate", label: "Slate", swatch: "linear-gradient(135deg, #334155, #94a3b8)" },
];

const dashboardIcons = [
  { value: "chart", label: "Chart", Icon: BarChart3 },
  { value: "target", label: "Target", Icon: Target },
  { value: "folder", label: "Folder", Icon: FolderKanban },
  { value: "briefcase", label: "Briefcase", Icon: BriefcaseBusiness },
  { value: "trend", label: "Trend", Icon: TrendingUp },
  { value: "spark", label: "Spark", Icon: Sparkles },
  { value: "calendar", label: "Calendar", Icon: CalendarDays },
  { value: "team", label: "Team", Icon: UsersRound },
  { value: "completed", label: "Completed tasks", Icon: CheckCircle2 },
  { value: "analytics", label: "Pie chart", Icon: PieChart },
  { value: "activity", label: "Activity", Icon: Activity },
  { value: "checklist", label: "Checklist", Icon: ListChecks },
  { value: "clock", label: "Time", Icon: Clock },
  { value: "gauge", label: "Performance", Icon: Gauge },
  { value: "document", label: "Document", Icon: FileText },
  { value: "calendar-check", label: "Schedule", Icon: CalendarCheck },
  { value: "task-list", label: "Task list", Icon: ClipboardList },
  { value: "database", label: "Data", Icon: Database },
];

const DashboardMenu = ({
  dashboard,
  anchorRef,
  onClose,
  onEdit,
  onShare,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  onUpdateDashboard,
}) => {
  const menuRef = useRef(null);
  const submenuRef = useRef(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
  const theme = document.querySelector(".app")?.dataset.theme ?? "dark";

  useLayoutEffect(() => {
    const updateMenuPosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!anchor || !menu) return;

      const bounds = menu.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(margin, Math.min(
        anchor.right - bounds.width,
        window.innerWidth - bounds.width - margin
      ));
      const below = anchor.bottom + 6;
      const top = below + bounds.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, anchor.top - bounds.height - 6);

      setMenuPosition({ top, left });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!submenuOpen) return undefined;

    const updateSubmenuPosition = () => {
      const menu = menuRef.current?.getBoundingClientRect();
      const submenu = submenuRef.current?.getBoundingClientRect();
      if (!menu || !submenu) return;

      const margin = 8;
      const right = menu.right + 6;
      const left = right + submenu.width <= window.innerWidth - margin
        ? right
        : menu.left - submenu.width - 6 >= margin
          ? menu.left - submenu.width - 6
          : Math.max(margin, Math.min(menu.left, window.innerWidth - submenu.width - margin));
      let top = menu.top;
      if (left === Math.max(margin, Math.min(menu.left, window.innerWidth - submenu.width - margin))) {
        top = menu.bottom + submenu.height <= window.innerHeight - margin
          ? menu.bottom + 4
          : Math.max(margin, menu.top - submenu.height - 4);
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - submenu.height - margin));
      setSubmenuPosition({ top, left });
    };

    updateSubmenuPosition();
    window.addEventListener("resize", updateSubmenuPosition);
    window.addEventListener("scroll", updateSubmenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateSubmenuPosition);
      window.removeEventListener("scroll", updateSubmenuPosition, true);
    };
  }, [menuPosition, submenuOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        menuRef.current?.contains(event.target)
        || submenuRef.current?.contains(event.target)
        || anchorRef.current?.contains(event.target)
      ) return;
      onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose]);

  const runAction = (action) => (event) => {
    event.stopPropagation();
    onClose();
    action();
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="dashboard-floating-menu"
        data-theme={theme}
        role="menu"
        aria-label={`${dashboard.title} actions`}
        style={{ top: menuPosition.top, left: menuPosition.left }}
        onClick={(event) => event.stopPropagation()}
      >
        <DashboardMenuItem Icon={Pencil} onClick={runAction(onEdit)}>
          Edit dashboard details
        </DashboardMenuItem>
        <DashboardMenuItem
          Icon={Palette}
          trailing={<ChevronRight size={15} />}
          onClick={() => setSubmenuOpen((open) => !open)}
          aria-expanded={submenuOpen}
        >
          Set color &amp; icon
        </DashboardMenuItem>
        <DashboardMenuItem
          Icon={Star}
          iconFilled={dashboard.starred}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
        >
          {dashboard.starred ? "Remove from favorites" : "Add to favorites"}
        </DashboardMenuItem>
        <DashboardMenuItem Icon={Share2} onClick={runAction(onShare)}>
          Share
        </DashboardMenuItem>
        <DashboardMenuItem Icon={Copy} onClick={runAction(onDuplicate)}>
          Duplicate
        </DashboardMenuItem>
        <div className="dashboard-menu-divider" />
        <DashboardMenuItem
          Icon={Trash2}
          className="dashboard-menu-delete"
          onClick={runAction(onDelete)}
        >
          Delete dashboard
        </DashboardMenuItem>
      </div>
      {submenuOpen && (
        <ColorIconPicker
          ref={submenuRef}
          dashboard={dashboard}
          theme={theme}
          position={submenuPosition}
          onCancel={() => setSubmenuOpen(false)}
          onApply={(changes) => {
            onUpdateDashboard(changes);
            onClose();
          }}
        />
      )}
    </>,
    document.body
  );
};

const DashboardMenuItem = ({
  Icon,
  children,
  trailing,
  iconFilled = false,
  className = "",
  ...props
}) => (
  <button
    type="button"
    className={`dashboard-menu-item ${className}`}
    role="menuitem"
    {...props}
  >
    <Icon size={16} fill={iconFilled ? "currentColor" : "none"} />
    <span>{children}</span>
    {trailing}
  </button>
);

const ColorIconPicker = forwardRef(({ dashboard, theme, position, onCancel, onApply }, ref) => {
  const [selectedColor, setSelectedColor] = useState(dashboard.type ?? "purple");
  const [selectedIcon, setSelectedIcon] = useState(dashboard.icon ?? "chart");

  return createPortal(
    <div
      ref={ref}
      className="dashboard-color-picker"
      data-theme={theme}
      role="dialog"
      aria-label="Set dashboard color and icon"
      style={{ top: position.top, left: position.left }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="dashboard-picker-section">
        <h3>Color</h3>
        <div className="dashboard-color-options">
          {dashboardColors.map((color) => (
            <button
              key={color.value}
              type="button"
              className={`dashboard-color-option ${selectedColor === color.value ? "selected" : ""}`}
              style={{ "--dashboard-swatch": color.swatch }}
              aria-label={`${color.label} dashboard color`}
              aria-pressed={selectedColor === color.value}
              onClick={() => setSelectedColor(color.value)}
            >
              {selectedColor === color.value && <Check size={13} />}
            </button>
          ))}
        </div>
      </div>
      <div className="dashboard-picker-section">
        <h3>Icon</h3>
        <div className="dashboard-icon-options">
          {dashboardIcons.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              className={`dashboard-icon-option ${selectedIcon === value ? "selected" : ""}`}
              aria-label={`${label} dashboard icon`}
              aria-pressed={selectedIcon === value}
              onClick={() => setSelectedIcon(value)}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
      </div>
      <div className="dashboard-picker-actions">
        <button type="button" className="dashboard-secondary-button" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="dashboard-primary-button"
          onClick={() => onApply({ type: selectedColor, icon: selectedIcon })}
        >
          Apply
        </button>
      </div>
    </div>,
    document.body
  );
});

const EditDashboardDialog = ({ dashboard, onClose, onSave }) => {
  const [title, setTitle] = useState(dashboard.title);
  const [description, setDescription] = useState(dashboard.description ?? "");

  return (
    <DashboardDialog title="Edit dashboard details" onClose={onClose}>
      <label className="dashboard-dialog-field">
        <span>Dashboard name</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </label>
      <label className="dashboard-dialog-field">
        <span>Description</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </label>
      <div className="dashboard-dialog-actions">
        <button type="button" className="dashboard-secondary-button" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="dashboard-primary-button"
          disabled={!title.trim()}
          onClick={() => onSave({ title: title.trim(), description: description.trim() })}
        >
          Save changes
        </button>
      </div>
    </DashboardDialog>
  );
};

const ShareDashboardDialog = ({ dashboard, onClose }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = new URL(window.location.href);
  shareUrl.hash = `dashboard-${dashboard.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <DashboardDialog title="Share dashboard" onClose={onClose}>
      <p className="dashboard-dialog-copy">Share “{dashboard.title}” with a link.</p>
      <div className="dashboard-share-link">
        <input aria-label="Dashboard share link" value={shareUrl.toString()} readOnly />
        <button type="button" className="dashboard-primary-button" onClick={copyLink}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="dashboard-dialog-actions">
        <button type="button" className="dashboard-secondary-button" onClick={onClose}>Close</button>
      </div>
    </DashboardDialog>
  );
};

const DeleteDashboardDialog = ({ dashboard, onClose, onConfirm }) => (
  <DashboardDialog title="Delete dashboard?" onClose={onClose}>
    <p className="dashboard-dialog-copy">
      “{dashboard.title}” will no longer be available. This action cannot be undone.
    </p>
    <div className="dashboard-dialog-actions">
      <button type="button" className="dashboard-secondary-button" onClick={onClose}>Keep</button>
      <button type="button" className="dashboard-danger-button" onClick={onConfirm}>
        Delete dashboard
      </button>
    </div>
  </DashboardDialog>
);

const DashboardDialog = ({ title, children, onClose }) => {
  const theme = document.querySelector(".app")?.dataset.theme ?? "dark";

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="dashboard-dialog-overlay"
      data-theme={theme}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="dashboard-action-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboard-dialog-title">
        <header className="dashboard-dialog-header">
          <h2 id="dashboard-dialog-title">{title}</h2>
          <button type="button" className="dashboard-dialog-close" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="dashboard-dialog-content">{children}</div>
      </section>
    </div>,
    document.body
  );
};



const CreateDashboardModal = ({
  value,
  onChange,
  onClose,
  onCreate,
  title,
}) => {
  return (
    <div
      className="modal-overlay"
      onMouseDown={onClose}
    >

      <div
        className="dashboard-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >

        <div className="modal-header">

          <h2>{title}</h2>

          <button
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>

        </div>

        <div className="modal-body">

          <label htmlFor="dashboardName">
            Dashboard name
          </label>

          <input
            id="dashboardName"
            type="text"
            placeholder="Enter dashboard name"
            value={value}
            onChange={(event) =>
              onChange(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCreate();
              }
            }}
            autoFocus
          />

        </div>

        <div className="modal-footer">

          <button
            className="cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="create-btn"
            onClick={onCreate}
            disabled={!value.trim()}
          >
            Create dashboard
          </button>

        </div>

      </div>

    </div>
  );
};

/* =========================================================
   Dashboard Preview
========================================================= */

const DashboardPreview = ({
  dashboard,
  onClose,
}) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    reportingApi.getDashboardSummary(dashboard.id).then((data) => {
      if (active) {
        setSummary(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [dashboard.id]);

  const total = summary ? summary.total_tasks : 24;
  const completed = summary ? summary.completed_tasks : 18;
  const progress = summary ? summary.progress : 75;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="dashboard-preview" onMouseDown={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <div>
            <h2>{dashboard.title}</h2>
            <p>{dashboard.description || "Dashboard overview"}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="preview-content">
          <div className="preview-stat">
            <span>Total tasks</span>
            <strong>{loading ? "..." : total}</strong>
          </div>
          <div className="preview-stat">
            <span>Completed</span>
            <strong>{loading ? "..." : completed}</strong>
          </div>
          <div className="preview-stat">
            <span>Progress</span>
            <strong>{loading ? "..." : `${progress}%`}</strong>
          </div>
        </div>

        {summary?.tasks_by_stage && summary.tasks_by_stage.length > 0 && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "0.75rem 1rem",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted, #94a3b8)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Workflow Stages
            </span>
            <div
              style={{
                display: "flex",
                gap: "1.25rem",
                marginTop: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              {summary.tasks_by_stage.map((st) => (
                <div key={st.stage} style={{ fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-secondary, #cbd5e1)" }}>
                    {st.stage}:{" "}
                  </span>
                  <strong style={{ color: "var(--text-primary, #f8fafc)" }}>
                    {st.count}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================
   Icons
========================================================= */

const DashboardIcon = ({ icon = "chart" }) => {
  const IconComponent = dashboardIcons.find((item) => item.value === icon)?.Icon ?? BarChart3;
  return <IconComponent size={24} strokeWidth={1.8} />;
};

const GridIcon = () => {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
};

const ListIcon = () => {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
};

export default Reporting;