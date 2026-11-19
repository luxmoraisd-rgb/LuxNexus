import { useState, useEffect } from "react";
import {
  Monitor,
  MapPin,
  Globe,
  Clock,
  CalendarDays,
} from "lucide-react";
import authApi from "../../../../Auth/authApi";
import "./sessionhistory.css";

/*
|--------------------------------------------------------------------------
| Client Detection Helpers
|--------------------------------------------------------------------------
*/

const parseClientDevice = () => {
  if (typeof navigator === "undefined") return "Windows Chrome";
  const ua = navigator.userAgent || "";
  let os = "Desktop";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";

  let browser = "Chrome";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";

  return `${os} ${browser}`;
};

const detectClientLocation = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      if (tz.includes("Kolkata") || tz.includes("Calcutta")) {
        return "Chennai, Tamil Nadu, IN";
      }
      const parts = tz.split("/");
      return parts.length > 1 ? `${parts[1].replace(/_/g, " ")}, ${parts[0]}` : tz;
    }
  } catch {
    // fallback
  }
  return "Chennai, Tamil Nadu, IN";
};

const getActiveTimezone = () => {
  return (
    localStorage.getItem("nexus_timezone") ||
    sessionStorage.getItem("nexus_timezone") ||
    "Asia/Kolkata"
  );
};

const formatSessionTime = (rawTimestamp, serverTime) => {
  const tz = getActiveTimezone();

  if (rawTimestamp) {
    try {
      const d = new Date(rawTimestamp);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(d);
      }
    } catch {
      // fallback
    }
  }

  if (serverTime && serverTime !== "Active now" && serverTime !== "Recent") {
    return serverTime;
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
};

const formatSessionDate = (rawTimestamp, serverDate) => {
  const tz = getActiveTimezone();

  if (rawTimestamp) {
    try {
      const d = new Date(rawTimestamp);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat("en-GB", {
          timeZone: tz,
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(d);
      }
    } catch {
      // fallback
    }
  }

  if (serverDate) {
    return serverDate;
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Compound Component Root
|--------------------------------------------------------------------------
*/

const SessionHistory = ({ children }) => {
  return (
    <main className="session-history">
      {children}
    </main>
  );
};

/*
|--------------------------------------------------------------------------
| Header
|--------------------------------------------------------------------------
*/

SessionHistory.Header = ({ title }) => {
  return (
    <header className="session-history__header">
      <h1>{title}</h1>
    </header>
  );
};

/*
|--------------------------------------------------------------------------
| Session Count
|--------------------------------------------------------------------------
*/

SessionHistory.Count = ({ count, limit }) => {
  return (
    <div>
      <div className="session-history__count">
        {count} {count === 1 ? "Session" : "Sessions"} (maximum {limit})
      </div>
      <p className="session-history__retention">
        Up to {limit} recent sessions are retained. If the oldest session is
        still active when this limit is exceeded, it is automatically signed out.
      </p>
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| Table
|--------------------------------------------------------------------------
*/

SessionHistory.Table = ({ children }) => {
  return (
    <div className="session-table-wrapper">
      <table className="session-table">
        {children}
      </table>
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| Table Header
|--------------------------------------------------------------------------
*/

SessionHistory.TableHeader = () => {
  return (
    <thead>
      <tr>
        <th>Device</th>
        <th>Location</th>
        <th>IP</th>
        <th>Last usage</th>
        <th>Time</th>
        <th aria-label="Actions"></th>
      </tr>
    </thead>
  );
};

/*
|--------------------------------------------------------------------------
| Session Row
|--------------------------------------------------------------------------
*/

SessionHistory.Row = ({ session, onLogout }) => {
  return (
    <tbody>
      <tr>
        {/* Device */}
        <td data-label="Device">
          <div className="session-device">
            <Monitor size={17} />
            <span>{session.device}</span>
          </div>
        </td>

        {/* Location */}
        <td data-label="Location">
          <span className="session-location">
            {session.location}
          </span>
        </td>

        {/* IP */}
        <td data-label="IP">
          <span className="session-ip">
            {session.ip}
          </span>
        </td>

        {/* Last Usage */}
        <td data-label="Last usage">
          <span>{session.lastUsage}</span>
        </td>

        {/* Time */}
        <td data-label="Time">
          <div className="session-time-cell">
            <span className="session-time-value">{session.time}</span>
            {session.isCurrent ? (
              <span className="session-active-badge">
                <span className="session-pulse-dot" />
                Active now
              </span>
            ) : session.isActive ? (
              <span className="session-active-badge">Active</span>
            ) : (
              <span className="session-ended-badge">Ended</span>
            )}
          </div>
        </td>

        {/* Action */}
        <td className="session-action">
          {session.isActive ? (
            <button
              className="logout-button"
              onClick={() => onLogout(session)}
              type="button"
            >
              Log out
            </button>
          ) : (
            <span className="session-ended-label">Ended</span>
          )}
        </td>
      </tr>
    </tbody>
  );
};

/*
|--------------------------------------------------------------------------
| Mobile Session Card
|--------------------------------------------------------------------------
*/

SessionHistory.MobileCard = ({
  session,
  onLogout,
}) => {
  return (
    <article className="session-mobile-card">
      <div className="mobile-session-header">
        <div className="mobile-device">
          <Monitor size={19} />
          <strong>{session.device}</strong>
        </div>

        {session.isActive ? (
          <button
            className="logout-button"
            onClick={() => onLogout(session)}
            type="button"
          >
            Log out
          </button>
        ) : (
          <span className="session-ended-label">Ended</span>
        )}
      </div>

      <div className="mobile-session-details">
        <div className="mobile-detail">
          <MapPin size={16} />
          <div>
            <small>Location</small>
            <span>{session.location}</span>
          </div>
        </div>

        <div className="mobile-detail">
          <Globe size={16} />
          <div>
            <small>IP</small>
            <span>{session.ip}</span>
          </div>
        </div>

        <div className="mobile-detail">
          <CalendarDays size={16} />
          <div>
            <small>Last usage</small>
            <span>{session.lastUsage}</span>
          </div>
        </div>

        <div className="mobile-detail">
          <Clock size={16} />
          <div>
            <small>Time</small>
            <div className="session-time-cell">
              <span className="session-time-value">{session.time}</span>
              {session.isCurrent ? (
                <span className="session-active-badge">
                  <span className="session-pulse-dot" />
                  Active now
                </span>
              ) : session.isActive ? (
                <span className="session-active-badge">Active</span>
              ) : (
                <span className="session-ended-badge">Ended</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

/*
|--------------------------------------------------------------------------
| Empty State
|--------------------------------------------------------------------------
*/

SessionHistory.Empty = () => {
  return (
    <div className="session-empty">
      <div className="session-empty__icon">
        <Monitor size={30} />
      </div>

      <h2>No session history</h2>

      <p>
        Your recent sessions will appear here.
      </p>
    </div>
  );
};

/*
|--------------------------------------------------------------------------
| Main Page
|--------------------------------------------------------------------------
*/

const SessionHistoryPage = ({ onLogout }) => {
  const [sessions, setSessions] = useState([]);
  const [sessionLimit, setSessionLimit] = useState(5);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      const sessionIp = sessionStorage.getItem("session_ip");
      const clientDevice = parseClientDevice();
      const clientLocation = detectClientLocation();

      try {
        const res = await authApi.getSessions();
        if (isMounted && Array.isArray(res?.data)) {
          const configuredLimit = Number(res.headers?.["x-session-history-limit"]);
          if (Number.isInteger(configuredLimit) && configuredLimit > 0) {
            setSessionLimit(configuredLimit);
          }
          const list = res.data.map((item, idx) => {
            const isCurr = Boolean(item.isCurrent);
            const finalIp = item.ip || (isCurr ? sessionIp : null) || "127.0.0.1";

            const rawTimestamp = isCurr
              ? (item.lastUsedAt || sessionStorage.getItem("session_login_time") || new Date().toISOString())
              : (item.lastUsedAt || item.createdAt);

            return {
              id: item.id || idx + 1,
              device: item.device || clientDevice,
              location: item.location && item.location !== "Current Location" ? item.location : clientLocation,
              ip: finalIp,
              lastUsage: formatSessionDate(rawTimestamp, item.lastUsage),
              time: formatSessionTime(rawTimestamp, item.time),
              isActive: Boolean(item.isActive ?? item.status === "active"),
              isCurrent: isCurr,
            };
          });
          setSessions(list);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn("[SessionHistory] Could not fetch server sessions:", err);
      }

      if (isMounted) {
        const loginTime = sessionStorage.getItem("session_login_time") || new Date().toISOString();
        setSessions([
          {
            id: "current-session",
            device: clientDevice,
            location: clientLocation,
            ip: sessionIp || "127.0.0.1",
            lastUsage: formatSessionDate(loginTime),
            time: formatSessionTime(loginTime),
            isActive: true,
            isCurrent: true,
          },
        ]);
        setIsLoading(false);
      }
    };

    loadSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async (session) => {
    const confirmed = window.confirm(
      session.isCurrent
        ? "Are you sure you want to log out this session? This will log you out of your account."
        : "Are you sure you want to log out this session?"
    );

    if (!confirmed) {
      return;
    }

    if (!session.isCurrent) {
      try {
        await authApi.deleteSession(session.id);
        setSessions((previous) =>
          previous.map((entry) =>
            entry.id === session.id
              ? { ...entry, isActive: false, isCurrent: false }
              : entry
          )
        );
      } catch (err) {
        console.error("[SessionHistory] Could not terminate session:", err);
        window.alert("Could not terminate this session. Please try again.");
      }
      return;
    }

    try {
      await authApi.logout();
    } catch (err) {
      console.warn("[SessionHistory] Logout request error:", err);
    }

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("session_ip");
    sessionStorage.removeItem("session_login_time");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    if (typeof onLogout === "function") {
      onLogout();
    } else {
      window.location.assign("/signin");
    }
  };

  return (
    <SessionHistory>
      <SessionHistory.Header
        title="Session history"
      />

      <SessionHistory.Count
        count={sessions.length}
        limit={sessionLimit}
      />

      {!isLoading && sessions.length === 0 ? (
        <SessionHistory.Empty />
      ) : (
        <>
          {/* Desktop / Tablet table */}
          <div className="desktop-sessions">
            <SessionHistory.Table>
              <SessionHistory.TableHeader />
              {sessions.map((session) => (
                <SessionHistory.Row
                  key={session.id}
                  session={session}
                  onLogout={handleLogout}
                />
              ))}
            </SessionHistory.Table>
          </div>

          {/* Mobile cards */}
          <div className="mobile-sessions">
            {sessions.map((session) => (
              <SessionHistory.MobileCard
                key={session.id}
                session={session}
                onLogout={handleLogout}
              />
            ))}
          </div>
        </>
      )}
    </SessionHistory>
  );
};

export default SessionHistoryPage;