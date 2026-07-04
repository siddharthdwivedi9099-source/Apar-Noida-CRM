import React from "react";
import ReactDOM from "react-dom/client";
// Self-hosted variable fonts (previously the display font was referenced but
// never loaded, so users saw OS fallbacks instead of the intended type).
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import { App } from "./app";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

