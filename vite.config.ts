// vite.config.ts
import { defineConfig, loadEnv, type PluginOption } from 'vite'; // PluginOption 타입 추가
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import fs from 'node:fs'; // Node.js의 파일 시스템 모듈 추가
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Manifest 파일을 동적으로 생성하는 커스텀 플러그인
function manifestPlugin(isProduction: boolean): PluginOption {
  return {
    name: 'make-manifest',
    // 빌드가 끝난 후 실행되는 훅
    writeBundle() {
      // 1. 기본 manifest.json 파일 읽기
      const manifestPath = path.resolve(__dirname, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      if (isProduction) {
        // 2. 프로덕션 모드일 때: web_accessible_resources 제거
        console.log('Production mode: Removing web_accessible_resources from manifest.');
        delete manifest.web_accessible_resources;
      } else {
        // 3. 개발 모드일 때: web_accessible_resources 추가
        console.log('Development mode: Adding web_accessible_resources to manifest.');
        manifest.web_accessible_resources = [
          {
            resources: ["*.js.map"],
            matches: ["<all_urls>"]
          },
          {
            resources: ["assets/js/*.js"],
            matches: ["<all_urls>"]
          }
        ];
      }

      // 4. 수정된 manifest.json을 출력 디렉터리에 쓰기
      const destPath = path.resolve(__dirname, 'dist', 'manifest.json');
      fs.writeFileSync(destPath, JSON.stringify(manifest, null, 2));
      console.log(`Manifest file written to ${destPath}`);
    }
  };
}

// defineConfig를 함수 형태로 변경
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';

  return {
    plugins: [
      vue(),
      viteStaticCopy({
        targets: [
          { src: 'icons', dest: '.' },
        ]
      }),
      manifestPlugin(isProduction),
    ],
    build: {
      outDir: 'dist',
      sourcemap: !isProduction,
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
    esbuild: isProduction ? {
      pure: ['console.log', 'console.error', 'console.warn', 'console.debug', 'console.trace'],
      drop: ['debugger'],
    } : undefined,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});