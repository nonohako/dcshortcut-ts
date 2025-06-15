import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import type { PreRenderedChunk, OutputAsset } from 'rollup';


// https://vitejs.dev/config/
export default defineConfig({
  // 플러그인 설정
  plugins: [
    // Vue 3 지원을 위한 플러그인
    vue(),
    // 정적 파일을 빌드 디렉토리로 복사하기 위한 플러그인
    viteStaticCopy({
      targets: [
        {
          // manifest.json 파일을 dist 폴더의 루트로 복사합니다.
          src: 'manifest.json',
          dest: '.'
        },
        {
          // 'icons' 폴더 전체를 dist 폴더로 복사합니다.
          src: 'icons',
          dest: '.'
        }
      ]
    })
  ],
  // 빌드 관련 설정
  build: {
    // 빌드 결과물이 생성될 디렉토리
    outDir: 'dist',
    // 프로덕션 빌드에서 소스맵을 생성하지 않아 용량을 줄입니다.
    sourcemap: false,
    // Rollup의 고급 빌드 옵션 설정
    rollupOptions: {
      // 애플리케이션의 진입점(entry points)을 정의합니다.
      input: {
        // 콘텐츠 스크립트의 메인 TypeScript 파일
        'content-script': path.resolve(__dirname, 'src/content-script/main.ts'),
        // 팝업 페이지의 HTML 파일
        'popup': path.resolve(__dirname, 'src/popup/popup.html'),
        // 백그라운드 서비스 워커의 TypeScript 파일
        'background': path.resolve(__dirname, 'src/background/background.ts'),
      },
      // 빌드 결과물의 출력 파일 형식을 지정합니다.
      output: {
        /**
         * JavaScript 청크 파일의 이름을 동적으로 결정합니다.
         * manifest.json에서 요구하는 정확한 파일명을 생성하기 위해 필요합니다.
         * @param {PreRenderedChunk} chunkInfo - 현재 처리 중인 청크에 대한 정보.
         * @returns {string} - 출력될 파일 경로 및 이름.
         */
        entryFileNames: (chunkInfo: PreRenderedChunk): string => {
          // 'input' 객체의 키(청크 이름)를 기반으로 파일명을 매핑합니다.
          const nameMap: Record<string, string> = {
            'background': 'background.js',
            'content-script': 'content.js',
          };
          // 팝업(popup)은 HTML 진입점이므로 Vite가 자동으로 처리하도록 기본 경로를 사용합니다.
          return nameMap[chunkInfo.name] || 'assets/[name]-[hash].js';
        },
        /**
         * 코드 분할(code splitting)로 생성되는 추가적인 JS 청크 파일의 이름 형식을 지정합니다.
         */
        chunkFileNames: `assets/js/[name]-[hash].js`,
        /**
         * CSS, 이미지 등 에셋 파일의 이름을 동적으로 결정합니다.
         * @param {OutputAsset} assetInfo - 현재 처리 중인 에셋에 대한 정보.
         * @returns {string} - 출력될 에셋 파일 경로 및 이름.
         */
        assetFileNames: (assetInfo: { name?: string }): string => {
          // 콘텐츠 스크립트의 CSS 파일은 manifest.json에서 참조하므로 예측 가능한 이름으로 지정합니다.
          if (assetInfo.name === 'style.css') {
            return 'style.css';
          }
          // 그 외의 에셋들은 캐시 무효화를 위해 해시값을 포함한 이름으로 생성합니다.
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    // 빌드 시 'dist' 디렉토리를 먼저 비웁니다.
    emptyOutDir: true,
  },
  // 모듈 경로 해석(resolve) 설정
  resolve: {
    // 경로 별칭(alias)을 설정하여 import 구문을 간결하게 만듭니다.
    alias: {
      // '@'를 'src' 디렉토리의 절대 경로로 매핑합니다.
      '@': path.resolve(__dirname, './src'),
    },
  },
});