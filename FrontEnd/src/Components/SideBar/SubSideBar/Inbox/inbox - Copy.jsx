import { useEffect, useMemo, useState } from "react";
import {
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  Star,
  Archive,
  Trash2,
  CheckSquare,
  Clock,
  MessageSquare,
  AtSign,
  ArrowUpDown,
  Search,
  X,
  Settings,
  RefreshCw,
  Send,
  Check,
  Tag,
  Plus,
  SendHorizontal,
  ChevronLeft,
  Paperclip,
  Printer,
  User,
  CheckCheck,
  Loader2,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react";
import inboxApi from "./inboxApi";
import "./inbox.css";

/* =========================================================
   FORMAL ENTERPRISE INBOX COMPONENT
   Fully Adaptive: Light & Dark Theme Support
   Clean 2-Pane Architecture: Message List + Reading Pane
   Top Command & Folder Bar with Theme Switcher
========================================================= */

function Inbox({ theme: propTheme }) {
  // Theme state synced with App / localStorage / DOM attribute
  const [currentTheme, setCurrentTheme] = useState(() => {
    return (
      propTheme ||
      document.documentElement.getAttribute("data-theme") ||
      (typeof window !== "undefined"
        ? localStorage.getItem("nexus-theme")
        : "dark") ||
      "dark"
    );
  });

  useEffect(() => {
    if (propTheme) {
      setCurrentTheme(propTheme);
      return;
    }
    const syncTheme = () => {
      const active =
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("nexus-theme") ||
        "dark";
      setCurrentTheme(active);
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [propTheme]);

  const toggleTheme = () => {
    const next = currentTheme === "dark" ? "light" : "dark";
    setCurrentTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.body.setAttribute("data-theme", next);
    try {
      localStorage.setItem("nexus-theme", next);
    } catch {}
  };

  // Main notifications state
  const [notifications, setNotifications] = useState([]);
  const [activeFolder, setActiveFolder] = useState("inbox"); // inbox, unread, starred, mentions, tasks, sent, archive, trash
  const [activeLabel, setActiveLabel] = useState(null); // optional label filter
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // all, unread, starred, task
  const [sortNewest, setSortNewest] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);

  // Reply Composer State
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Compose Modal State
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({
    to: "Alex Rivera",
    toEmail: "alex.rivera@nexusapp.io",
    subject: "",
    type: "message",
    description: "",
    tags: "Sprint, Team",
  });
  const [isSubmittingCompose, setIsSubmittingCompose] = useState(false);

  // Preferences Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [notifySettings, setNotifySettings] = useState({
    tasks: true,
    mentions: true,
    sprints: true,
    desktop: true,
    digest: false,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Toast banner alert
  const [statusToast, setStatusToast] = useState(null);

  const showToast = (message, type = "success") => {
    setStatusToast({ message, type });
    setTimeout(() => {
      setStatusToast(null);
    }, 3500);
  };

  /* ---------------------------------------------------------
     FETCH INBOX DATA FROM BACKEND API
  --------------------------------------------------------- */
  const fetchInboxData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await inboxApi.getAll();
      if (Array.isArray(data)) {
        setNotifications(data);
        if (selectedId && !data.some((n) => n.id === selectedId)) {
          setSelectedId(null);
        }
      }
    } catch (err) {
      console.warn("[Inbox] Error fetching inbox notifications:", err);
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInboxData();

    inboxApi
      .getSettings()
      .then((settings) => {
        if (settings) {
          setNotifySettings((prev) => ({ ...prev, ...settings }));
        }
      })
      .catch(() => {});
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchInboxData(true);
  };

  /* ---------------------------------------------------------
     FOLDER COUNTS
  --------------------------------------------------------- */
  const counts = useMemo(() => {
    const active = notifications.filter((n) => !n.archived && !n.deleted);
    return {
      inbox: active.length,
      unread: active.filter((n) => n.unread).length,
      starred: active.filter((n) => n.starred).length,
      mentions: active.filter((n) => n.mentioned).length,
      tasks: active.filter((n) => n.type === "task").length,
      sent: notifications.filter((n) => n.isSent && !n.deleted).length,
      archive: notifications.filter((n) => n.archived && !n.deleted).length,
      trash: notifications.filter((n) => n.deleted).length,
    };
  }, [notifications]);

  /* ---------------------------------------------------------
     FILTERED & SORTED MESSAGES
  --------------------------------------------------------- */
  const visibleNotifications = useMemo(() => {
    let list = [...notifications];

    // Folder filtering
    if (activeFolder === "archive") {
      list = list.filter((n) => n.archived && !n.deleted);
    } else if (activeFolder === "trash") {
      list = list.filter((n) => n.deleted);
    } else if (activeFolder === "sent") {
      list = list.filter((n) => n.isSent && !n.deleted);
    } else {
      list = list.filter((n) => !n.archived && !n.deleted && !n.isSent);
      if (activeFolder === "unread") {
        list = list.filter((n) => n.unread);
      } else if (activeFolder === "starred") {
        list = list.filter((n) => n.starred);
      } else if (activeFolder === "mentions") {
        list = list.filter((n) => n.mentioned);
      } else if (activeFolder === "tasks") {
        list = list.filter((n) => n.type === "task");
      }
    }

    // Label tag filtering
    if (activeLabel) {
      list = list.filter(
        (n) =>
          Array.isArray(n.tags) &&
          n.tags.some((t) => t.toLowerCase() === activeLabel.toLowerCase())
      );
    }

    // Secondary Filter Tab (All, Unread, Starred, Tasks)
    if (filterType === "unread") {
      list = list.filter((n) => n.unread);
    } else if (filterType === "starred") {
      list = list.filter((n) => n.starred);
    } else if (filterType === "task") {
      list = list.filter((n) => n.type === "task");
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((n) => {
        const inTitle = n.title?.toLowerCase().includes(q);
        const inAuthor = n.author?.toLowerCase().includes(q);
        const inEmail = n.author_email?.toLowerCase().includes(q);
        const inDesc = n.description?.toLowerCase().includes(q);
        const inSnippet = n.snippet?.toLowerCase().includes(q);
        const inTags = n.tags?.some((t) => t.toLowerCase().includes(q));
        const inTasks = n.tasks?.some((t) =>
          t.title?.toLowerCase().includes(q)
        );
        return inTitle || inAuthor || inEmail || inDesc || inSnippet || inTags || inTasks;
      });
    }

    // Sort order
    return list.sort((a, b) => {
      const dateA = new Date(a.created_at || a.date || 0).getTime();
      const dateB = new Date(b.created_at || b.date || 0).getTime();
      return sortNewest ? dateB - dateA : dateA - dateB;
    });
  }, [notifications, activeFolder, activeLabel, filterType, searchQuery, sortNewest]);

  const activeNotification = useMemo(() => {
    return selectedId
      ? notifications.find((n) => n.id === selectedId) || null
      : null;
  }, [notifications, selectedId]);

  /* ---------------------------------------------------------
     ACTIONS & API HANDLERS
  --------------------------------------------------------- */
  const handleSelectMessage = async (id) => {
    setSelectedId(id);
    const item = notifications.find((n) => n.id === id);
    if (item && item.unread) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
      );
      try {
        await inboxApi.markAsRead(id, false);
      } catch (err) {
        console.warn("[Inbox] markAsRead error:", err);
      }
    }
  };

  const handleToggleStar = async (id, e) => {
    e?.stopPropagation();
    const item = notifications.find((n) => n.id === id);
    if (!item) return;
    const nextStarred = !item.starred;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, starred: nextStarred } : n))
    );
    try {
      await inboxApi.toggleStar(id, nextStarred);
      showToast(nextStarred ? "Conversation starred" : "Star removed");
    } catch (err) {
      console.warn("[Inbox] toggleStar error:", err);
    }
  };

  const handleToggleRead = async (id, e) => {
    e?.stopPropagation();
    const item = notifications.find((n) => n.id === id);
    if (!item) return;
    const nextUnread = !item.unread;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: nextUnread } : n))
    );
    try {
      await inboxApi.markAsRead(id, nextUnread);
      showToast(nextUnread ? "Marked as unread" : "Marked as read");
    } catch (err) {
      console.warn("[Inbox] markAsRead error:", err);
    }
  };

  const handleArchive = async (id, e) => {
    e?.stopPropagation();
    const item = notifications.find((n) => n.id === id);
    if (!item) return;
    const nextArchived = !item.archived;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, archived: nextArchived } : n))
    );
    if (selectedId === id) setSelectedId(null);
    try {
      await inboxApi.toggleArchive(id, nextArchived);
      showToast(nextArchived ? "Conversation archived" : "Moved back to inbox");
    } catch (err) {
      console.warn("[Inbox] toggleArchive error:", err);
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    const item = notifications.find((n) => n.id === id);
    if (!item) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, deleted: true } : n))
    );
    if (selectedId === id) setSelectedId(null);
    try {
      await inboxApi.delete(id);
      showToast("Message moved to Trash");
    } catch (err) {
      console.warn("[Inbox] delete error:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    try {
      await inboxApi.markAllAsRead();
      showToast("All messages marked as read");
    } catch (err) {
      console.warn("[Inbox] markAllAsRead error:", err);
    }
  };

  /* Multi-Select Handling */
  const handleToggleCheck = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === visibleNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleNotifications.map((n) => n.id)));
    }
  };

  /* Bulk Actions */
  const handleBulkMarkRead = async () => {
    const ids = Array.from(selectedIds);
    setNotifications((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? { ...n, unread: false } : n))
    );
    setSelectedIds(new Set());
    try {
      await inboxApi.bulkAction("read", ids);
      showToast(`${ids.length} messages marked as read`);
    } catch (err) {
      console.warn("[Inbox] bulk read error:", err);
    }
  };

  const handleBulkMarkUnread = async () => {
    const ids = Array.from(selectedIds);
    setNotifications((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? { ...n, unread: true } : n))
    );
    setSelectedIds(new Set());
    try {
      await inboxApi.bulkAction("unread", ids);
      showToast(`${ids.length} messages marked as unread`);
    } catch (err) {
      console.warn("[Inbox] bulk unread error:", err);
    }
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    setNotifications((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? { ...n, archived: true } : n))
    );
    if (selectedIds.has(selectedId)) setSelectedId(null);
    setSelectedIds(new Set());
    try {
      await inboxApi.bulkAction("archive", ids);
      showToast(`${ids.length} messages archived`);
    } catch (err) {
      console.warn("[Inbox] bulk archive error:", err);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setNotifications((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? { ...n, deleted: true } : n))
    );
    if (selectedIds.has(selectedId)) setSelectedId(null);
    setSelectedIds(new Set());
    try {
      await inboxApi.bulkAction("delete", ids);
      showToast(`${ids.length} messages moved to Trash`);
    } catch (err) {
      console.warn("[Inbox] bulk delete error:", err);
    }
  };

  /* Task Checklist Item Toggle */
  const handleToggleTaskItem = async (notifId, taskId) => {
    const notif = notifications.find((n) => n.id === notifId);
    if (!notif || !Array.isArray(notif.tasks)) return;

    const task = notif.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextCompleted = !task.completed;

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== notifId) return n;
        return {
          ...n,
          tasks: n.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: nextCompleted } : t
          ),
        };
      })
    );

    try {
      await inboxApi.toggleTask(notifId, taskId, nextCompleted);
    } catch (err) {
      console.warn("[Inbox] toggleTask error:", err);
    }
  };

  /* Send Reply */
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeNotification) return;

    setIsSendingReply(true);
    const textToSend = replyText.trim();
    const replyDoc = {
      id: `rep_${Date.now()}`,
      author: "You",
      text: textToSend,
      time: "Just now",
      date: "Today",
      created_at: new Date().toISOString(),
    };

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== activeNotification.id) return n;
        return {
          ...n,
          replies: [...(n.replies || []), replyDoc],
        };
      })
    );
    setReplyText("");

    try {
      await inboxApi.sendReply(activeNotification.id, textToSend);
      showToast("Reply sent successfully");
    } catch (err) {
      console.warn("[Inbox] sendReply error:", err);
    } finally {
      setIsSendingReply(false);
    }
  };

  /* Submit Compose Message */
  const handleComposeSubmit = async (e) => {
    e.preventDefault();
    if (!composeForm.subject.trim()) {
      showToast("Subject line is required", "error");
      return;
    }

    setIsSubmittingCompose(true);
    const newMsg = {
      title: composeForm.subject.trim(),
      description:
        composeForm.description.trim() || "No message content provided.",
      snippet:
        composeForm.description.trim().slice(0, 100) ||
        composeForm.subject.trim(),
      author: composeForm.to || "Recipient",
      author_email: composeForm.toEmail || "team@nexusapp.io",
      type: composeForm.type,
      tags: composeForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      unread: false,
      starred: false,
      isSent: true,
      time: "Just now",
      date: "Today",
    };

    try {
      const created = await inboxApi.create(newMsg);
      const inserted = created || { ...newMsg, id: `msg_${Date.now()}` };
      setNotifications((prev) => [inserted, ...prev]);
      setShowCompose(false);
      setComposeForm({
        to: "Alex Rivera",
        toEmail: "alex.rivera@nexusapp.io",
        subject: "",
        type: "message",
        description: "",
        tags: "Sprint, Team",
      });
      showToast("Message sent successfully");
      setActiveFolder("inbox");
      setSelectedId(inserted.id);
    } catch (err) {
      console.warn("[Inbox] compose error:", err);
      showToast("Failed to send message", "error");
    } finally {
      setIsSubmittingCompose(false);
    }
  };

  /* Save Preferences */
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await inboxApi.updateSettings(notifySettings);
      setShowSettings(false);
      showToast("Notification preferences updated");
    } catch (err) {
      console.warn("[Inbox] save settings error:", err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="inbox-page-root" data-theme={currentTheme}>
      {/* Toast Notification Banner */}
      {statusToast && (
        <div className={`inbox-toast toast-${statusToast.type}`}>
          <div className="toast-dot" />
          <span>{statusToast.message}</span>
        </div>
      )}

      {/* =========================================================
         2-PANE WORKSPACE: MESSAGE LIST + READING PANE
      ========================================================= */}
      <div className="inbox-workspace">
        {/* =========================================================
           PANE 1: MESSAGE STREAM LIST (Left)
        ========================================================= */}
        <section
          className={`inbox-list-pane ${
            selectedId ? "mobile-pane-hidden" : ""
          }`}
        >
          {/* Executive Header within List Pane */}
          <div className="inbox-list-header">
            <div className="inbox-header-title-bar">
              <div className="inbox-title-cluster">
                <h2 className="inbox-heading">Inbox</h2>
                {counts.unread > 0 ? (
                  <span className="inbox-badge-unread">
                    {counts.unread} unread
                  </span>
                ) : (
                  <span className="inbox-badge-caughtup">All caught up</span>
                )}
              </div>

              <div className="inbox-head-actions">
                <button
                  type="button"
                  className="inbox-primary-compose-btn"
                  onClick={() => setShowCompose(true)}
                  title="Compose New Message"
                >
                  <Plus size={15} strokeWidth={2.4} />
                  <span>New</span>
                </button>

                <button
                  type="button"
                  className={`inbox-head-btn ${isRefreshing ? "spinning" : ""}`}
                  onClick={handleRefresh}
                  title="Refresh inbox"
                >
                  <RefreshCw size={14} />
                </button>

                <button
                  type="button"
                  className="inbox-head-btn"
                  onClick={handleMarkAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={15} />
                </button>

                <button
                  type="button"
                  className="inbox-head-btn"
                  onClick={() => setShowSettings(true)}
                  title="Notification Preferences"
                >
                  <Settings size={15} />
                </button>
              </div>
            </div>

            {/* Folder & Category Pills Bar */}
            <div className="inbox-category-pills">
              <button
                type="button"
                className={`category-pill ${
                  activeFolder === "inbox" && !activeLabel ? "active" : ""
                }`}
                onClick={() => {
                  setActiveFolder("inbox");
                  setActiveLabel(null);
                }}
              >
                <span>Inbox</span>
                {counts.inbox > 0 && (
                  <span className="cat-pill-count">{counts.inbox}</span>
                )}
              </button>

              <button
                type="button"
                className={`category-pill ${
                  activeFolder === "unread" && !activeLabel ? "active" : ""
                }`}
                onClick={() => {
                  setActiveFolder("unread");
                  setActiveLabel(null);
                }}
              >
                <span>Unread</span>
                {counts.unread > 0 && (
                  <span className="cat-pill-count unread-cat-count">
                    {counts.unread}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`category-pill ${
                  activeFolder === "starred" && !activeLabel ? "active" : ""
                }`}
                onClick={() => {
                  setActiveFolder("starred");
                  setActiveLabel(null);
                }}
              >
                <Star
                  size={12}
                  fill={activeFolder === "starred" ? "#f59e0b" : "none"}
                />
                <span>Starred</span>
                {counts.starred > 0 && (
                  <span className="cat-pill-count">{counts.starred}</span>
                )}
              </button>

              <button
                type="button"
                className={`category-pill ${
                  activeFolder === "tasks" && !activeLabel ? "active" : ""
                }`}
                onClick={() => {
                  setActiveFolder("tasks");
                  setActiveLabel(null);
                }}
              >
                <CheckSquare size={12} />
                <span>Tasks</span>
                {counts.tasks > 0 && (
                  <span className="cat-pill-count">{counts.tasks}</span>
                )}
              </button>

              <button
                type="button"
                className={`category-pill ${
                  activeFolder === "mentions" && !activeLabel ? "active" : ""
                }`}
                onClick={() => {
                  setActiveFolder("mentions");
                  setActiveLabel(null);
                }}
              >
                <AtSign size={12} />
                <span>Mentions</span>
                {counts.mentions > 0 && (
                  <span className="cat-pill-count">{counts.mentions}</span>
                )}
              </button>



              <button
                type="button"
                className={`category-pill ${
                  activeFolder === "trash" && !activeLabel ? "active" : ""
                }`}
                onClick={() => {
                  setActiveFolder("trash");
                  setActiveLabel(null);
                }}
              >
                <Trash2 size={12} />
                <span>Trash</span>
              </button>


            </div>

            {/* Integrated Search Input */}
            <div className="inbox-search-container">
              <div className="inbox-search-field">
                <Search size={14} className="inbox-search-icon" />
                <input
                  type="text"
                  className="inbox-search-input"
                  placeholder="Search notifications, tasks, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="inbox-search-clear"
                    onClick={() => setSearchQuery("")}
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* List Toolbar (Multi-select, Bulk Actions, Count & Sort) */}
            <div className="inbox-list-toolbar">
              <div className="toolbar-left-tools">
                <label
                  className="inbox-checkbox-wrap"
                  title="Select all visible messages"
                >
                  <input
                    type="checkbox"
                    checked={
                      visibleNotifications.length > 0 &&
                      selectedIds.size === visibleNotifications.length
                    }
                    onChange={handleSelectAll}
                  />
                  <span className="inbox-checkbox-custom">
                    {selectedIds.size > 0 &&
                    selectedIds.size < visibleNotifications.length ? (
                      <span className="indeterminate-line" />
                    ) : selectedIds.size === visibleNotifications.length &&
                      visibleNotifications.length > 0 ? (
                      <Check size={11} />
                    ) : null}
                  </span>
                </label>

                {selectedIds.size > 0 ? (
                  <div className="toolbar-bulk-actions">
                    <span className="bulk-count-badge">
                      {selectedIds.size} selected
                    </span>
                    <button
                      type="button"
                      className="bulk-action-btn"
                      onClick={handleBulkMarkRead}
                      title="Mark as read"
                    >
                      <MailOpen size={13} />
                    </button>
                    <button
                      type="button"
                      className="bulk-action-btn"
                      onClick={handleBulkMarkUnread}
                      title="Mark as unread"
                    >
                      <Mail size={13} />
                    </button>

                    <button
                      type="button"
                      className="bulk-action-btn danger-action"
                      onClick={handleBulkDelete}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="toolbar-summary-info">
                    <span className="summary-folder-text">
                      {activeLabel
                        ? `Tag: #${activeLabel}`
                        : activeFolder === "inbox"
                        ? "All Notifications"
                        : activeFolder.charAt(0).toUpperCase() +
                          activeFolder.slice(1)}
                    </span>
                    <span className="summary-count-dot">•</span>
                    <span className="summary-count-text">
                      {visibleNotifications.length}{" "}
                      {visibleNotifications.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                )}
              </div>

              <div className="toolbar-right-tools">
                <button
                  type="button"
                  className="toolbar-sort-btn"
                  onClick={() => setSortNewest(!sortNewest)}
                  title={
                    sortNewest
                      ? "Showing Newest First"
                      : "Showing Oldest First"
                  }
                >
                  <ArrowUpDown size={12} />
                  <span>{sortNewest ? "Newest" : "Oldest"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="messages-stream-container">
            {isLoading ? (
              <div className="inbox-loading-state">
                <Loader2 size={24} className="spinning text-accent" />
                <span>Loading messages from database...</span>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="inbox-empty-state">
                <div className="empty-state-badge">
                  <InboxIcon size={26} />
                </div>
                <h4>No messages found</h4>
                <p>
                  {searchQuery
                    ? `No notifications found matching "${searchQuery}".`
                    : "This folder is currently clear. Real-time updates from MongoDB will appear here."}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    className="clear-filter-btn"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear search query
                  </button>
                )}
              </div>
            ) : (
              <div className="stream-rows-wrapper">
                {visibleNotifications.map((item) => {
                  const isSelected = selectedId === item.id;
                  const isChecked = selectedIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`inbox-message-row ${
                        item.unread ? "unread-status" : "read-status"
                      } ${isSelected ? "selected-row" : ""} ${
                        isChecked ? "checked-row" : ""
                      }`}
                      onClick={() => handleSelectMessage(item.id)}
                    >
                      {/* Controls: Checkbox & Star */}
                      <div
                        className="row-lead-tools"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="inbox-checkbox-wrap">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleToggleCheck(item.id, e)}
                          />
                          <span className="inbox-checkbox-custom">
                            {isChecked && <Check size={11} />}
                          </span>
                        </label>

                        <button
                          type="button"
                          className={`row-star-toggle ${
                            item.starred ? "is-starred" : ""
                          }`}
                          onClick={(e) => handleToggleStar(item.id, e)}
                          title={item.starred ? "Unstar" : "Star"}
                        >
                          <Star
                            size={14}
                            fill={item.starred ? "#f59e0b" : "none"}
                          />
                        </button>
                      </div>

                      {/* Author Avatar */}
                      <div
                        className="row-author-avatar"
                        style={{
                          backgroundColor: item.avatarColor || "#6366f1",
                        }}
                      >
                        {item.avatar ||
                          (item.author
                            ? item.author.slice(0, 2).toUpperCase()
                            : "N")}
                      </div>

                      {/* Row Content */}
                      <div className="row-text-content">
                        <div className="row-meta-top">
                          <span className="row-author-title">
                            {item.author || "System Notification"}
                          </span>
                          <span className="row-timestamp-text">
                            {item.time || item.date || "Today"}
                          </span>
                        </div>

                        <div className="row-subject-wrap">
                          <span className="row-subject-header">
                            {item.title}
                          </span>
                        </div>

                        <div className="row-snippet-wrap">
                          <span className="row-snippet-summary">
                            {item.snippet || item.description}
                          </span>
                        </div>

                        {/* Tag Chips */}
                        {item.tags && item.tags.length > 0 && (
                          <div className="row-tags-shelf">
                            {item.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="row-tag-badge">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Hover Action Bar */}
                      <div
                        className="row-hover-dock"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="hover-dock-btn"
                          onClick={(e) => handleToggleRead(item.id, e)}
                          title={
                            item.unread ? "Mark as read" : "Mark as unread"
                          }
                        >
                          {item.unread ? (
                            <MailOpen size={13} />
                          ) : (
                            <Mail size={13} />
                          )}
                        </button>

                        <button
                          type="button"
                          className="hover-dock-btn danger-hover"
                          onClick={(e) => handleDelete(item.id, e)}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* =========================================================
           PANE 2: READING & DETAIL PANE (Right)
        ========================================================= */}
        <main
          className="inbox-reading-pane"
          aria-label="Message reading view"
        >
          {activeNotification ? (
            <div className="reading-view-wrapper">
              {/* Detail Top Header Toolbar */}
              <div className="reading-action-bar">
                <div className="action-bar-left">
                  <button
                    type="button"
                    className="reading-back-button"
                    onClick={() => setSelectedId(null)}
                    title="Back to list"
                  >
                    <ChevronLeft size={16} />
                    <span>Back</span>
                  </button>

                  <div className="action-button-group">
                    <button
                      type="button"
                      className="reading-header-btn"
                      onClick={(e) =>
                        handleToggleRead(activeNotification.id, e)
                      }
                      title={
                        activeNotification.unread
                          ? "Mark as read"
                          : "Mark as unread"
                      }
                    >
                      {activeNotification.unread ? (
                        <MailOpen size={14} />
                      ) : (
                        <Mail size={14} />
                      )}
                      <span>
                        {activeNotification.unread
                          ? "Mark read"
                          : "Mark unread"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`reading-header-btn ${
                        activeNotification.starred ? "starred-active" : ""
                      }`}
                      onClick={(e) =>
                        handleToggleStar(activeNotification.id, e)
                      }
                      title="Star conversation"
                    >
                      <Star
                        size={14}
                        fill={activeNotification.starred ? "#f59e0b" : "none"}
                      />
                      <span>
                        {activeNotification.starred ? "Starred" : "Star"}
                      </span>
                    </button>



                    <button
                      type="button"
                      className="reading-header-btn danger-btn"
                      onClick={(e) => handleDelete(activeNotification.id, e)}
                      title="Move to Trash"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                <div className="action-bar-right">
                  <button
                    type="button"
                    className="reading-icon-action"
                    onClick={() => window.print()}
                    title="Print message"
                  >
                    <Printer size={15} />
                  </button>
                  <button
                    type="button"
                    className="reading-icon-action"
                    onClick={() => setSelectedId(null)}
                    title="Close preview"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Message Header Card */}
              <div className="reading-subject-card">
                <div className="subject-title-line">
                  <h2 className="subject-heading-title">
                    {activeNotification.title}
                  </h2>
                  {activeNotification.tags && (
                    <div className="subject-tags-list">
                      {activeNotification.tags.map((tag) => (
                        <span key={tag} className="subject-tag-chip">
                          <Tag size={11} />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sender Metadata Box */}
                <div className="sender-metadata-card">
                  <div
                    className="sender-display-avatar"
                    style={{
                      backgroundColor:
                        activeNotification.avatarColor || "#6366f1",
                    }}
                  >
                    {activeNotification.avatar ||
                      (activeNotification.author
                        ? activeNotification.author.slice(0, 2).toUpperCase()
                        : "N")}
                  </div>

                  <div className="sender-identity-info">
                    <div className="identity-lead-line">
                      <strong className="identity-name">
                        {activeNotification.author || "System Notification"}
                      </strong>
                      <span className="identity-email">
                        &lt;
                        {activeNotification.author_email ||
                          "notifications@nexusapp.io"}
                        &gt;
                      </span>
                    </div>

                    <div className="identity-sub-line">
                      <span className="meta-to-label">To:</span>
                      <span className="meta-to-target">
                        You &lt;me@nexusapp.io&gt;
                      </span>
                      <span className="meta-sep">·</span>
                      <span className="meta-date-stamp">
                        {activeNotification.date || "Today"}
                        {activeNotification.time
                          ? ` at ${activeNotification.time}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Body Content */}
              <div className="reading-article-body">
                <div className="body-text-block">
                  <p>{activeNotification.description}</p>
                </div>

                {/* Assigned Task Checklist (if tasks present) */}
                {activeNotification.tasks &&
                  activeNotification.tasks.length > 0 && (
                    <div className="reading-tasklist-card">
                      <div className="tasklist-top-bar">
                        <div className="tasklist-heading">
                          <CheckSquare
                            size={16}
                            className="tasklist-lead-icon"
                          />
                          <h3>Assigned Action Checklist</h3>
                        </div>
                        <span className="tasklist-count-badge">
                          {
                            activeNotification.tasks.filter((t) => t.completed)
                              .length
                          }{" "}
                          of {activeNotification.tasks.length} Completed
                        </span>
                      </div>

                      <div className="tasklist-items-shelf">
                        {activeNotification.tasks.map((task) => (
                          <div
                            key={task.id}
                            className={`tasklist-single-row ${
                              task.completed ? "is-task-done" : ""
                            }`}
                            onClick={() =>
                              handleToggleTaskItem(
                                activeNotification.id,
                                task.id
                              )
                            }
                          >
                            <label
                              className="inbox-checkbox-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(task.completed)}
                                onChange={() =>
                                  handleToggleTaskItem(
                                    activeNotification.id,
                                    task.id
                                  )
                                }
                              />
                              <span className="inbox-checkbox-custom">
                                {task.completed && <Check size={11} />}
                              </span>
                            </label>

                            <div className="tasklist-row-info">
                              <span className="tasklist-row-title">
                                {task.title}
                              </span>
                              {task.date && (
                                <span className="tasklist-row-due">
                                  <Clock size={11} />
                                  <span>{task.date}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Conversation History */}
                {activeNotification.replies &&
                  activeNotification.replies.length > 0 && (
                    <div className="reading-history-section">
                      <div className="history-section-header">
                        <MessageSquare size={14} />
                        <h4>Conversation History</h4>
                      </div>

                      <div className="history-bubbles-stack">
                        {activeNotification.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="history-bubble-card"
                          >
                            <div className="bubble-lead-line">
                              <span className="bubble-sender">
                                {reply.author}
                              </span>
                              <span className="bubble-time-stamp">
                                {reply.time || "Recently"}
                              </span>
                            </div>
                            <div className="bubble-message-text">
                              {reply.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Inline Reply Composer */}
              <div className="reading-reply-box">
                <form onSubmit={handleSendReply} className="reply-box-form">
                  <div className="reply-box-recipient-strip">
                    <div className="recipient-tag">
                      <User size={13} />
                      <span>
                        Reply to {activeNotification.author || "Sender"}
                      </span>
                    </div>
                  </div>

                  <textarea
                    className="reply-box-textarea"
                    rows={3}
                    placeholder={`Write a reply to ${
                      activeNotification.author || "the sender"
                    }...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />

                  <div className="reply-box-footer">
                    <div className="reply-tools-left">
                      <button
                        type="button"
                        className="reply-tool-btn"
                        title="Attach file"
                      >
                        <Paperclip size={14} />
                      </button>
                    </div>

                    <div className="reply-actions-right">
                      {replyText && (
                        <button
                          type="button"
                          className="reply-cancel-btn"
                          onClick={() => setReplyText("")}
                        >
                          Discard
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={!replyText.trim() || isSendingReply}
                        className="reply-submit-btn"
                      >
                        {isSendingReply ? (
                          <Loader2 size={14} className="spinning" />
                        ) : (
                          <Send size={14} />
                        )}
                        <span>Send Reply</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="reading-pane-empty">
              <div className="empty-content-box">
                <div className="empty-mail-badge">
                  <MailOpen size={36} />
                </div>
                <h3>Select a message to view details</h3>
                <p>
                  Choose any notification or conversation from the list to read
                  the full body, check action items, and post replies.
                </p>
                <div className="empty-hints-card">
                  <div className="hint-row">
                    <kbd>↑</kbd> <kbd>↓</kbd> <span>Navigate messages</span>
                  </div>

                  <div className="hint-row">
                    <kbd>S</kbd> <span>Toggle star</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================
         COMPOSE MODAL
      ========================================================= */}
      {showCompose && (
        <div className="inbox-modal-overlay">
          <div className="inbox-compose-modal">
            <div className="inbox-modal-header">
              <div className="inbox-modal-title">
                <SendHorizontal size={16} />
                <h3>New Notification / Message</h3>
              </div>
              <button
                type="button"
                className="inbox-modal-close"
                onClick={() => setShowCompose(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleComposeSubmit} className="inbox-modal-form">
              <div className="form-field-row">
                <label className="field-label">To:</label>
                <input
                  type="text"
                  className="field-input"
                  value={composeForm.to}
                  onChange={(e) =>
                    setComposeForm({ ...composeForm, to: e.target.value })
                  }
                  placeholder="Recipient Name"
                  required
                />
              </div>

              <div className="form-field-row">
                <label className="field-label">Email:</label>
                <input
                  type="email"
                  className="field-input"
                  value={composeForm.toEmail}
                  onChange={(e) =>
                    setComposeForm({
                      ...composeForm,
                      toEmail: e.target.value,
                    })
                  }
                  placeholder="recipient@nexusapp.io"
                  required
                />
              </div>

              <div className="form-field-row">
                <label className="field-label">Subject:</label>
                <input
                  type="text"
                  className="field-input"
                  value={composeForm.subject}
                  onChange={(e) =>
                    setComposeForm({
                      ...composeForm,
                      subject: e.target.value,
                    })
                  }
                  placeholder="Enter subject title..."
                  required
                />
              </div>

              <div className="form-field-row">
                <label className="field-label">Type:</label>
                <select
                  className="field-select"
                  value={composeForm.type}
                  onChange={(e) =>
                    setComposeForm({ ...composeForm, type: e.target.value })
                  }
                >
                  <option value="message">General Message</option>
                  <option value="task">Action Item / Task</option>
                  <option value="mention">Team Mention</option>
                </select>
              </div>

              <div className="form-field-row">
                <label className="field-label">Tags:</label>
                <input
                  type="text"
                  className="field-input"
                  value={composeForm.tags}
                  onChange={(e) =>
                    setComposeForm({ ...composeForm, tags: e.target.value })
                  }
                  placeholder="Comma separated: Sprint, DevOps, Frontend"
                />
              </div>

              <div className="form-field-col">
                <label className="field-label">Message Content:</label>
                <textarea
                  className="field-textarea"
                  rows={6}
                  value={composeForm.description}
                  onChange={(e) =>
                    setComposeForm({
                      ...composeForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Compose your message or notification details here..."
                  required
                />
              </div>

              <div className="inbox-modal-footer">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setShowCompose(false)}
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCompose}
                  className="modal-btn-submit"
                >
                  {isSubmittingCompose ? (
                    <Loader2 size={14} className="spinning" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>Send Notification</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
         PREFERENCES MODAL
      ========================================================= */}
      {showSettings && (
        <div className="inbox-modal-overlay">
          <div className="inbox-settings-modal">
            <div className="inbox-modal-header">
              <div className="inbox-modal-title">
                <Settings size={16} />
                <h3>Notification Preferences</h3>
              </div>
              <button
                type="button"
                className="inbox-modal-close"
                onClick={() => setShowSettings(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="inbox-modal-form">
              <p className="settings-intro-text">
                Configure your alert preferences and database synchronization
                settings.
              </p>

              <div className="settings-toggles-container">
                {[
                  {
                    id: "tasks",
                    title: "Task & Action Item Alerts",
                    desc: "Get notified when assigned tasks are updated or completed.",
                  },
                  {
                    id: "mentions",
                    title: "@Mentions & Team Tags",
                    desc: "Notify when team members mention you in discussions.",
                  },
                  {
                    id: "sprints",
                    title: "Sprint Lifecycle Updates",
                    desc: "Receive alerts when sprints start, complete, or change.",
                  },
                  {
                    id: "desktop",
                    title: "Desktop Push Notifications",
                    desc: "Display system browser popups for urgent priority items.",
                  },
                  {
                    id: "digest",
                    title: "Daily Digest Summary",
                    desc: "Send an end-of-day summary email of all pending action items.",
                  },
                ].map((item) => (
                  <label key={item.id} className="settings-toggle-card">
                    <div className="toggle-card-text">
                      <strong>{item.title}</strong>
                      <span>{item.desc}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(notifySettings[item.id])}
                      onChange={(e) =>
                        setNotifySettings({
                          ...notifySettings,
                          [item.id]: e.target.checked,
                        })
                      }
                      className="inbox-switch-input"
                    />
                  </label>
                ))}
              </div>

              <div className="inbox-modal-footer">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingSettings}
                  className="modal-btn-submit"
                  onClick={handleSaveSettings}
                >
                  {isSavingSettings ? (
                    <Loader2 size={14} className="spinning" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inbox;