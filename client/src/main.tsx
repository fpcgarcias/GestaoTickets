import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeTheme } from "./lib/theme-manager";

// Importar cache manager para monitoramento em desenvolvimento
import "./utils/cache-manager";

// Inicializar tema baseado no domínio antes de renderizar a aplicação
initializeTheme();

// O título do documento será definido dinamicamente quando as configurações forem carregadas
// usando o hook useSystemSettings dentro do componente App

createRoot(document.getElementById("root")!).render(<App />);
