import React from "react";
import "./Header.css";

function Header({ title = "Goals" }) {
  return (
    <header className="header">
      <div className="header-title">
        <h1>{title}</h1>
      </div>
    </header>
  );
}

export default Header;
