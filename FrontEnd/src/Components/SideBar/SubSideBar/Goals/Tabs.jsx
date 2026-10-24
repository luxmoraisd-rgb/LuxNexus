import React from "react";
import "./Tabs.css";
import { PlusIcon } from "./Icons";

function Tabs({ activeTab = "My goals", onSelectTab, onAddTab }) {
  const tabs = ["Strategy map", "Team goals", "My goals"];

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
              type="button" >
              {tab}
            </button>
          );
        })}
        <button
          className="tab-add-btn"
          onClick={onAddTab}
          title="Add view"
          type="button"
          aria-label="Add new tab">
          <PlusIcon size={14} />
        </button>
      </div>
    </div>
  );
}

export default Tabs;
