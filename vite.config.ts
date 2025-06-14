import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy' // [1] import
import manifest from './manifest.json' // [2] manifest.json을 직접 읽어옴

// [3] manifest.json의 경로를 변환하는 함수
const transformManifest = (buffer) => {
  const manifestString = buffer.toString()
  // .ts 경로를 .js로 변경
  return manifestString
    .replace(/"src\/(.*)\.ts"/g, '"src/$1.js"')
    // CSS 경로도 빌드 결과에 맞게 수정
    .replace(/"src\/(.*)\.css"/g, '"assets/$1.css"');
};

export default defineConfig({
  plugins: [
    vue(),
    // [4] 플러그인 설정 추가
    viteStaticCopy({
      targets: [
        {
          src: 'public/icons', // public 폴더의 icons 폴더
          dest: '.' // dist 폴더의 루트에 복사
        },
        {
          src: 'manifest.json', // 루트의 manifest.json
          dest: '.', // dist 폴더의 루트에 복사
          transform: transformManifest // 복사하면서 내용 변환
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'public/popup.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        'content-script': resolve(__dirname, 'src/content-script/main.ts'),
      },
      output: {
        entryFileNames: 'src/[name].js',
        chunkFileNames: 'src/chunks/[name].js',
        assetFileNames: (assetInfo) => {
          // CSS 파일의 경로를 manifest.json과 일치시킴
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/style.css';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
  },
})