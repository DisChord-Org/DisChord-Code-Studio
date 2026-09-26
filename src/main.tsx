import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import { startShortcuts } from "./features/shortcuts";
import './index.css';
import "bootstrap-icons/font/bootstrap-icons.css";

startShortcuts();

document.addEventListener("contextmenu", (e) => e.preventDefault());

// WebKit turns a middle click into "autoscroll" (a circle with arrows that follows the mouse) and it gets
// stuck. The middle button keeps working where it means something: pasting the selection into text fields
// on Linux, and the terminal.
document.addEventListener("mousedown", (e) => {
    if (e.button !== 1) return;
    if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable], .cm-editor, .xterm")) return;
    e.preventDefault();
});

invoke<string>("get_platform")
    .then((platform) => document.documentElement.setAttribute("data-platform", platform))
    .catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App />
);