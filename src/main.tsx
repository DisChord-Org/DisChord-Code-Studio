import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import './index.css';
import "bootstrap-icons/font/bootstrap-icons.css";

document.addEventListener("contextmenu", (e) => e.preventDefault());

invoke<string>("get_platform")
    .then((platform) => document.documentElement.setAttribute("data-platform", platform))
    .catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App />
);