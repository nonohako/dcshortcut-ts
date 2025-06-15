// src/types/global.d.ts
import type AutoRefresher from '@/services/AutoRefresher';

declare global {
  interface Window {
    // AutoRefresher 모듈이 window 객체에 할당될 수 있음을 알립니다.
    AutoRefresher?: typeof AutoRefresher;
    // handleAutoRefresherState 함수가 window 객체에 존재할 수 있음을 알립니다.
    handleAutoRefresherState?: () => void;
  }
}

// 이 파일이 모듈임을 나타내기 위해 빈 export를 추가합니다.
export {};