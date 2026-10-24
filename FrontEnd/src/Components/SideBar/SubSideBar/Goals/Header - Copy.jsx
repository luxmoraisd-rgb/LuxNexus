import React from "react";
import "./Header.css";

function Header({ title = "Goals" }) {
  return (
    <header className="header">
      <div className="header-title">
        <h1>{title}</h1>
      </div>

      <button
        type="button"
        className="help-button"
        onClick={() =>
          window.alert(
            "Contact your workspace administrator for strategic planning and goal tracking guidance."
          )
        }
      >
        Need Assistance
      </button>
    </header>
  );
}

export default Header;
