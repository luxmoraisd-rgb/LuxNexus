import {
  Briefcase,
  Target,
  BookOpen,
  Users,
} from "lucide-react";

import "./mainsidebar.css";


const MainSidebar = ({
  activeItem,
  setActiveItem,
}) => {

  const menuItems = [
    {
      id: "work",
      label: "Work",
      icon: <Briefcase size={21} />,
    },

    {
      id: "strategy",
      label: "Tracker",
      icon: <Target size={21} />,
    },

    {
      id: "knowledge",
      label: "Knowledge",
      icon: <BookOpen size={21} />,
    },

    {
      id: "people",
      label: "People",
      icon: <Users size={21} />,
    },
  ];


  return (
    <aside className="main-sidebar">

      <div className="sidebar-items">

        {menuItems.map((item) => (

          <button
            key={item.id}
            className={`sidebar-item ${activeItem === item.id
                ? "active"
                : ""
              }`}
            onClick={() =>
              setActiveItem(item.id)
            }
          >

            <div className="sidebar-icon">
              {item.icon}
            </div>

            <span>
              {item.label}
            </span>

          </button>

        ))}

      </div>


      <div className="sidebar-bottom">
      </div>

    </aside>
  );
};

export default MainSidebar;