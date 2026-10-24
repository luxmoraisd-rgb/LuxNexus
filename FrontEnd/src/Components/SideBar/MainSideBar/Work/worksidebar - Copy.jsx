import {
  Home,
  Bell,
  CheckCircle,
  Briefcase,
} from "lucide-react";
import "./worksidebar.css";

const SubSidebar = ({ activeMenu = "tasks", onMenuSelect }) => {
  const subMenu = [
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
      id: "portfolios",
      label: "Portfolios",
      icon: <Briefcase size={20} />,
    },
  ];

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
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default SubSidebar;
