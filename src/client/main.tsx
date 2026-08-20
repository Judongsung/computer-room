import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "xp.css/dist/XP.css";
import { App } from "./app";
import { SITE_COPY } from "./constants/content";
import "./styles/global.css";

document.title = SITE_COPY.TITLE;
const root = document.createElement("div");
document.body.append(root);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
