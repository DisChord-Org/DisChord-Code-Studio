import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import { startShortcuts } from "./features/shortcuts";
import './index.css';
import "bootstrap-icons/font/bootstrap-icons.css";

startShortcuts();

document.addEventListener("contextmenu", (e) => e.preventDefault());

// WebKit turns a middle click into "autoscroll" (a circle with arrows that follows the mouse) and it gets
// stuck. On Linux the middle button also pastes the mouse selection wherever it lands, which in the code
// editor means silently rewriting a file, so it is cancelled there too. It stays in plain text fields and
// in the terminal, where pasting is what people expect.
document.addEventListener("mousedown", (e) => {
    if (e.button !== 1) return;

    const target = e.target as HTMLElement | null;
    const keepsPaste = target?.closest("input, textarea, .xterm") || (target?.closest("[contenteditable]") && !target.closest(".cm-editor"));
    if (!keepsPaste) e.preventDefault();
});

invoke<string>("get_platform")
    .then((platform) => document.documentElement.setAttribute("data-platform", platform))
    .catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App />
);