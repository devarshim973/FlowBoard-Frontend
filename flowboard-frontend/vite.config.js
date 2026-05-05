import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/v1/admin": {
        target: "http://localhost:8091",
        changeOrigin: true
      },
      "/api/v1/auth": {
        target: "http://localhost:8081",
        changeOrigin: true
      },
      "/api/v1/user": {
        target: "http://localhost:8081",
        changeOrigin: true
      },
      "/api/v1/notifications": {
        target: "http://localhost:8082",
        changeOrigin: true
      },
      "/api/v1/comments": {
        target: "http://localhost:8083",
        changeOrigin: true
      },
      "/api/v1/attachments": {
        target: "http://localhost:8083",
        changeOrigin: true
      },
      "/api/v1/workspaces": {
        target: "http://localhost:8084",
        changeOrigin: true
      },
      "/api/v1/boards": {
        target: "http://localhost:8085",
        changeOrigin: true
      },
      "/api/v1/board-members": {
        target: "http://localhost:8085",
        changeOrigin: true
      },
      "/api/v1/lists": {
        target: "http://localhost:8086",
        changeOrigin: true
      },
      "/api/v1/cards": {
        target: "http://localhost:8087",
        changeOrigin: true
      },
      "/api/v1/payments": {
        target: "http://localhost:8089",
        changeOrigin: true
      }
    }
  }
});
