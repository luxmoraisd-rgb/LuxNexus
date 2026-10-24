import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";

import Navbar from "./Components/NavBar/Navbar/navbar";
import { authClient } from "./Components/Auth/authApi";
import MainSidebar from "./Components/SideBar/MainSideBar/Mainsidebar/mainsidebar";
import TrackerSidebar from "./Components/SideBar/MainSideBar/Tracker/trackersidebar";
import KnowledgeSidebar from "./Components/SideBar/MainSideBar/Knowledge/knowledgesidebar";
import PeopleSidebar from "./Components/SideBar/MainSideBar/People/peoplesidebar";
import SubSidebar from "./Components/SideBar/MainSideBar/Work/worksidebar";
import Dashboard from "./Components/SideBar/SubSideBar/HomePage/DashBoard/dashboard";
import Inbox from "./Components/SideBar/SubSideBar/Inbox/inbox";
import { SprintOverviewPage } from "./Components/SideBar/SubSideBar/MyTasks/TaskHeader/SprintOverview/sprintoverview";
import "./App.css";

const Reporting = lazy(() => import("./Components/SideBar/SubSideBar/Reporting/reporting"));
const Resourcing = lazy(() => import("./Components/SideBar/SubSideBar/Resourcing/resourcing"));
const Backlog = lazy(() => import("./Components/SideBar/SubSideBar/MyTasks/Backlog/Backlog"));
const MyTasksScreen = lazy(() => import("./Components/SideBar/SubSideBar/MyTasks/MyTasksScreen"));
const Projects = lazy(() => import("./Components/SideBar/SubSideBar/Projects/projects"));
const Portfolios = lazy(() => import("./Components/SideBar/SubSideBar/Portfolios/Portfolios"));
const MeetingsPage = lazy(() => import("./Components/SideBar/SubSideBar/Knowledge/MeetingsPage"));
const ProfilePage = lazy(() => import("./Components/NavBar/Profile/profilepage"));
const Signin = lazy(() => import("./Components/Auth/SignIn/signin"));
const Signup = lazy(() => import("./Components/Auth/SignUp/signup"));
const ForgotPassword = lazy(() => import("./Components/Auth/ForgotPass/forgotpassword"));
const AcceptInvite = lazy(() => import("./Components/Auth/AcceptInvite"));
const AllSprintsPage = lazy(() => import("./Components/SideBar/SubSideBar/MyTasks/AllSprints/AllSprintsPage"));
const GoalsPage = lazy(() => import("./Components/SideBar/SubSideBar/Goals/GoalsPage"));
import PeoplePage from "./Components/SideBar/SubSideBar/People/people";

const FULL_OPEN_PERMISSIONS = Object.freeze({
  view_tasks: true,
  manage_tasks: true,
  update_assigned_tasks: true,
  manage_sprints: true,
  manage_team: true,
  manage_board: true,
  view_reports: true,
});

const preloadMyTasks = () => {
  import("./Components/SideBar/SubSideBar/MyTasks/MyTasksScreen");
  import("./Components/SideBar/SubSideBar/MyTasks/Backlog/Backlog");
};

const PeopleRouteWrapper = ({ theme, currentUser, onTabChange }) => {
  const { subTab } = useParams();
  const validTab =
    subTab === "teams" || subTab === "invitations"
      ? subTab
      : "members";
  return (
    <PeoplePage
      theme={theme}
      currentUser={currentUser}
      activeTab={validTab}
      onTabChange={onTabChange}
    />
  );
};

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem("nexus-theme");
      if (saved === "dark") return "dark";
      if (saved === "light") return "light";
    } catch (error) {
      console.warn("Unable to read the saved theme preference.", error);
    }
    return "dark";
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token || token === "nexus-guest-token" || token.includes("demo-token")) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        return null;
      }
      const storedUser = sessionStorage.getItem("user");
      if (!storedUser) return null;
      const parsed = JSON.parse(storedUser);
      if (parsed?.email === "guest@nexusapp.io") {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn("Unable to restore the signed-in user.", error);
      return null;
    }
  });

  useEffect(() => {
    // Preload MyTasksScreen in background so navigation is instant
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(preloadMyTasks);
    } else {
      const timer = setTimeout(preloadMyTasks, 400);
      return () => clearTimeout(timer);
    }
  }, []);

  const isAuthenticated = Boolean(
    currentUser &&
    sessionStorage.getItem("token") &&
    sessionStorage.getItem("token") !== "nexus-guest-token" &&
    !sessionStorage.getItem("token").includes("demo-token")
  );

  useEffect(() => {
    try {
      window.localStorage.setItem("nexus-theme", theme);
    } catch (error) {
      console.warn("Unable to save the theme preference.", error);
    }
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [activeItem, setActiveItem] = useState("work");
  const [activeSubItem, setActiveSubItem] = useState("home");
  const [trackerView, setTrackerView] = useState("Goals");
  const [peopleTab, setPeopleTab] = useState("members");

  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname.toLowerCase();
      if (p.startsWith("/profile")) return "profile";
      if (p.startsWith("/settings")) return "settings";
      const saved = sessionStorage.getItem("current_view");
      if (saved === "profile" || saved === "settings") return saved;
    }
    return "dashboard";
  });
  const [profileTab, setProfileTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname.toLowerCase();
      if (p.includes("/session")) return "session";
      if (p.includes("/password")) return "password";
      if (p.includes("/language")) return "language";
      if (p.includes("/notifications")) return "notifications";
      if (p.includes("/basic") || p === "/settings") return "basic";
      if (p === "/profile" || p.includes("/personal")) return "personal";
      const saved = sessionStorage.getItem("profile_tab");
      if (saved) return saved;
    }
    return "personal";
  });
  const [profileName, setProfileName] = useState(() => {
    try {
      const stored = sessionStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.name || parsed?.username || "";
      }
    } catch (error) {
      console.warn("Unable to restore the profile name.", error);
    }
    return "";
  });
  const [profilePhoto, setProfilePhoto] = useState("");
  const [rolePermissions, setRolePermissions] = useState(FULL_OPEN_PERMISSIONS);
  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role;

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let isCurrent = true;
    const loadRolePermissions = () => {
      authClient.get("/permissions/")
        .then(({ data }) => {
          if (isCurrent) {
            // Role-based restrictions removed: open full capabilities across the web app
            const allKeys = (data.permissions || []).map(({ key }) => key);
            const openPermissions = allKeys.length > 0
              ? Object.fromEntries(allKeys.map((key) => [key, true]))
              : FULL_OPEN_PERMISSIONS;
            setRolePermissions(openPermissions);

            if (data.current_role) {
              setCurrentUser((user) => user ? { ...user, role: data.current_role } : user);
            }
          }
        })
        .catch((error) => {
          console.warn("[Permissions] Unable to load the current role policy.", error);
          setRolePermissions(FULL_OPEN_PERMISSIONS);
        });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadRolePermissions();
    };
    loadRolePermissions();
    window.addEventListener("focus", loadRolePermissions);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      isCurrent = false;
      window.removeEventListener("focus", loadRolePermissions);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isAuthenticated, currentUserId, currentUserRole]);

  const isAuthRoute =
    location.pathname === "/signin" ||
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/accept-invite";

  
  useEffect(() => {
    if (!isAuthenticated && !isAuthRoute) {
      navigate("/signin", { replace: true });
    } else if (isAuthenticated && (location.pathname === "/signin" || location.pathname === "/login")) {
      navigate("/home", { replace: true });
    }
  }, [isAuthenticated, isAuthRoute, location.pathname, navigate]);

  useEffect(() => {
    if (location.pathname.startsWith("/profile")) {
      setCurrentView("profile");
      sessionStorage.setItem("current_view", "profile");
      const parts = location.pathname.split("/").filter(Boolean);
      const sub = parts[1];
      if (sub && ["personal", "basic", "notifications", "language", "password", "session"].includes(sub)) {
        setProfileTab(sub);
        sessionStorage.setItem("profile_tab", sub);
      }
    } else if (location.pathname.startsWith("/settings")) {
      setCurrentView("settings");
      sessionStorage.setItem("current_view", "settings");
      const parts = location.pathname.split("/").filter(Boolean);
      const sub = parts[1];
      if (sub && ["personal", "basic", "notifications", "language", "password", "session"].includes(sub)) {
        setProfileTab(sub);
        sessionStorage.setItem("profile_tab", sub);
      } else {
        setProfileTab("basic");
        sessionStorage.setItem("profile_tab", "basic");
      }
    } else if (location.pathname === "/" || location.pathname === "/home") {
      const savedView = sessionStorage.getItem("current_view");
      if (savedView === "profile" || savedView === "settings") {
        setCurrentView(savedView);
        const savedTab = sessionStorage.getItem("profile_tab") || (savedView === "settings" ? "basic" : "personal");
        setProfileTab(savedTab);
      } else {
        setCurrentView("dashboard");
        setActiveItem("work");
        setActiveSubItem("home");
      }
    } else {
      setCurrentView("dashboard");
      sessionStorage.removeItem("current_view");
      sessionStorage.removeItem("profile_tab");
    }
  }, [location.pathname]);



  const isTasksRoute = location.pathname === "/work/tasks" || location.pathname === "/tasks";
  const isBacklogRoute = location.pathname === "/work/backlog" || location.pathname === "/backlog";
  const isActiveSprintRoute = location.pathname === "/work/active-sprint" || location.pathname === "/active-sprint";
  const isAllSprintsRoute = location.pathname === "/work/all-sprints" || location.pathname === "/all-sprints";
  const isSprintOverviewRoute = location.pathname === "/sprint-overview";
  const isInboxRoute = location.pathname === "/work/inbox" || location.pathname === "/inbox";
  const isProjectsRoute = location.pathname === "/work/projects" || location.pathname === "/projects";
  const isPortfoliosRoute = location.pathname === "/work/portfolios" || location.pathname === "/portfolios";
  const isGoalsRoute = location.pathname === "/strategy/goals" || location.pathname === "/goals";
  const isStrategyMapRoute = location.pathname === "/strategy/strategy-map" || location.pathname === "/strategy-map";
  const isTeamGoalsRoute = location.pathname === "/strategy/team-goals" || location.pathname === "/team-goals";
  const isReportingRoute = location.pathname === "/strategy/reporting" || location.pathname === "/reporting";
  const isResourcingRoute = location.pathname === "/strategy/resourcing" || location.pathname === "/resourcing";
  const isPeopleRoute = location.pathname.startsWith("/people");
  const isKnowledgeRoute = location.pathname === "/knowledge" || location.pathname === "/meetings";

  const isWorkSubRoute = isTasksRoute || isBacklogRoute || isActiveSprintRoute || isAllSprintsRoute || isSprintOverviewRoute || isInboxRoute || isProjectsRoute || isPortfoliosRoute;
  const isStrategySubRoute = isGoalsRoute || isStrategyMapRoute || isTeamGoalsRoute || isReportingRoute || isResourcingRoute;
  const selectedActiveItem = isWorkSubRoute ? "work" : isStrategySubRoute ? "strategy" : isPeopleRoute ? "people" : isKnowledgeRoute ? "knowledge" : activeItem;
  const selectedActiveSubItem = isInboxRoute
    ? "inbox"
    : isProjectsRoute
      ? "projects"
      : isPortfoliosRoute
        ? "portfolios"
        : isActiveSprintRoute
          ? "active-sprint"
          : isAllSprintsRoute
            ? "all-sprints"
            : isBacklogRoute
              ? "backlog"
              : isTasksRoute || isSprintOverviewRoute
                ? "tasks"
                : activeSubItem;

  const handleMainItemSelect = (item) => {
    setActiveItem(item);
    if (item === "work") {
      // Determine target work route based on current state or activeSubItem
      const targetSub = activeSubItem || "home";
      if (targetSub === "projects" || isProjectsRoute) {
        navigate("/work/projects");
      } else if (targetSub === "portfolios" || isPortfoliosRoute) {
        navigate("/work/portfolios");
      } else if (targetSub === "tasks" || isTasksRoute) {
        navigate("/work/tasks");
      } else if (targetSub === "backlog" || isBacklogRoute) {
        navigate("/work/backlog");
      } else if (targetSub === "active-sprint" || isActiveSprintRoute) {
        navigate("/work/active-sprint");
      } else if (targetSub === "all-sprints" || isAllSprintsRoute) {
        navigate("/work/all-sprints");
      } else if (targetSub === "inbox" || isInboxRoute) {
        navigate("/work/inbox");
      } else {
        setActiveSubItem("home");
        navigate("/");
      }
    } else if (item === "strategy") {
      // Determine target strategy route based on current state or trackerView
      if (trackerView === "Reporting" || isReportingRoute) {
        navigate("/strategy/reporting");
      } else if (trackerView === "Resourcing" || isResourcingRoute) {
        navigate("/strategy/resourcing");
      } else {
        setTrackerView("Goals");
        navigate("/strategy/goals");
      }
    } else if (item === "people") {
      setActiveItem("people");
      if (peopleTab === "teams") {
        navigate("/people/teams");
      } else if (peopleTab === "invitations") {
        navigate("/people/invitations");
      } else if (peopleTab === "workspace") {
        navigate("/people/workspace");
      } else {
        navigate("/people");
      }
    } else if (item === "knowledge") {
      setActiveItem("knowledge");
      navigate("/knowledge");
    } else {
      navigate("/");
    }
  };

  const handleHomeClick = () => {
    setCurrentView("dashboard");
    sessionStorage.removeItem("current_view");
    sessionStorage.removeItem("profile_tab");
    setActiveItem("work");
    setActiveSubItem("home");
    navigate("/home");
  };

  const handleSubItemSelect = (item) => {
    setActiveSubItem(item);
    if (item === "tasks") {
      navigate("/work/tasks");
      return;
    }
    if (item === "backlog") {
      navigate("/work/backlog");
      return;
    }
    if (item === "active-sprint") {
      navigate("/work/active-sprint");
      return;
    }
    if (item === "all-sprints") {
      navigate("/work/all-sprints");
      return;
    }
    if (item === "inbox") {
      navigate("/work/inbox");
      return;
    }
    if (item === "projects") {
      navigate("/work/projects");
      return;
    }
    if (item === "portfolios") {
      navigate("/work/portfolios");
      return;
    }
    navigate("/home");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("session_ip");
    sessionStorage.removeItem("session_login_time");
    sessionStorage.removeItem("current_view");
    sessionStorage.removeItem("profile_tab");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    setRolePermissions(null);
    setProfileName("");
    setCurrentView("dashboard");
    setActiveItem("work");
    setActiveSubItem("home");
    navigate("/signin");
  };

  const handleSelectSuggestion = (suggestion) => {
    setCurrentView("dashboard");
    sessionStorage.removeItem("current_view");
    sessionStorage.removeItem("profile_tab");
    const s = (suggestion || "").toLowerCase();
    if (s.includes("task")) {
      setActiveItem("work");
      setActiveSubItem("tasks");
      navigate("/work/tasks");
    } else if (s.includes("backlog")) {
      setActiveItem("work");
      setActiveSubItem("backlog");
      navigate("/work/backlog");
    } else if (s.includes("inbox")) {
      setActiveItem("work");
      setActiveSubItem("inbox");
      navigate("/work/inbox");
    } else if (s.includes("reporting")) {
      setActiveItem("strategy");
      setTrackerView("Reporting");
      navigate("/strategy/reporting");
    } else if (s.includes("resourcing")) {
      setActiveItem("strategy");
      setTrackerView("Resourcing");
      navigate("/strategy/resourcing");
    } else if (s.includes("goal")) {
      setActiveItem("strategy");
      setTrackerView("Goals");
      navigate("/strategy/goals");
    } else if (s.includes("project")) {
      setActiveItem("work");
      setActiveSubItem("projects");
      navigate("/work/projects");
    } else if (s.includes("portfolio")) {
      setActiveItem("work");
      setActiveSubItem("portfolios");
      navigate("/work/portfolios");
    } else if (s.includes("people") || s.includes("member") || s.includes("team")) {
      setActiveItem("people");
      navigate("/people");
    } else {
      setActiveItem("work");
      setActiveSubItem("home");
      navigate("/home");
    }
  };

  const handleCreateClick = () => {
    setCurrentView("dashboard");
    sessionStorage.removeItem("current_view");
    sessionStorage.removeItem("profile_tab");
    setActiveItem("work");
    setActiveSubItem("tasks");
    navigate("/work/tasks");
  };

  const handleLoginSuccess = (data) => {
    const user = data?.user || data?.data?.user || {
      name: data?.name || data?.email?.split("@")[0] || "User",
      email: data?.email,
    };
    const name = user?.name || user?.username || user?.email || "User";
    sessionStorage.setItem("user", JSON.stringify(user));
    if (data?.token || data?.jwt || data?.accessToken) {
      sessionStorage.setItem("token", data.token || data.jwt || data.accessToken);
    }
    if (data?.ip) {
      sessionStorage.setItem("session_ip", data.ip);
    }
    sessionStorage.setItem("session_login_time", new Date().toISOString());
    sessionStorage.removeItem("current_view");
    sessionStorage.removeItem("profile_tab");
    setCurrentUser(user);
    setProfileName(name);
    setCurrentView("dashboard");
    setActiveItem("work");
    setActiveSubItem("home");
    const invitationToken = new URLSearchParams(location.search).get("invite");
    if (invitationToken) {
      navigate(`/accept-invite?token=${encodeURIComponent(invitationToken)}`);
    } else {
      navigate("/home");
    }
  };


  const handleSignupSuccess = (data) => {
    if (data?.invitation_accepted && data?.token && data?.user) {
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));
      setCurrentUser(data.user);
      setProfileName(data.user.name || data.user.username || data.user.email || "User");
      navigate("/");
      return;
    }
    // Clear any active session so the user must sign in explicitly
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");
    setCurrentUser(null);
    const registeredEmail = data?.email || data?.user?.email || "";
    navigate("/signin", {
      state: {
        email: registeredEmail,
        message: "Account created successfully! Please sign in with your credentials.",
      },
    });
  };

  const handleInvitationAccepted = (user) => {
    sessionStorage.setItem("user", JSON.stringify(user));
    setCurrentUser(user);
    setProfileName(user.name || user.username || user.email || "User");
    navigate("/");
  };

  if (isAuthRoute) {
    return (
      <div className="app" data-theme={theme}>
        <Routes>
          <Route
            path="/signin"
            element={
              <Suspense fallback={null}>
                <Signin
                  onNavigateToSignup={() => {
                    const invitationToken = new URLSearchParams(location.search).get("invite");
                    navigate(invitationToken ? `/signup?invite=${encodeURIComponent(invitationToken)}` : "/signup");
                  }}
                  onNavigateToForgotPassword={() => navigate("/forgot-password")}
                  onLoginSuccess={handleLoginSuccess}
                  theme={theme}
                  onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                />
              </Suspense>
            }
          />
          <Route
            path="/login"
            element={
              <Suspense fallback={null}>
                <Signin
                  onNavigateToSignup={() => {
                    const invitationToken = new URLSearchParams(location.search).get("invite");
                    navigate(invitationToken ? `/signup?invite=${encodeURIComponent(invitationToken)}` : "/signup");
                  }}
                  onNavigateToForgotPassword={() => navigate("/forgot-password")}
                  onLoginSuccess={handleLoginSuccess}
                  theme={theme}
                  onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                />
              </Suspense>
            }
          />
          <Route
            path="/signup"
            element={
              <Suspense fallback={null}>
                <Signup
                  onNavigateToSignin={() => {
                    const invitationToken = new URLSearchParams(location.search).get("invite");
                    navigate(invitationToken ? `/signin?invite=${encodeURIComponent(invitationToken)}` : "/signin");
                  }}
                  onSignupSuccess={handleSignupSuccess}
                  theme={theme}
                  onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                />
              </Suspense>
            }
          />
          <Route
            path="/accept-invite"
            element={
              <Suspense fallback={null}>
                <AcceptInvite
                  isAuthenticated={isAuthenticated}
                  onInvitationAccepted={handleInvitationAccepted}
                  theme={theme}
                  onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                />
              </Suspense>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Suspense fallback={null}>
                <ForgotPassword
                  onNavigateToSignin={(authData) =>
                    navigate("/signin", authData ? { state: authData } : undefined)
                  }
                  theme={theme}
                  onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                />
              </Suspense>
            }
          />
        </Routes>
      </div>
    );
  }


  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="app" data-theme={theme}>

      {/* TOP NAVBAR */}
      <Navbar
        profileName={profileName}
        profilePhoto={profilePhoto}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        canManageTeam={true}
        canInviteElevatedRoles={true}
        theme={theme}
        onThemeChange={setTheme}
        onHomeClick={handleHomeClick}
        onMenuClick={() =>
          setSidebarOpen(!sidebarOpen)
        }
        onProfileClick={() => {
          setProfileTab("personal");
          setCurrentView("profile");
          sessionStorage.setItem("current_view", "profile");
          sessionStorage.setItem("profile_tab", "personal");
          navigate("/profile/personal");
        }}
        onSettingsClick={() => {
          setProfileTab("basic");
          setCurrentView("settings");
          sessionStorage.setItem("current_view", "settings");
          sessionStorage.setItem("profile_tab", "basic");
          navigate("/settings/basic");
        }}
        onSignInClick={() => navigate("/signin")}
        onSignUpClick={() => navigate("/signup")}
        onSignOutClick={handleLogout}
        onSelectSuggestion={handleSelectSuggestion}
        onPermissionsUpdated={() => {
          setRolePermissions(FULL_OPEN_PERMISSIONS);
        }}
        onCreateClick={handleCreateClick}
      />

      {currentView === "profile" || currentView === "settings" ? (
        <Suspense fallback={null}>
          <ProfilePage
            onBack={() => {
              setCurrentView("dashboard");
              sessionStorage.removeItem("current_view");
              sessionStorage.removeItem("profile_tab");
              setActiveItem("work");
              setActiveSubItem("home");
              navigate("/home");
            }}
            activeTab={profileTab}
            setActiveTab={(tab) => {
              setProfileTab(tab);
              sessionStorage.setItem("profile_tab", tab);
              const base = currentView === "settings" ? "/settings" : "/profile";
              navigate(`${base}/${tab}`);
            }}
            profileName={profileName}
            onProfileNameChange={setProfileName}
            profilePhoto={profilePhoto}
            onProfilePhotoChange={setProfilePhoto}
            theme={theme}
            onThemeChange={setTheme}
            onLogout={handleLogout}
            currentUser={currentUser}
          />
        </Suspense>
      ) : (
        <div className="app-body">

          {/* MAIN SIDEBAR */}
          <div
            className={`sidebar-wrapper ${
              sidebarOpen ? "open" : "closed"
            }`}
          >
            <MainSidebar
              activeItem={selectedActiveItem}
              setActiveItem={handleMainItemSelect}
            />
          </div>

          {/* SUB SIDEBAR */}
          {selectedActiveItem === "work" && (
            <div
              className={`sub-wrapper ${
                sidebarOpen ? "open" : "closed"
              }`}
            >
              <SubSidebar
                activeMenu={selectedActiveSubItem}
                onMenuSelect={handleSubItemSelect}
              />
            </div>
          )}

          {selectedActiveItem === "strategy" && (
            <div
              className={`sub-wrapper ${
                sidebarOpen ? "open" : "closed"
              }`}
            >
              <TrackerSidebar
                selectedItem={
                  isReportingRoute
                    ? "Reporting"
                    : isResourcingRoute
                      ? "Resourcing"
                      : isGoalsRoute || isStrategyMapRoute || isTeamGoalsRoute
                        ? "Goals"
                        : trackerView
                }
                onSelectionChange={(item) => {
                  if (item === "Goals") {
                    setTrackerView("Goals");
                    navigate("/strategy/goals");
                  } else if (item === "Strategy map") {
                    setTrackerView("Strategy map");
                    navigate("/strategy/strategy-map");
                  } else if (item === "Team goals") {
                    setTrackerView("Team goals");
                    navigate("/strategy/team-goals");
                  } else if (item === "Reporting") {
                    setTrackerView("Reporting");
                    navigate("/strategy/reporting");
                  } else if (item === "Resourcing") {
                    setTrackerView("Resourcing");
                    navigate("/strategy/resourcing");
                  } else {
                    setTrackerView("Reporting");
                    navigate("/strategy/reporting");
                  }
                }}
              />
            </div>
          )}

          {selectedActiveItem === "knowledge" && (
            <div
              className={`sub-wrapper ${
                sidebarOpen ? "open" : "closed"
              }`}
            >
              <KnowledgeSidebar />
            </div>
          )}

          {selectedActiveItem === "people" && (
            <div
              className={`sub-wrapper ${
                sidebarOpen ? "open" : "closed"
              }`}
            >
              <PeopleSidebar
                activeItem={
                  location.pathname === "/people/teams"
                    ? "Teams"
                    : location.pathname === "/people/invitations"
                      ? "Invitations"
                      : peopleTab === "teams"
                        ? "Teams"
                        : peopleTab === "invitations"
                          ? "Invitations"
                          : "Members"
                }
                onNavigate={(item) => {
                  if (item === "Teams") {
                    setPeopleTab("teams");
                    navigate("/people/teams");
                  } else if (item === "Invitations") {
                    setPeopleTab("invitations");
                    navigate("/people/invitations");
                  } else {
                    setPeopleTab("members");
                    navigate("/people");
                  }
                }}
              />
            </div>
          )}

          {/* MAIN CONTENT */}
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard profileName={profileName} currentUser={currentUser} />} />
              <Route path="/home" element={<Dashboard profileName={profileName} currentUser={currentUser} />} />
              <Route path="/work/tasks" element={<Suspense fallback={<div className="backlog-skeleton-wrapper" style={{ padding: 24 }}><div className="backlog-skeleton-card"><div className="backlog-skeleton-header" /><div className="backlog-skeleton-row" /><div className="backlog-skeleton-row" /></div></div>}><MyTasksScreen rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/tasks" element={<Suspense fallback={<div className="backlog-skeleton-wrapper" style={{ padding: 24 }}><div className="backlog-skeleton-card"><div className="backlog-skeleton-header" /><div className="backlog-skeleton-row" /><div className="backlog-skeleton-row" /></div></div>}><MyTasksScreen rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/work/backlog" element={<Suspense fallback={null}><Backlog defaultTab="Backlog" rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/backlog" element={<Suspense fallback={null}><Backlog defaultTab="Backlog" rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/work/active-sprint" element={<Suspense fallback={null}><Backlog defaultTab="Active Sprint" rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/active-sprint" element={<Suspense fallback={null}><Backlog defaultTab="Active Sprint" rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/work/all-sprints" element={<Suspense fallback={null}><Backlog defaultTab="All Sprints" rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/all-sprints" element={<Suspense fallback={null}><Backlog defaultTab="All Sprints" rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/sprint-overview" element={<SprintOverviewPage />} />
              <Route path="/work/inbox" element={<Inbox theme={theme} />} />
              <Route path="/inbox" element={<Inbox theme={theme} />} />
              <Route path="/work/projects" element={<Suspense fallback={<main role="status">Loading Projects...</main>}><Projects rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/projects" element={<Suspense fallback={<main role="status">Loading Projects...</main>}><Projects rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>} />
              <Route path="/work/portfolios" element={<Suspense fallback={<main role="status">Loading Portfolios...</main>}><Portfolios currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>} />
              <Route path="/portfolios" element={<Suspense fallback={<main role="status">Loading Portfolios...</main>}><Portfolios currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>} />
              <Route path="/strategy/goals" element={<Suspense fallback={<main role="status">Loading Goals...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="My goals" /></Suspense>} />
              <Route path="/goals" element={<Suspense fallback={<main role="status">Loading Goals...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="My goals" /></Suspense>} />
              <Route path="/strategy/strategy-map" element={<Suspense fallback={<main role="status">Loading Strategy Map...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="Strategy map" /></Suspense>} />
              <Route path="/strategy-map" element={<Suspense fallback={<main role="status">Loading Strategy Map...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="Strategy map" /></Suspense>} />
              <Route path="/strategy/team-goals" element={<Suspense fallback={<main role="status">Loading Team Goals...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="Team goals" /></Suspense>} />
              <Route path="/team-goals" element={<Suspense fallback={<main role="status">Loading Team Goals...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="Team goals" /></Suspense>} />
              <Route path="/strategy/reporting" element={<Suspense fallback={<main role="status">Loading Reporting...</main>}><Reporting currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>} />
              <Route path="/reporting" element={<Suspense fallback={<main role="status">Loading Reporting...</main>}><Reporting currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>} />
              <Route path="/strategy/resourcing" element={<Suspense fallback={<main role="status">Loading Resourcing...</main>}><Resourcing currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>} />
              <Route path="/resourcing" element={<Suspense fallback={<main role="status">Loading Resourcing...</main>}><Resourcing currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>} />
              <Route
                path="/people"
                element={
                  <PeoplePage
                    theme={theme}
                    currentUser={currentUser}
                    activeTab="members"
                    onTabChange={(tab) => {
                      setPeopleTab(tab);
                      navigate(tab === "members" ? "/people" : `/people/${tab}`);
                    }}
                  />
                }
              />
              <Route
                path="/people/:subTab"
                element={
                  <PeopleRouteWrapper
                    theme={theme}
                    currentUser={currentUser}
                    onTabChange={(tab) => {
                      setPeopleTab(tab);
                      navigate(tab === "members" ? "/people" : `/people/${tab}`);
                    }}
                  />
                }
              />
              <Route path="/knowledge" element={<Suspense fallback={<main role="status">Loading Knowledge...</main>}><MeetingsPage currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>} />
              <Route path="/meetings" element={<Suspense fallback={<main role="status">Loading Meetings...</main>}><MeetingsPage currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>} />
              <Route
                path="*"
                element={activeItem === "work" && activeSubItem === "inbox" ? (
                  <Inbox theme={theme} />
                ) : activeItem === "work" && activeSubItem === "projects" ? (
                  <Suspense fallback={null}><Projects rolePermissions={rolePermissions} currentUser={currentUser} /></Suspense>
                ) : activeItem === "work" && activeSubItem === "portfolios" ? (
                  <Suspense fallback={null}><Portfolios currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>
                ) : activeItem === "strategy" && (trackerView === "Strategy map" || isStrategyMapRoute) ? (
                  <Suspense fallback={<main role="status">Loading Strategy Map...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="Strategy map" /></Suspense>
                ) : activeItem === "strategy" && (trackerView === "Team goals" || isTeamGoalsRoute) ? (
                  <Suspense fallback={<main role="status">Loading Team Goals...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="Team goals" /></Suspense>
                ) : activeItem === "strategy" && trackerView === "Goals" ? (
                  <Suspense fallback={<main role="status">Loading Goals...</main>}><GoalsPage currentUser={currentUser} rolePermissions={rolePermissions} initialTab="My goals" /></Suspense>
                ) : activeItem === "strategy" && trackerView === "Reporting" ? (
                  <Suspense fallback={<main role="status">Loading Reporting...</main>}><Reporting currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>
                ) : activeItem === "strategy" && trackerView === "Resourcing" ? (
                  <Suspense fallback={<main role="status">Loading Resourcing...</main>}><Resourcing currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>
                ) : selectedActiveItem === "people" ? (
                  <PeoplePage
                    theme={theme}
                    currentUser={currentUser}
                    activeTab={peopleTab}
                    onTabChange={(tab) => {
                      setPeopleTab(tab);
                      navigate(tab === "members" ? "/people" : `/people/${tab}`);
                    }}
                  />
                ) : selectedActiveItem === "knowledge" ? (
                  <Suspense fallback={<main role="status">Loading Knowledge...</main>}><MeetingsPage currentUser={currentUser} rolePermissions={rolePermissions} /></Suspense>
                ) : (
                  <Dashboard profileName={profileName} currentUser={currentUser} />
                )}
              />
            </Routes>
          </div>

        </div>
      )}

    </div>
  );
};


export default App;