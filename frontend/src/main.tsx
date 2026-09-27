import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/landing.css";
import App from "./App";
import { LandingPage } from "./components/LandingPage";
import { isLandingPath } from "./route";

const landing = isLandingPath(window.location.pathname, window.location.hash);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {landing ? <LandingPage /> : <App />}
  </StrictMode>,
);
