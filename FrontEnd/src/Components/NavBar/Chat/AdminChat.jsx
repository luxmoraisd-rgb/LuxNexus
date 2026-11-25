import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { authClient } from "../../Auth/authApi";
import "./admin-chat.css";

const POLL_INTERVAL_OPEN = 3000;
const POLL_INTERVAL_CLOSED = 10000;
const CAN_SEND_ROLES = new Set(["admin", "team_lead", "user"]);

const getErrorMessage = (error, fallback) =>
  error.response?.data?.detail ||
  error.response?.data?.content ||
  fallback;

const AdminChat = ({ currentUser, theme = "dark" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef(null);
  const latestMessageAtRef = useRef("");
  const requestInFlightRef = useRef(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    let active = true;

    const refresh = async (loadHistory = false) => {
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      try {
        if (!isOpen) {
          const { data } = await authClient.get("/admin-chat/unread/");
          if (active) setUnreadCount(data.unread_count);
          return;
        }

        const after = loadHistory ? "" : latestMessageAtRef.current;
        const { data } = await authClient.get("/admin-chat/", {
          params: after ? { after } : undefined,
        });
        if (!active) return;
        setMessages((existing) => {
          const knownIds = new Set(existing.map((message) => message.id));
          return [
            ...existing,
            ...data.messages.filter((message) => !knownIds.has(message.id)),
          ];
        });
        const latestMessage = data.messages[data.messages.length - 1];
        if (
          latestMessage &&
          latestMessage.created_at > latestMessageAtRef.current
        ) {
          latestMessageAtRef.current = latestMessage.created_at;
        }
        setUnreadCount(data.unread_count);
        setErrorMessage("");

        const { data: readData } = await authClient.post("/admin-chat/read/");
        if (active) setUnreadCount(readData.unread_count);
      } catch (error) {
        if (active) {
          setErrorMessage(getErrorMessage(error, "Unable to load chat."));
        }
      } finally {
        requestInFlightRef.current = false;
      }
    };

    refresh(isOpen);
    const timer = window.setInterval(
      () => refresh(),
      isOpen ? POLL_INTERVAL_OPEN : POLL_INTERVAL_CLOSED,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser.id, isOpen]);

  useEffect(() => {
    if (isOpen || !isVisible) return undefined;
    closeTimerRef.current = window.setTimeout(() => setIsVisible(false), 200);
    return () => window.clearTimeout(closeTimerRef.current);
  }, [isOpen, isVisible]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const handleSend = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setErrorMessage("");
    try {
      const { data } = await authClient.post("/admin-chat/", { content });
      setMessages((existing) => {
        if (existing.some((message) => message.id === data.message.id)) return existing;
        return [...existing, data.message];
      });
      if (data.message.created_at > latestMessageAtRef.current) {
        latestMessageAtRef.current = data.message.created_at;
      }
      setDraft("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to send your message."));
    } finally {
      setIsSending(false);
    }
  };

  const canSend = CAN_SEND_ROLES.has(currentUser.role);
  const closeChat = () => setIsOpen(false);
  const toggleChat = () => {
    if (!isOpen) {
      window.clearTimeout(closeTimerRef.current);
      setIsVisible(true);
    }
    setIsOpen((open) => !open);
  };

  return (
    <>
      <button
        type="button"
        className="nav-chat-btn"
        aria-label="Open Chat"
        title="Chat"
        aria-expanded={isOpen}
        onClick={toggleChat}
      >
        <MessageCircle size={17} aria-hidden="true" />
        <span>CHAT</span>
        {unreadCount > 0 && (
          <span className="nav-chat-unread" aria-label={`${unreadCount} unread messages`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isVisible && (
        <section
          className={`admin-chat-panel ${isOpen ? "is-open" : ""}`}
          data-theme={theme}
          aria-label="Chat"
          aria-hidden={!isOpen}
        >
          <header className="admin-chat-header">
            <div className="admin-chat-title-wrap">
              <span className="admin-chat-header-icon">
                <MessageCircle size={17} aria-hidden="true" />
              </span>
              <div>
                <h2>Chat</h2>
              </div>
            </div>
            <button
              type="button"
              className="admin-chat-close"
              aria-label="Close Chat"
              onClick={closeChat}
            >
              <X size={18} />
            </button>
          </header>

          <div className="admin-chat-messages" aria-live="polite">
            {messages.length === 0 && !errorMessage && (
              <div className="admin-chat-empty">
                <span className="admin-chat-empty-icon">
                  <MessageCircle size={20} />
                </span>
                <strong>Start a conversation</strong>
                <span>Messages in this conversation are visible to your team.</span>
              </div>
            )}
            {messages.map((message) => {
              const isOwnMessage = message.sender.id === currentUser.id;
              const senderInitial = message.sender.name?.trim()?.[0]?.toUpperCase() || "T";
              return (
                <article
                  className={`admin-chat-message ${isOwnMessage ? "own-message" : ""}`}
                  key={message.id}
                >
                  {!isOwnMessage && (
                    message.sender.photo ? (
                      <img
                        className="admin-chat-avatar"
                        src={message.sender.photo}
                        alt=""
                      />
                    ) : (
                      <span className="admin-chat-avatar avatar-fallback">{senderInitial}</span>
                    )
                  )}
                  <div className="admin-chat-message-body">
                    <span className="admin-chat-sender">{message.sender.name}</span>
                    <div className="admin-chat-bubble">{message.content}</div>
                    <time
                      className="admin-chat-timestamp"
                      dateTime={message.created_at}
                    >
                      {new Date(message.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  {isOwnMessage && (
                    (message.sender.photo || currentUser.photo) ? (
                      <img
                        className="admin-chat-avatar"
                        src={message.sender.photo || currentUser.photo}
                        alt=""
                      />
                    ) : (
                      <span className="admin-chat-avatar avatar-fallback">{senderInitial}</span>
                    )
                  )}
                </article>
              );
            })}
            {errorMessage && <p className="admin-chat-error" role="alert">{errorMessage}</p>}
            <div ref={messagesEndRef} />
          </div>

          {canSend ? (
            <form className="admin-chat-composer" onSubmit={handleSend}>
              <textarea
                aria-label="Message"
                placeholder="Write a message..."
                value={draft}
                maxLength={2000}
                rows={1}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                aria-label="Send message"
                title="Send message"
                disabled={!draft.trim() || isSending}
              >
                <Send size={17} />
              </button>
            </form>
          ) : (
            <div className="admin-chat-readonly" role="status">View only</div>
          )}
        </section>
      )}
    </>
  );
};

export default AdminChat;
