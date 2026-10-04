import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import "@/index.css";

// Warm up the connection to the photo host while the first search request is in flight,
// so the first portfolio photos don't also pay for DNS + TLS setup.
const portfolioPhotosBaseUrl = String(import.meta.env.VITE_PORTFOLIO_PHOTOS_BASE_URL || "");
if (/^https?:\/\//i.test(portfolioPhotosBaseUrl)) {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = new URL(portfolioPhotosBaseUrl).origin;
  document.head.appendChild(link);
}

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
