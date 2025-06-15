<template>
    <div class="shortcut-toggle">
      <!-- 접두사 (예: 'Alt +')가 있으면 표시 -->
      <span v-if="prefix" class="shortcut-toggle-prefix">{{ prefix }}</span>
  
      <!-- 단축키 기능 설명 라벨 -->
      <span class="shortcut-toggle-label">
        {{ label }}
        <!-- 매크로 단축키일 경우, 툴팁을 표시하는 각주 트리거 컴포넌트 포함 -->
        <FootnoteTrigger
          v-if="isMacro && tooltipText"
          :tooltip-text="tooltipText"
          style="margin-left: 6px;"
        />
      </span>
  
      <!-- isMacro가 아니고 키 수정이 가능할 때만 키 입력 필드 렌더링 -->
      <input
        v-if="!isMacro && isKeyEditable"
        type="text"
        class="shortcut-toggle-input"
        :value="currentKeyDisplay"
        maxlength="1"
        @keydown="handleKeydown"
        @blur="handleInputBlur"
        placeholder="키"
      />
  
      <!-- 활성화/비활성화 토글 스위치 -->
      <label class="switch">
        <input
          type="checkbox"
          :checked="enabled"
          @change="handleEnabledChange"
        />
        <span class="slider"></span>
      </label>
  
      <!-- 매크로 단축키일 경우, 브라우저 설정 페이지로 이동하는 링크 표시 -->
      <span
        v-if="isMacro"
        @click="openShortcutsPage"
        class="change-shortcut-link"
        title="브라우저 단축키 설정 페이지 열기"
        role="button"
        tabindex="0"
      >
        변경
      </span>
    </div>
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue';
  import UI from '@/services/UI'; // UI 유틸리티 모듈 (showAlert 등)
  import FootnoteTrigger from './FootnoteTrigger.vue'; // 각주/툴팁 컴포넌트
  
  // =================================================================
  // Type Definitions (타입 정의)
  // =================================================================
  
  /**
   * @interface ShortcutToggleProps
   * @description 이 컴포넌트가 받는 props의 타입을 정의합니다.
   */
   interface ShortcutToggleProps {
  label: string;
  enabled: boolean;
  // [수정] 키 수정이 불가능한 토글에서는 이 prop들이 없을 수 있으므로 옵셔널로 변경
  storageKeyEnabled?: string;
  storageKeyKey?: string;
  currentKey?: string;
  isMacro?: boolean;
  prefix?: string;
  tooltipText?: string;
  isKeyEditable?: boolean;
}
  
  // =================================================================
  // Emits Definition (이벤트 정의)
  // =================================================================
  
  /**
   * @description 컴포넌트가 발생시키는 이벤트를 정의합니다.
   * 'update:enabled': 활성화 토글 스위치 상태 변경 시 발생
   * 'update:key': 단축키 입력 필드에서 유효한 키 입력 시 발생
   */
   const emit = defineEmits<{
  // [수정] storageKey가 undefined일 수 있음을 반영
  (e: 'update:enabled', storageKey: string | undefined, value: boolean, label: string): void;
  (e: 'update:key', storageKey: string | undefined, newKey: string, label: string): void;
}>();
  
  
  // =================================================================
  // Props and State (Props 및 상태)
  // =================================================================
  
  /**
   * @description `defineProps`와 `withDefaults`를 사용하여 props를 정의하고 기본값을 설정합니다.
   */
   const props = withDefaults(defineProps<ShortcutToggleProps>(), {
  isMacro: false,
  prefix: '',
  tooltipText: '',
  isKeyEditable: true,
  currentKey: '',
  storageKeyEnabled: '', // 기본값은 빈 문자열
  storageKeyKey: '',     // 기본값은 빈 문자열
});
  
  /**
   * @description 입력 필드에 표시될 키 값을 계산합니다. props.currentKey가 없으면 빈 문자열을 반환합니다.
   */
   const currentKeyDisplay = computed(() => props.currentKey || '');
  
  
  // =================================================================
  // Event Handlers (이벤트 핸들러)
  // =================================================================
  
  /**
   * 키 입력 필드에서 키를 누를 때 호출됩니다.
   * @param {KeyboardEvent} e - 키보드 이벤트 객체.
   */
   const handleKeydown = (e: KeyboardEvent): void => {
  e.preventDefault();
  e.stopPropagation();
  if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key)) {
    e.preventDefault(); // 기본 동작도 막음
    return;
  }
  const newKey = e.key;
  const newKeyUpper = newKey.toUpperCase();
  if (newKey.length === 1 && /^[A-Z0-9\[\]`]$/.test(newKeyUpper)) {
    // [수정] storageKeyKey가 있을 때만 emit
    if (props.storageKeyKey) {
        emit('update:key', props.storageKeyKey, newKeyUpper, props.label);
    }
    const target = e.target as HTMLInputElement;
    target.value = '';
    target.blur();
  } else if (newKey.length === 1) {
    UI.showAlert("단축키는 영문(A-Z), 숫자(0-9), 특수문자([, ], `)만 가능합니다.");
    (e.target as HTMLInputElement).value = '';
  }
};
  
  /**
   * 키 입력 필드에서 포커스가 해제될 때 호출됩니다. (현재 특별한 동작 없음)
   * @param {FocusEvent} e - 포커스 이벤트 객체.
   */
   const handleInputBlur = (e: FocusEvent): void => {
    // 사용자가 입력 필드를 비우고 포커스를 잃었을 때의 동작을 여기에 추가할 수 있습니다.
    // 현재는 별도 처리 없이 그대로 둡니다.
  };
  
  /**
   * 토글 스위치의 상태가 변경될 때 호출됩니다.
   * @param {Event} e - 변경 이벤트 객체.
   */
   const handleEnabledChange = (e: Event): void => {
  const target = e.target as HTMLInputElement;
  // [수정] storageKeyEnabled가 있을 때만 emit
  if (props.storageKeyEnabled) {
      emit('update:enabled', props.storageKeyEnabled, target.checked, props.label);
  }
};
  
  /**
   * '변경' 링크 클릭 시, 백그라운드 스크립트에 메시지를 보내 브라우저 단축키 설정 페이지를 엽니다.
   */
   const openShortcutsPage = (): void => {
  chrome.runtime.sendMessage({ action: 'openShortcutsPage' });
};
  </script>
  
  <style scoped>
  /* 스타일은 변경되지 않았으므로 여기에 그대로 유지됩니다. */
  .shortcut-toggle {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background-color: #fff;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    gap: 10px;
  }
  
  .shortcut-toggle-prefix {
    font-size: 0.85rem;
    font-weight: 500;
    color: #6c757d;
    min-width: 50px;
    text-align: right;
    flex-shrink: 0;
  }
  
  .shortcut-toggle-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #343a40;
    flex-grow: 1;
    display: inline-flex;
    align-items: center;
  }
  
  .shortcut-toggle-input {
    width: 40px;
    padding: 6px 8px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 0.85rem;
    outline: none;
    text-align: center;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    flex-shrink: 0;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  
  .shortcut-toggle-input::placeholder {
    color: #adb5bd;
  }
  
  .shortcut-toggle-input:focus {
    border-color: #0d6efd;
    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
  }
  
  .switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
    margin-left: auto;
  }
  
  .shortcut-toggle-input + .switch {
      margin-left: 8px;
  }
  
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #adb5bd;
    border-radius: 22px;
    transition: .2s;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: .2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  
  input:checked+.slider {
    background-color: #0d6efd;
  }
  
  input:checked+.slider:before {
    transform: translateX(18px);
  }
  
  .change-shortcut-link {
    background-color: #e9ecef;
    border: 1px solid #ced4da;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 0.8rem;
    color: #212529;
    text-decoration: none;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
    margin-left: 8px;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }
  
  .change-shortcut-link:hover {
    background-color: #dee2e6;
    border-color: #adb5bd;
  }
  </style>