<template>
    <!--
      <Teleport>는 Vue의 내장 컴포넌트로, 이 컴포넌트의 템플릿 일부를
      현재 컴포넌트의 DOM 계층 구조 밖의 다른 위치로 "이동"시킵니다.
      여기서는 툴팁을 <body> 태그의 직속 자식으로 렌더링하여,
      부모 요소의 z-index나 overflow:hidden 스타일에 영향을 받지 않도록 합니다.
    -->
    <Teleport to="body">
      <div
        v-if="visible"
        ref="tooltipRef"
        class="global-tooltip-style"
        :class="{ 'multiline': isMultiline }"
        :style="tooltipStyle"
        role="tooltip"
      >
        <slot></slot> <!-- 툴팁 내용은 부모 컴포넌트에서 slot을 통해 전달받습니다. -->
      </div>
    </Teleport>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, type Ref, type ComputedRef, type CSSProperties } from 'vue';
  
  // =================================================================
  // Type Definitions (타입 정의)
  // =================================================================
  
  /**
   * @type TooltipPosition
   * @description 툴팁이 표시될 수 있는 위치를 정의하는 타입.
   */
  type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * @interface TooltipBaseProps
   * @description 이 컴포넌트가 받는 props의 타입을 정의합니다.
   */
  interface TooltipBaseProps {
    visible: boolean; // 툴팁의 표시 여부
    targetElement: HTMLElement | null; // 툴팁이 따라다닐 대상 DOM 요소
    text: string; // 툴팁 텍스트 (여러 줄 처리를 위해 필요)
    position?: TooltipPosition; // 툴팁 위치
    offset?: number; // 대상 요소로부터의 거리 (px)
    multilineThreshold?: number; // 텍스트가 여러 줄로 표시될 임계 길이
    viewportPadding?: number; // 뷰포트 가장자리와의 최소 간격 (px)
  }
  
  /**
   * @interface TooltipState
   * @description 툴팁의 위치와 표시 상태를 관리하는 내부 상태 객체의 타입.
   */
  interface TooltipState {
    top: number;
    left: number;
    visibility: 'visible' | 'hidden';
  }
  
  
  // =================================================================
  // Props and State (Props 및 상태)
  // =================================================================
  
  const props = withDefaults(defineProps<TooltipBaseProps>(), {
    position: 'top',
    offset: 8,
    multilineThreshold: 35,
    viewportPadding: 5,
  });
  
  /** @description 툴팁 div 요소의 DOM 참조를 저장합니다. */
  const tooltipRef: Ref<HTMLDivElement | null> = ref(null);
  
  /** @description 툴팁의 계산된 위치(top, left)와 표시 여부(visibility)를 저장하는 반응형 상태. */
  const tooltipPosition = ref<TooltipState>({ top: 0, left: 0, visibility: 'hidden' });
  
  
  // =================================================================
  // Computed Properties (계산된 속성)
  // =================================================================
  
  /**
   * @description 툴팁 텍스트 길이에 따라 'multiline' 클래스를 적용할지 여부를 계산합니다.
   */
  const isMultiline: ComputedRef<boolean> = computed(() => {
    return props.text.length > props.multilineThreshold;
  });
  
  /**
   * @description 계산된 위치 정보를 기반으로 툴팁에 적용할 인라인 스타일 객체를 생성합니다.
   */
  const tooltipStyle: ComputedRef<CSSProperties> = computed(() => ({
    position: 'absolute',
    top: `${tooltipPosition.value.top}px`,
    left: `${tooltipPosition.value.left}px`,
    visibility: tooltipPosition.value.visibility,
  }));
  
  
  // =================================================================
  // Functions and Logic (함수 및 로직)
  // =================================================================
  
  /**
   * @description 대상 요소와 툴팁의 크기를 기반으로 툴팁의 위치를 계산하고, 뷰포트 경계를 벗어나지 않도록 조정합니다.
   */
  const calculatePosition = async (): Promise<void> => {
    // 대상 요소가 없거나 툴팁이 보이지 않는 상태이면 계산을 중단합니다.
    if (!props.targetElement || !props.visible) {
      tooltipPosition.value.visibility = 'hidden';
      return;
    }
  
    // nextTick을 기다려 Vue가 DOM을 업데이트할 시간을 줍니다.
    await nextTick();
    const tooltipEl = tooltipRef.value;
    if (!tooltipEl) {
      tooltipPosition.value.visibility = 'hidden';
      return;
    }
  
    const targetRect = props.targetElement.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    
    // 현재 스크롤 위치를 가져옵니다. getBoundingClientRect는 뷰포트 기준이므로 스크롤 값을 더해 절대 좌표를 구합니다.
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
    let top = 0;
    let left = 0;
  
    // props.position 값에 따라 초기 위치를 계산합니다.
    switch (props.position) {
      case 'bottom':
        top = targetRect.bottom + scrollY + props.offset;
        left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left + scrollX - tooltipRect.width - props.offset;
        break;
      case 'right':
        top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + scrollX + props.offset;
        break;
      case 'top':
      default:
        top = targetRect.top + scrollY - tooltipRect.height - props.offset;
        left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
    }
  
    // 뷰포트 경계 검사: 툴팁이 화면 밖으로 나가지 않도록 위치를 조정합니다.
    if (left < scrollX + props.viewportPadding) {
      left = scrollX + props.viewportPadding;
    }
    if (left + tooltipRect.width > scrollX + window.innerWidth - props.viewportPadding) {
      left = scrollX + window.innerWidth - tooltipRect.width - props.viewportPadding;
    }
    if (top < scrollY + props.viewportPadding) {
      top = scrollY + props.viewportPadding;
    }
    if (top + tooltipRect.height > scrollY + window.innerHeight - props.viewportPadding) {
      top = scrollY + window.innerHeight - tooltipRect.height - props.viewportPadding;
    }
  
    // 최종 계산된 위치를 상태에 반영합니다.
    tooltipPosition.value = { top, left, visibility: 'visible' };
  };
  
  /**
   * @description 스크롤이나 창 크기 변경 시 툴팁 위치를 다시 계산하는 핸들러.
   */
  const handleScrollOrResize = (): void => {
    if (props.visible && props.targetElement) {
      calculatePosition();
    }
  };
  
  
  // =================================================================
  // Watchers and Lifecycle Hooks (감시자 및 라이프사이클 훅)
  // =================================================================
  
  // props.visible, targetElement 등이 변경될 때마다 위치를 다시 계산합니다.
  watch(
    () => [props.visible, props.targetElement, props.text, props.position],
    () => {
      if (props.visible && props.targetElement) {
        calculatePosition();
      } else {
        tooltipPosition.value.visibility = 'hidden';
      }
    },
    { deep: true } // props.text의 내용 변경으로 툴팁 크기가 바뀔 수 있으므로 deep watch 사용
  );
  
  // 컴포넌트가 마운트될 때 이벤트 리스너를 추가합니다.
  onMounted(() => {
    window.addEventListener('scroll', handleScrollOrResize, true); // 캡처링 단계에서 이벤트를 감지하여 더 정확하게 처리
    window.addEventListener('resize', handleScrollOrResize);
    if (props.visible && props.targetElement) {
      calculatePosition(); // 초기 위치 계산
    }
  });
  
  // 컴포넌트가 언마운트되기 전에 이벤트 리스너를 제거하여 메모리 누수를 방지합니다.
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', handleScrollOrResize, true);
    window.removeEventListener('resize', handleScrollOrResize);
  });
  </script>
  
  <!--
    이 컴포넌트의 스타일은 전역적으로 적용되어야 합니다.
    Teleport를 통해 <body>에 직접 렌더링되므로, scoped 스타일은 적용되지 않습니다.
    App.vue 또는 전역 CSS 파일로 이 스타일을 옮기는 것이 가장 좋은 방법입니다.
  -->
  <style>
  .global-tooltip-style {
    background-color: #212529; /* Dark background */
    color: white;
    padding: 8px 12px; /* Internal padding */
    border-radius: 6px; /* Rounded corners */
    font-size: 0.8rem; /* 12.8px */
    line-height: 1.4; /* Readability */
    white-space: nowrap; /* Default one line */
    z-index: 1000000; /* Ensure it's on top of almost everything */
    pointer-events: none; /* Tooltip itself should not capture mouse events */
    box-shadow: 0 2px 5px rgba(0,0,0,0.2); /* Optional shadow */
    /* Transitions can be added if desired, but JS controls visibility */
    /* transition: opacity 0.15s ease-in-out; */
  }
  
  .global-tooltip-style.multiline {
    white-space: normal; /* Allow wrapping */
    min-width: 150px; /* Optional: minimum width */
    max-width: 250px; /* Optional: maximum width */
    text-align: left; /* Better for multiline text */
  }
  </style>