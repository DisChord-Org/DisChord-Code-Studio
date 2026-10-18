import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { startShortcuts } from "./features/shortcuts";
import { installMiddleClickGuard } from "./utils/MiddleClick";
import { forcedPlatform } from "./utils/Platform";
import './index.css';
import "bootstrap-icons/font/bootstrap-icons.css";

startShortcuts();

document.addEventListener("contextmenu", (e) => e.preventDefault());

installMiddleClickGuard();

const appWindow = getCurrentWindow();
const syncMaximized = () =>
    appWindow
        .isMaximized()
        .then((maximized) => document.documentElement.toggleAttribute("data-maximized", maximized))
        .catch(() => {}); // Only a cosmetic attribute for window corners.

syncMaximized();
appWindow.onResized(syncMaximized).catch(() => {}); // Same: cosmetic only.

invoke<string>("get_platform")
    .then((platform) => document.documentElement.setAttribute("data-platform", forcedPlatform ?? platform))
    .catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App />
);