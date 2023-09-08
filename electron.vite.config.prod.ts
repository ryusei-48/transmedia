import { bytecodePlugin, defineConfig, externalizeDepsPlugin } from 'electron-vite';
import React from "@vitejs/plugin-react";
import { resolve } from 'path';
import sass from "vite-plugin-sass-dts";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      bytecodePlugin({ protectedStrings: [ "ready-to-show" ] })
    ],
    build: {
      minify: true,
      outDir: './compiled/main'
    }
  },
  preload: {
    plugins: [
      externalizeDepsPlugin(),
      bytecodePlugin()
    ],
    build: {
      minify: true,
      outDir: './compiled/preload'
    }
  },
  renderer: {
    build: {
      minify: true, chunkSizeWarningLimit: 2000,
      cssCodeSplit: true,
      outDir: resolve(__dirname, 'compiled/renderer'),
      rollupOptions: {
        input: {
          main: resolve(__dirname, './src/renderer/index.html'),
          player: resolve(__dirname, './src/renderer/player.html'),
        }
      }
    },
    plugins: [ React(), sass() ]
  }
})