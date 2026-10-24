import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Settings as SettingsIcon,
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Inbox,
  X,
  MessageSquare,
  AtSign,
  CheckSquare,
  Layers,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { inboxApi } from "../../../SideBar/SubSideBar/Inbox/inboxApi";
import "./notifysettings.css";

export const DEFAULT_NOTIFICATION_SETTINGS = [
  {
    id: "mentions",
    name: "Mentions",
    description: "Get notified when someone mentions you.",
    enabled: true,
  },
  {
    id: "comments",
    name: "Comments",
    description: "Receive updates on comments and replies.",
    enabled: true,
  },
  {
    id: "direct-messages",
    name: "Direct messages",
    description: "Get notified when someone sends you a message.",
    enabled: true,
  },
  {
    id: "tasks",
    name: "Task updates",
    description: "Alerts for task assignments and due dates.",
    enabled: false,
  },
  {
    id: "project-updates",
    name: "Project updates",
    description: "Updates to projects and shared workspaces.",
    enabled: true,
  },
  {
    id: "due-dates",
    name: "Due date alerts",
    description: "Reminders before assigned tasks are due.",
    enabled: true,
  },
  {
    id: "reminders",
    name: "Reminders",
    description: "Daily and weekly reminder notifications.",
    enabled: true,
  },
  {
    id: "security",
    name: "Security alerts",
    description: "Sign-in and account security activity.",
    enabled: true,
  },
  {
    id: "weekly-summary",
    name: "Weekly summary",
    description: "A weekly summary of activity and upcoming tasks.",
    enabled: false,
  },
];

export const INITIAL_UNREAD_NOTIFICATIONS = [
  {
    id: "unread-1",
    title: "Sprint 4 Backlog Grooming & Task Estimates",
    snippet: "Estimate story points for LUXNEX-20 API Integration before tomorrow's team sync.",
    author: "Alex Rivera",
    avatar: "AR",
    avatarColor: "#8b5cf6",
    type: "task",
    unread: true,
    time: "10:30 AM",
    date: "Today",
    tags: ["Sprint", "Backlog"],
  },
  {
    id: "unread-2",
    title: "Mentioned in #api-architecture channel",
    snippet: "@you can you check the MongoDB connection pooling on mongodb://localhost:27017/?",
    author: "DevOps Lead",
    avatar: "DL",
    avatarColor: "#10b981",
    type: "mention",
    unread: true,
    time: "09:15 AM",
    date: "Today",
    tags: ["Mention", "DevOps"],
  },
  {
    id: "unread-3",
    title: "Review requested on LUXNEX-18",
    snippet: "Sarah Chen requested your review on Knowledge & Meetings dashboard integration.",
    author: "Sarah Chen",
    avatar: "SC",
    avatarColor: "#06b6d4",
    type: "review",
    unread: true,
    time: "Yesterday",
    date: "Yesterday",
    tags: ["GitHub", "Review"],
  },
];

const STORAGE_KEYS = {
  SETTINGS: "nexus_notification_settings",
  READ_IDS: "nexus_read_notification_ids",
};

/**
 * Reusable Notification Settings Panel
 * Can be rendered inside the dropdown or on the Profile Settings page
 */
export const NotificationSettingsPanel = ({
  theme = "dark",
  onBack,
  onClose,
  isStandalone = false,
}) => {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_NOTIFICATION_SETTINGS.map((item) => ({
          ...item,
          enabled: parsed[item.id] !== undefined ? Boolean(parsed[item.id]) : item.enabled,
        }));
      }
    } catch {}
    return DEFAULT_NOTIFICATION_SETTINGS;
  });

  const [savedBadge, setSavedBadge] = useState(false);

  useEffect(() => {
    inboxApi
      .getSettings()
      .then((data) => {
        if (data && typeof data === "object") {
          setSettings((prev) =>
            prev.map((item) => ({
              ...item,
              enabled: data[item.id] !== undefined ? Boolean(data[item.id]) : item.enabled,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const toggleSetting = async (id) => {
    const updated = settings.map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    setSettings(updated);

    const payload = {};
    updated.forEach((item) => {
      payload[item.id] = item.enabled;
    });

    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(payload));
    } catch {}

    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);

    try {
      await inboxApi.updateSettings(payload);
    } catch (err) {
      console.warn("Failed to persist notification settings to backend:", err);
    }
  };

  return (
    <div className={`notification-settings-view ${isStandalone ? "standalone" : ""}`} data-theme={theme}>
      <div className="notification-header">
        <div className="notification-header-title-group">
          {onBack && (
            <button
              type="button"
              className="notif-back-btn"
              onClick={onBack}
              title="Back to notifications"
              aria-label="Back to unread notifications"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h3>Notification Settings</h3>
        </div>

        <div className="notification-header-actions">
          {savedBadge && (
            <span className="notif-saved-indicator">
              <Check size={12} />
              Saved
            </span>
          )}
          {onClose && (
            <button
              type="button"
              className="notification-close"
              aria-label="Close"
              title="Close"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="notification-list notification-settings-list">
        {settings.map((item) => (
          <button
            key={item.id}
            type="button"
            className="notification-row notification-setting-row"
            aria-pressed={item.enabled}
            onClick={() => toggleSetting(item.id)}
          >
            <div className="notification-info">
              <span className="notification-name">{item.name}</span>
              <span className="notification-desc">{item.description}</span>
            </div>

            <span
              className={`toggle-pill ${item.enabled ? "on" : ""}`}
              aria-label={`${item.name} ${item.enabled ? "enabled" : "disabled"}`}
            />
          </button>
        ))}
      </div>

      {onBack && (
        <div className="notification-footer">
          <button type="button" className="notif-footer-link" onClick={onBack}>
            <ArrowLeft size={13} />
            <span>Back to Unread Notifications</span>
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Main Notification Dropdown in Navbar
 * Shows UNREAD NOTIFICATIONS ONLY by default, with option to switch to Notification Settings
 */
const NotificationSettings = ({ theme = "dark" }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState("unread"); // "unread" | "settings"
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.READ_IDS);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const containerRef = useRef(null);

  // Load unread notifications from API or fallback
  const loadNotifications = async () => {
    try {
      const data = await inboxApi.getAll();
      if (Array.isArray(data) && data.length > 0) {
        setNotifications(data);
        return;
      }
    } catch (err) {
      console.warn("Unable to fetch notifications from inbox API:", err);
    }
    // Fallback unread notifications
    setNotifications(INITIAL_UNREAD_NOTIFICATIONS);
  };

  useEffect(() => {
    loadNotifications();

    const handleSync = () => {
      loadNotifications();
    };

    window.addEventListener("nexus:notifications-changed", handleSync);
    window.addEventListener("focus", handleSync);
    return () => {
      window.removeEventListener("nexus:notifications-changed", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, []);

  // Filter unread notifications only
  const unreadNotifications = useMemo(() => {
    return notifications.filter(
      (n) => n.unread && !n.archived && !n.deleted && !readIds.has(n.id)
    );
  }, [notifications, readIds]);

  const unreadCount = unreadNotifications.length;

  // Handle outside click & Esc key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setIsOpen(false);
        setCurrentView("unread");
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setCurrentView("unread");
      }
    };

    if (isOpen) {
      document.addEventListener("pointerdown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Mark single notification as read
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();

    const nextReadIds = new Set(readIds);
    nextReadIds.add(id);
    setReadIds(nextReadIds);

    try {
      localStorage.setItem(STORAGE_KEYS.READ_IDS, JSON.stringify([...nextReadIds]));
    } catch {}

    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: false } : item))
    );

    window.dispatchEvent(
      new CustomEvent("nexus:notifications-changed", { detail: { id, unread: false } })
    );

    try {
      await inboxApi.markAsRead(id, false);
    } catch {}
  };

  // Mark all unread notifications as read
  const handleMarkAllAsRead = async () => {
    const allIds = unreadNotifications.map((n) => n.id);
    const nextReadIds = new Set([...readIds, ...allIds]);
    setReadIds(nextReadIds);

    try {
      localStorage.setItem(STORAGE_KEYS.READ_IDS, JSON.stringify([...nextReadIds]));
    } catch {}

    setNotifications((prev) =>
      prev.map((item) => ({ ...item, unread: false }))
    );

    window.dispatchEvent(
      new CustomEvent("nexus:notifications-changed", { detail: { allRead: true } })
    );

    try {
      await inboxApi.markAllAsRead();
    } catch {}
  };

  // Navigate to Inbox
  const handleOpenInbox = (notifId) => {
    if (notifId) {
      handleMarkAsRead(notifId);
    }
    setIsOpen(false);
    navigate("/work/inbox");
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case "mention":
        return <AtSign size={13} />;
      case "task":
        return <CheckSquare size={13} />;
      case "review":
        return <Layers size={13} />;
      default:
        return <MessageSquare size={13} />;
    }
  };

  return (
    <div className="notification-settings" data-theme={theme} ref={containerRef}>
      {/* Bell Toggle Icon Button with Unread Badge */}
      <button
        type="button"
        className={`notification-toggle ${isOpen ? "active" : ""}`}
        data-theme={theme}
        aria-label={`Notifications (${unreadCount} unread)`}
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "Notifications"}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) setCurrentView("unread");
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className="notification-dropdown"
          data-theme={theme}
          role="dialog"
          aria-label={currentView === "settings" ? "Notification settings" : "Unread notifications"}
        >
          {currentView === "settings" ? (
            /* Notification Settings Panel */
            <NotificationSettingsPanel
              theme={theme}
              onBack={() => setCurrentView("unread")}
              onClose={() => setIsOpen(false)}
            />
          ) : (
            /* UNREAD NOTIFICATIONS VIEW ONLY */
            <div className="unread-notifications-view">
              {/* Header */}
              <div className="notification-header">
                <div className="notification-header-title-group">
                  <h3>Notifications</h3>
                  {unreadCount > 0 ? (
                    <span className="unread-pill-count">
                      {unreadCount} unread
                    </span>
                  ) : (
                    <span className="unread-pill-count caught-up">
                      0 unread
                    </span>
                  )}
                </div>

                <div className="notification-header-actions">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="notif-header-action-btn"
                      onClick={handleMarkAllAsRead}
                      title="Mark all as read"
                      aria-label="Mark all unread notifications as read"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="notif-header-action-btn"
                    onClick={() => setCurrentView("settings")}
                    title="Notification settings"
                    aria-label="Open notification settings"
                  >
                    <SettingsIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className="notification-close"
                    aria-label="Close notifications"
                    title="Close"
                    onClick={() => setIsOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Unread Notifications List */}
              <div className="notification-list unread-list">
                {unreadCount > 0 ? (
                  unreadNotifications.map((item) => (
                    <div
                      key={item.id}
                      className="unread-notif-item"
                      onClick={() => handleOpenInbox(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenInbox(item.id);
                        }
                      }}
                      title="Click to view in Inbox"
                    >
                      {/* Avatar */}
                      <div
                        className="notif-avatar"
                        style={{ background: item.avatarColor || "#6366f1" }}
                      >
                        {item.avatar || item.author?.[0] || "N"}
                        <span className="notif-type-badge">
                          {getNotifIcon(item.type)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="notif-content">
                        <div className="notif-content-top">
                          <span className="notif-author">{item.author}</span>
                          <span className="notif-time">
                            <Clock size={11} />
                            {item.time || item.date}
                          </span>
                        </div>

                        <div className="notif-title-row">
                          <span className="notif-title">{item.title}</span>
                          <span className="notif-unread-dot" title="Unread" />
                        </div>

                        {item.snippet && (
                          <p className="notif-snippet">{item.snippet}</p>
                        )}

                        {item.tags && item.tags.length > 0 && (
                          <div className="notif-tags-strip">
                            {item.tags.map((tag) => (
                              <span key={tag} className="notif-tag-pill">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quick mark as read button */}
                      <button
                        type="button"
                        className="notif-mark-read-btn"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        title="Mark as read"
                        aria-label={`Mark "${item.title}" as read`}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  /* Empty state when 0 unread */
                  <div className="notif-empty-state">
                    <div className="notif-empty-icon-wrap">
                      <Sparkles size={26} className="notif-empty-icon" />
                    </div>
                    <h4>All caught up!</h4>
                    <p>You have no unread notifications right now.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="notification-footer">
                <button
                  type="button"
                  className="notif-footer-settings-btn"
                  onClick={() => setCurrentView("settings")}
                  title="Configure notifications"
                >
                  <SettingsIcon size={13} />
                  <span>Notification Settings</span>
                </button>

                <button
                  type="button"
                  className="notif-footer-inbox-btn"
                  onClick={() => handleOpenInbox()}
                  title="Open full Inbox"
                >
                  <span>Open Inbox</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
