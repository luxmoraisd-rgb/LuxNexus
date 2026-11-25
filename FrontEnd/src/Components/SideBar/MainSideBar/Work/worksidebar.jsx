import {
  Home,
  Bell,
  CheckCircle,
  Briefcase,
  FolderKanban,
} from "lucide-react";
import SubSidebarAurora from "../../Common/SubSidebarAurora";
import "./worksidebar.css";

const SubSidebar = ({ activeMenu = "tasks", onMenuSelect }) => {
  const allSubMenu = [
    {
      id: "home",
      label: "Home",
      icon: <Home size={20} />,
    },

    {
      id: "inbox",
      label: "Inbox",
      icon: <Bell size={20} />,
    },

    {
      id: "tasks",
      label: "My tasks",
      icon: <CheckCircle size={20} />,
    },

    {
      id: "projects",
      label: "Projects",
      icon: <FolderKanban size={20} />,
    },

    {
      id: "portfolios",
      label: "Portfolios",
      icon: <Briefcase size={20} />,
    },
  ];
  const subMenu = allSubMenu;

  return (
    <aside className="sub-sidebar">
      {/* Section Title */}
      <div className="sub-title">
        <span>Work</span>
      </div>

      {/* Menu */}
      <nav className="sub-menu">
        {subMenu.map((item) => (
          <button
            key={item.id}
            className={`sub-menu-item ${activeMenu === item.id ? "selected" : ""
              }`}
            onClick={() => onMenuSelect(item.id)}
            onMouseEnter={() => {
              if (item.id === "tasks") {
                import("../../SubSideBar/MyTasks/MyTasksScreen");
                import("../../SubSideBar/MyTasks/Backlog/Backlog");
              }
              if (item.id === "projects") {
                import("../../SubSideBar/Projects/projects");
                import("../../SubSideBar/Projects/ProjectDetails");
              }
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <SubSidebarAurora />
    </aside>
  );
};

export default SubSidebar;
