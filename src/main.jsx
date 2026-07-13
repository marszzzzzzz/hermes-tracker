import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import HermesDashboard from "./HermesDashboard.jsx";

// claude.ai artifact 環境 shim：window.storage → localStorage
window.storage = {
  async get(key) {
    const v = localStorage.getItem(key);
    return v == null ? null : { value: v };
  },
  async set(key, value) {
    localStorage.setItem(key, String(value));
  },
};

createRoot(document.getElementById("root")).render(<HermesDashboard />);
