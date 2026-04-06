import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import "@/index.css";

function SystemThemeSync() {
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };

    applyTheme(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return null;
}

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <SystemThemeSync />
    <App />
  </React.StrictMode>,
);
