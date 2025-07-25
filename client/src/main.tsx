import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Importar cache manager para monitoramento em desenvolvimento
import "./utils/cache-manager";

// O ThemeProvider agora gerencia a inicialização do tema automaticamente

const container = document.getElementById("root");
if (!container) throw new Error("Root container missing in index.html");

const root = createRoot(container);
root.render(<App />);
