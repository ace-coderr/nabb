import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const REACT_DEPS = /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/;
const WEB3_DEPS = /node_modules[\\/](viem|wagmi|@wagmi|ox|abitype|@noble|@scure)[\\/]/;

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: REACT_DEPS },
            { name: "web3", test: WEB3_DEPS },
          ],
        },
      },
    },
  },
});
