<template>
    <div class="shortcut-section page-nav-mode-selector">
      <div class="page-nav-title">페이지 이동 단축키 모드</div>
      <div class="page-nav-options">
        <!-- modes 배열을 순회하며 각 모드에 대한 라디오 버튼을 생성합니다. -->
        <label v-for="modeInfo in modes" :key="modeInfo.value" class="page-nav-label">
          <input
            type="radio"
            name="pageNavMode"
            :value="modeInfo.value"
            :checked="currentMode === modeInfo.value"
            @change="$emit('update:mode', modeInfo.value)"
          />
          <span class="mode-text">{{ modeInfo.text }}</span>
  
          <!-- 각 모드별 보충 설명 툴팁 -->
          <FootnoteTrigger
            v-if="modeInfo.value === 'ajax' || modeInfo.value === 'infinite'"
            :tooltip-text="modeInfo.value === 'ajax' ? ajaxTooltipText : infiniteTooltipText"
            style="margin-left: 6px;"
          />
        </label>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  import type { PageNavigationMode } from '@/types';
  import FootnoteTrigger from './FootnoteTrigger.vue';
  
  // =================================================================
  // Type Definitions (타입 정의)
  // =================================================================
  
  /**
   * @interface PageNavModeSelectorProps
   * @description 이 컴포넌트가 받는 props의 타입을 정의합니다.
   */
  interface PageNavModeSelectorProps {
    currentMode: PageNavigationMode;
  }
  
  /**
   * @interface ModeInfo
   * @description 각 라디오 버튼 옵션의 정보를 담는 객체의 타입을 정의합니다.
   */
  interface ModeInfo {
    value: PageNavigationMode;
    text: string;
  }
  
  
  // =================================================================
  // Props, Emits, and State (Props, Emits 및 상태)
  // =================================================================
  
  /**
   * @description `defineProps`를 사용하여 타입이 지정된 props를 받습니다.
   */
  defineProps<PageNavModeSelectorProps>();
  
  /**
   * @description `defineEmits`를 사용하여 컴포넌트가 발생시키는 이벤트와 페이로드의 타입을 명시합니다.
   */
  defineEmits<{
    (e: 'update:mode', mode: PageNavigationMode): void;
  }>();
  
  /**
   * @description 페이지 이동 모드 선택 옵션 목록을 담고 있는 ref.
   * `ref<ModeInfo[]>`를 사용하여 배열의 각 요소가 `ModeInfo` 타입을 따르도록 강제합니다.
   */
  const modes = ref<ModeInfo[]>([
    { value: 'ajax', text: '⚡ 빠른 이동 (새로고침X)' },
    { value: 'full', text: '🔄 기본 이동 (새로고침)' },
    { value: 'infinite', text: '∞ 무한 스크롤 (하단 자동 로드)' },
  ]);
  
  /**
   * @description '빠른 이동' 모드에 대한 설명 툴팁 텍스트를 담고 있는 ref.
   */
  const ajaxTooltipText = ref<string>("외부 자동 새로고침 확장 프로그램과 충돌할 수 있습니다. 내장한 자동 새로고침 기능을 이용하세요.");

  /**
   * @description '무한 스크롤' 모드에 대한 설명 툴팁 텍스트를 담고 있는 ref.
   */
  const infiniteTooltipText = ref<string>('글 목록 하단에 도달하면 다음 페이지를 자동으로 이어 붙여 불러옵니다.');
  </script>
  
  <style scoped>
  /* 스타일은 변경되지 않았으므로 여기에 그대로 유지됩니다. */
  .page-nav-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: #495057;
    margin-bottom: 12px;
  }
  
  .page-nav-options {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .page-nav-label {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    font-size: 0.9rem;
    color: #343a40;
    padding: 6px 0;
    transition: color 0.15s ease;
  }
  
  .page-nav-label:hover .mode-text {
    color: #0d6efd;
  }
  
  .page-nav-label input[type="radio"] {
    margin-right: 8px;
    accent-color: #0d6efd;
    transform: scale(1.1);
    flex-shrink: 0;
  }
  
  .page-nav-label .mode-text {
    transition: color 0.15s ease;
  }
  </style>
