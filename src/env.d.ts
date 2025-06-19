/// <reference types="vite/client" />

// 이 선언은 TypeScript에게 .vue로 끝나는 파일을 import할 때
// 그것을 일반적인 Vue 컴포넌트 타입으로 취급하도록 알려줍니다.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
