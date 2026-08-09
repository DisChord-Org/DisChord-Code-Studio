import ReactDOM from "react-dom/client";
import App from "./App";
import './index.css';
import "bootstrap-icons/font/bootstrap-icons.css";

document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App />
);