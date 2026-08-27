import React from "react";
import ReactDOM from "react-dom/client";
// Vite + React app, so this is the /react entry - /next is for Next.js only.
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import "./index.css";
import { ThemeProvider } from "./theme/ThemeProvider.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      {/* Cookieless page-view analytics. Only sends data on Vercel deployments. */}
      <Analytics />
    </ThemeProvider>
  </React.StrictMode>
);

