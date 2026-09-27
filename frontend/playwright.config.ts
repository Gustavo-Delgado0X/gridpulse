import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:5174", viewport: { width: 1440, height: 900 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    { command: "cd .. && .venv/bin/python -m uvicorn app.main:app --app-dir backend --port 8001",
      url: "http://127.0.0.1:8001/api/health", reuseExistingServer: false, env: { RATE_LIMIT: "1000/minute" } },
    { command: "npx vite --port 5174 --strictPort", url: "http://localhost:5174", reuseExistingServer: false,
      env: { VITE_API_PROXY: "http://127.0.0.1:8001" } },
  ],
});
