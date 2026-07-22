import { createRoot } from "react-dom/client";
import Home from "../app/page";

const root = document.getElementById("root");

if (!root) throw new Error("Vision AI root element was not found.");

createRoot(root).render(<Home />);
