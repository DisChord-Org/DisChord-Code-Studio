import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts on purpose: tests only cover pure logic and need none of the Tauri/Tailwind setup.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
