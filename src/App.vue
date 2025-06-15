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
  /* 
    이 스타일 블록은 scoped 속성이 없으므로, 이 컴포넌트와 모든 자식 컴포넌트에
    적용되는 전역 스타일을 정의합니다.
  */
  
  /* Vue 애플리케이션의 루트 컨테이너 스타일 */
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
    background-color: #212529; /* 어두운 배경색 */
    color: white; /* 흰색 텍스트 */
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.8rem; /* 작은 글씨 크기 */
    line-height: 1.4;
    white-space: nowrap; /* 기본적으로 한 줄로 표시 */
    z-index: 1000000; /* 다른 모든 UI 요소 위에 표시되도록 매우 높은 z-index 설정 */
    pointer-events: none; /* 툴팁 위로 마우스 이벤트가 통과하도록 설정 */
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }
  
  /* 텍스트가 길 경우 여러 줄로 표시하기 위한 스타일 */
  .global-tooltip-style.multiline {
    white-space: normal;
    min-width: 150px;
    max-width: 250px;
    text-align: left;
  }
  </style>