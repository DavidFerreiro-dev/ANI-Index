import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Netlify Dev launches Vite internally on this port and serves the public
    // site (including redirects and functions) from port 8888.
    port: 5173,
    strictPort: true
  }
});
