// vite.config.js
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
    sourcemap: false, // 프로덕션 빌드에서는 sourcemap을 false로 하는 것이 일반적입니다.
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
    // --- 콘솔 로그 제거 옵션 추가 ---
    minify: 'terser', // 최소화 도구를 'terser'로 강제 지정
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // --- 콘솔 로그 제거 옵션 추가 끝 ---
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});