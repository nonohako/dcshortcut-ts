<template>
    <!--
      툴팁을 트리거하는 래퍼(wrapper) 요소입니다.
      마우스 호버 또는 키보드 포커스 시 툴팁을 표시합니다.
    -->
    <span
      ref="triggerRefInternal"
      class="footnote-trigger-wrapper"
      @mouseenter="showTooltip"
      @mouseleave="hideTooltip"
      @focusin="showTooltip"
      @focusout="hideTooltip"
      tabindex="0"
      role="button"
      aria-describedby="tooltip-content"
    >
      <!--
        슬롯(slot)을 사용하여 트리거의 내용을 커스터마이징할 수 있습니다.
        기본값으로는 '[주의]' 텍스트가 표시됩니다.
      -->
      <slot name="trigger">
        <span class="default-footnote-trigger">[주의]</span>
      </slot>
  
      <!--
        실제 툴팁을 렌더링하는 기본 컴포넌트입니다.
        표시 여부(visible), 타겟 요소, 텍스트 및 위치 옵션을 props로 전달받습니다.
      -->
      <TooltipBase
        :visible="isTooltipVisible"
        :target-element="triggerRefInternal"
        :text="tooltipText"
        :position="tooltipPosition"
        :offset="tooltipOffset"
        :multiline-threshold="multilineThreshold"
        :viewport-padding="viewportPadding"
      >
        <span id="tooltip-content">{{ tooltipText }}</span>
      </TooltipBase>
    </span>
  </template>
  
  <script setup lang="ts">
  import { ref, type Ref } from 'vue';
  import TooltipBase from './TooltipBase.vue';
  
  // =================================================================
  // Type Definitions (타입 정의)
  // =================================================================
  
  /**
   * @type TooltipPosition
   * @description 툴팁이 표시될 수 있는 위치를 정의하는 타입.
   */
  type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * @interface FootnoteTriggerProps
   * @description 이 컴포넌트가 받는 props의 타입을 정의합니다.
   */
  interface FootnoteTriggerProps {
    tooltipText: string; // 툴팁에 표시될 필수 텍스트
    tooltipPosition?: TooltipPosition; // 툴팁 위치
    tooltipOffset?: number; // 트리거 요소로부터의 거리 (px)
    multilineThreshold?: number; // 텍스트가 여러 줄로 표시될 임계 길이
    viewportPadding?: number; // 뷰포트 가장자리와의 최소 간격 (px)
  }
  
  
  // =================================================================
  // Props and State (Props 및 상태)
  // =================================================================
  
  /**
   * @description `defineProps`와 `withDefaults`를 사용하여 props를 정의하고 기본값을 설정합니다.
   */
  const props = withDefaults(defineProps<FootnoteTriggerProps>(), {
    tooltipPosition: 'top',
    tooltipOffset: 8,
    multilineThreshold: 35,
    viewportPadding: 5,
  });
  
  /**
   * @description 트리거 요소의 DOM 참조를 저장하기 위한 ref.
   * 타입은 `Ref<HTMLSpanElement | null>`로 지정하여, span 요소 또는 null 값을 가질 수 있음을 명시합니다.
   */
  const triggerRefInternal = ref<HTMLSpanElement | null>(null);
  
  /**
   * @description 툴팁의 표시 여부를 제어하는 boolean 상태 ref.
   */
  const isTooltipVisible = ref<boolean>(false);
  
  
  // =================================================================
  // Event Handlers (이벤트 핸들러)
  // =================================================================
  
  /**
   * @description 툴팁을 표시합니다.
   */
  const showTooltip = (): void => {
    isTooltipVisible.value = true;
  };
  
  /**
   * @description 툴팁을 숨깁니다.
   */
  const hideTooltip = (): void => {
    isTooltipVisible.value = false;
  };
  </script>
  
  <style scoped>
  /*
    툴팁을 트리거하는 래퍼 요소의 스타일입니다.
    사용자와의 상호작용을 유도하기 위해 커서 모양을 변경합니다.
  */
  .footnote-trigger-wrapper {
    display: inline-block;
    cursor: help;
    vertical-align: middle; /* 주변 텍스트와 수직 정렬을 맞춥니다. */
  }
  
  /* 키보드 포커스 시 시각적 피드백을 제공합니다. */
  .footnote-trigger-wrapper:focus {
    outline: 1px dotted var(--dc-color-accent);
    outline-offset: 1px;
  }
  
  /* 슬롯에 내용이 제공되지 않았을 때 표시되는 기본 트리거의 스타일입니다. */
  .default-footnote-trigger {
    font-size: 0.7rem; /* 11.2px */
    color: var(--dc-color-danger-strong);
    font-weight: bold;
    vertical-align: super; /* 텍스트를 위첨자처럼 보이게 합니다. */
    user-select: none; /* 텍스트 선택을 방지합니다. */
    padding: 0 2px;
  }
  </style>
