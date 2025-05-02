import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// O título do documento será definido dinamicamente quando as configurações forem carregadas
// usando o hook useSystemSettings dentro do componente App

// Add the head element for favicon
const link = document.createElement("link");
link.rel = "icon";
link.href = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎫</text></svg>";
document.head.appendChild(link);

createRoot(document.getElementById("root")!).render(<App />);
