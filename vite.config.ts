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
        // [삭제] popup.css는 Vite가 직접 처리하므로 static-copy에서 제거합니다.
      ]
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        // [수정] popup.html의 경로는 계속 프로젝트 루트를 가리킵니다.
        popup: path.resolve(__dirname, 'popup.html'),
        background: path.resolve(__dirname, 'src/background/background.ts'),
        'content-script': path.resolve(__dirname, 'src/content-script/main.ts'),
      },
      output: {
        // [수정] 모든 출력 파일의 이름을 간단하고 예측 가능하게 만듭니다.
        // entryFileNames, chunkFileNames, assetFileNames를 하나로 통합합니다.
        entryFileNames: `[name].js`,
        chunkFileNames: `assets/js/[name].js`,
        assetFileNames: `[name].[ext]`, // CSS 파일 등이 [name].[ext] 형태로 루트에 생성됩니다.
      },
    },
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});