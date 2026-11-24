import React from "react";
import "./Tabs.css";

function Tabs({ activeTab = "My goals", onSelectTab }) {
  const tabs = ["My goals", "Team goals", "Strategy map"];

  return (
    <div className="tabs-container">
      <div className="tabs-list">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              className={`tab-item ${isActive ? "active" : ""}`}
              onClick={() => onSelectTab && onSelectTab(tab)}
              type="button"
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Tabs;
