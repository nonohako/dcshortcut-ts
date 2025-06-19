// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'icons', dest: '.' },
      ]
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        background: path.resolve(__dirname, 'src/background/background.ts'),
        'content-script': path.resolve(__dirname, 'src/content-script/main.ts'),
      },
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `assets/js/[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
    emptyOutDir: true,
    minify: 'esbuild',
  },

  // [수정] esbuild 설정을 defineConfig의 최상위 레벨로 이동
  esbuild: {
    pure: ['console.log', 'console.error', 'console.warn', 'console.debug', 'console.trace'],
    drop: ['debugger'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});