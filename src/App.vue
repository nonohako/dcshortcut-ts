<template>
    <!-- Vue 애플리케이션의 최상위 루트 요소입니다. -->
    <div id="dc-ShortCut-root">
      <!-- 
        uiStore의 activeModal 상태에 따라 조건부로 모달을 렌더링합니다.
        - 'favorites'일 경우 즐겨찾기 모달을,
        - 'shortcuts'일 경우 단축키 설정 모달을 표시합니다.
      -->
      <FavoritesModal v-if="uiStore.activeModal === 'favorites'" />
      <ShortcutManagerModal v-if="uiStore.activeModal === 'shortcuts'" />
      
      <!-- 
        즐겨찾기 미리보기 컴포넌트는 항상 렌더링됩니다.
        실제 표시 여부는 컴포넌트 내부의 isVisible 상태에 의해 결정됩니다.
      -->
      <FavoritesPreview /> 
    </div>
  </template>
  
  <script setup lang="ts">
  // Pinia의 UI 스토어를 가져옵니다. 모달의 표시 상태 등을 관리합니다.
  import { useUiStore } from '@/stores/uiStore';
  
  // Vue 컴포넌트들을 가져옵니다.
  import FavoritesModal from './components/FavoritesModal.vue';
  import ShortcutManagerModal from './components/ShortcutManagerModal.vue';
  import FavoritesPreview from './components/FavoritesPreview.vue';
  
  /**
   * @description UI 상태 관리를 위한 Pinia 스토어 인스턴스.
   * 이 스토어의 `activeModal` 상태는 어떤 모달을 화면에 표시할지 결정합니다.
   * TypeScript가 `useUiStore`의 반환 타입을 추론하여 `uiStore` 상수를 자동으로 타이핑합니다.
   */
  const uiStore = useUiStore();
  </script>
  
  <style>
  :root {
    --dc-color-bg: #f8f9fa;
    --dc-color-surface: #ffffff;
    --dc-color-surface-muted: #f5f5f5;
    --dc-color-surface-subtle: #fafafa;
    --dc-color-surface-hover: #f1f3f5;
    --dc-color-text-primary: #212529;
    --dc-color-text-secondary: #495057;
    --dc-color-text-muted: #6c757d;
    --dc-color-text-subtle: #868e96;
    --dc-color-border: #dee2e6;
    --dc-color-border-soft: #e9ecef;
    --dc-color-border-strong: #ced4da;
    --dc-color-accent: #0d6efd;
    --dc-color-accent-hover: #0b5ed7;
    --dc-color-primary: #1976d2;
    --dc-color-primary-hover: #1565c0;
    --dc-color-success: #4caf50;
    --dc-color-success-hover: #388e3c;
    --dc-color-danger: #d32f2f;
    --dc-color-danger-strong: #dc3545;
    --dc-color-danger-bg: #ffebee;
    --dc-color-warning-text: #c0392b;
    --dc-color-warning-bg: #fbe9e7;
    --dc-color-warning-border: #ffab91;
    --dc-color-orange: #ffc107;
    --dc-color-orange-hover: #ffca2c;
    --dc-color-overlay: rgba(0, 0, 0, 0.45);
    --dc-color-switch-off: #adb5bd;
    --dc-color-key-bg: #e9ecef;
    --dc-color-key-text: #212529;
    --dc-color-tooltip-bg: #212529;
    --dc-color-tooltip-text: #ffffff;
    --dc-color-preview-bg: rgba(20, 20, 20, 0.9);
    --dc-color-preview-border: rgba(255, 255, 255, 0.2);
    --dc-color-preview-key: #ffc107;
    --dc-color-preview-text: #e0e0e0;
    --dc-shadow-soft: 0 2px 4px rgba(0, 0, 0, 0.05);
    --dc-shadow-medium: 0 6px 20px rgba(0, 0, 0, 0.1);
    --dc-shadow-strong: 0 8px 24px rgba(0, 0, 0, 0.15);
    --dc-shadow-tooltip: 0 2px 5px rgba(0, 0, 0, 0.2);
    --dc-focus-ring: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
  }

  :root[data-dc-theme='dark'] {
    --dc-color-bg: #15181c;
    --dc-color-surface: #1d2228;
    --dc-color-surface-muted: #242a31;
    --dc-color-surface-subtle: #262d35;
    --dc-color-surface-hover: #2d3640;
    --dc-color-text-primary: #f1f3f5;
    --dc-color-text-secondary: #d0d7de;
    --dc-color-text-muted: #a6b0ba;
    --dc-color-text-subtle: #8f99a3;
    --dc-color-border: #3d4650;
    --dc-color-border-soft: #323b45;
    --dc-color-border-strong: #515d6a;
    --dc-color-accent: #6ea8fe;
    --dc-color-accent-hover: #8bb9ff;
    --dc-color-primary: #5a9cf2;
    --dc-color-primary-hover: #7bb1ff;
    --dc-color-success: #5dbb63;
    --dc-color-success-hover: #77ce7d;
    --dc-color-danger: #ff7d73;
    --dc-color-danger-strong: #f26d79;
    --dc-color-danger-bg: rgba(242, 109, 121, 0.18);
    --dc-color-warning-text: #ffb6a0;
    --dc-color-warning-bg: rgba(255, 138, 101, 0.2);
    --dc-color-warning-border: rgba(255, 171, 145, 0.5);
    --dc-color-orange: #dca54a;
    --dc-color-orange-hover: #efb65a;
    --dc-color-overlay: rgba(0, 0, 0, 0.6);
    --dc-color-switch-off: #6b7785;
    --dc-color-key-bg: #2f3842;
    --dc-color-key-text: #eef2f6;
    --dc-color-tooltip-bg: #11161b;
    --dc-color-tooltip-text: #f2f5f8;
    --dc-color-preview-bg: rgba(14, 18, 23, 0.92);
    --dc-color-preview-border: rgba(255, 255, 255, 0.14);
    --dc-color-preview-key: #ffd666;
    --dc-color-preview-text: #dbe2ea;
    --dc-shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.28);
    --dc-shadow-medium: 0 10px 24px rgba(0, 0, 0, 0.35);
    --dc-shadow-strong: 0 14px 34px rgba(0, 0, 0, 0.4);
    --dc-shadow-tooltip: 0 6px 14px rgba(0, 0, 0, 0.35);
    --dc-focus-ring: 0 0 0 0.2rem rgba(110, 168, 254, 0.35);
  }

  /* 
    이 스타일 블록은 scoped 속성이 없으므로, 이 컴포넌트와 모든 자식 컴포넌트에
    적용되는 전역 스타일을 정의합니다.
  */
  
  /* Vue 애플리케이션의 루트 컨테이너 스타일 */
  #dc-ShortCut-root * {
    font-family: "Noto Sans CJK KR", "NanumGothic", sans-serif !important; /* Fallback to system sans-serif if specified fonts not available */
  }

  #dc-ShortCut-root {
    position: relative; /* 자식 요소(특히 Teleport된 요소)의 위치 기준점으로 작동할 수 있음 */
    z-index: 9999; /* 모달이나 툴팁보다는 낮은 z-index를 가집니다. */
  }
  
  /* 
    전역 툴팁 스타일 (TooltipBase.vue에서 사용됩니다.)
    툴팁은 Teleport를 사용하여 body에 직접 렌더링될 수 있으므로,
    전역적으로 접근 가능한 스타일로 정의해야 합니다.
  */
  .global-tooltip-style {
    background-color: var(--dc-color-tooltip-bg);
    color: var(--dc-color-tooltip-text);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.8rem; /* 작은 글씨 크기 */
    line-height: 1.4;
    white-space: nowrap; /* 기본적으로 한 줄로 표시 */
    z-index: 1000000; /* 다른 모든 UI 요소 위에 표시되도록 매우 높은 z-index 설정 */
    pointer-events: none; /* 툴팁 위로 마우스 이벤트가 통과하도록 설정 */
    box-shadow: var(--dc-shadow-tooltip);
  }
  
  /* 텍스트가 길 경우 여러 줄로 표시하기 위한 스타일 */
  .global-tooltip-style.multiline {
    white-space: normal;
    min-width: 150px;
    max-width: 250px;
    text-align: left;
  }
  </style>
