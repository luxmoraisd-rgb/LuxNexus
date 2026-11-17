import { useEffect, useState } from "react";
import {
  Triangle,
  BarChart3,
  Gauge,
} from "lucide-react";

import SubSidebarAurora from "../../Common/SubSidebarAurora";
import "./trackersidebar.css";



const TrackerSidebar = ({ children }) => {
  return <aside className="tracker-sidebar">{children}</aside>;
};


TrackerSidebar.Header = ({ children }) => {
  return <div className="tracker-header">{children}</div>;
};



TrackerSidebar.Navigation = ({ children }) => {
  return <nav className="tracker-navigation">{children}</nav>;
};



TrackerSidebar.NavItem = ({
  icon: Icon,
  label,
  active = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`tracker-nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Icon size={22} strokeWidth={1.7} />
      <span>{label}</span>
    </button>
  );
};



export default function TrackerSidebarExample({ onSelectionChange, selectedItem }) {
  const [selected, setSelected] = useState(selectedItem || "Goals");

  useEffect(() => {
    if (selectedItem) {
      setSelected(selectedItem);
    }
  }, [selectedItem]);

  const handleSelect = (item) => {
    setSelected(item);
    onSelectionChange?.(item);
  };

  return (
    <TrackerSidebar>

      <TrackerSidebar.Header>
        Tracker
      </TrackerSidebar.Header>

      <TrackerSidebar.Navigation>

        <TrackerSidebar.NavItem
          icon={Triangle}
          label="Goals"
          active={selected === "Goals" || selected === "My goals"}
          onClick={() => handleSelect("Goals")}
        />

        <TrackerSidebar.NavItem
          icon={BarChart3}
          label="Reports"
          active={selected === "Reports"}
          onClick={() => handleSelect("Reports")}
        />

        <TrackerSidebar.NavItem
          icon={Gauge}
          label="Resourcing"
          active={selected === "Resourcing"}
          onClick={() => handleSelect("Resourcing")}
        />

      </TrackerSidebar.Navigation>

      <SubSidebarAurora />

    </TrackerSidebar>
  );
}