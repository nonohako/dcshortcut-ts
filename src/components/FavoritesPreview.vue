<template>
    <!--
      v-if를 사용하여 isVisible 상태에 따라 컴포넌트 전체의 렌더링 여부를 결정합니다.
      settingsStore의 투명도 값을 동적으로 바인딩합니다.
    -->
    <div
      v-if="isVisible"
      class="favorites-preview-container"
      :style="{ opacity: settingsStore.favoritesPreviewOpacity }"
    >
      <h4 class="preview-title">{{ favoritesStore.activeFolderName }}</h4>
      
      <!-- 정렬된 즐겨찾기 목록을 표시합니다. -->
      <ul class="preview-list">
        <li v-for="gallery in shortcutFavorites" :key="gallery.id" class="preview-item">
          <span class="preview-key">{{ formatShortcut(gallery.shortcut) }}:</span>
          <span class="preview-name">{{ gallery.name || gallery.galleryId }}</span>
        </li>
        <!-- 즐겨찾기가 하나도 없을 경우 메시지를 표시합니다. -->
        <li v-if="shortcutFavorites.length === 0" class="preview-item-empty">
          숫자 단축키 없음
        </li>
      </ul>
    </div>
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue';
  import { storeToRefs } from 'pinia';
  import { useUiStore } from '@/stores/uiStore';
  import { useFavoritesStore } from '@/stores/favoritesStore';
  import type { FavoriteItem } from '@/types';
  import { useSettingsStore } from '@/stores/settingsStore';
  
  // =================================================================
  // Store Initialization (스토어 초기화)
  // =================================================================
  
  // UI, 즐겨찾기, 설정 관련 Pinia 스토어를 초기화합니다.
  const uiStore = useUiStore();
  const favoritesStore = useFavoritesStore();
  const settingsStore = useSettingsStore();
  
  
  // =================================================================
  // Reactive State from Stores (스토어에서 반응형 상태 가져오기)
  // =================================================================
  
  // storeToRefs를 사용하여 스토어의 상태를 반응성을 유지하는 ref로 가져옵니다.
  // isFavoritesPreviewVisible: 이 컴포넌트의 표시 여부를 제어합니다.
  const { isFavoritesPreviewVisible: isVisible } = storeToRefs(uiStore);
  // activeFavorites: 현재 활성화된 폴더의 즐겨찾기 목록입니다.
  const { activeFavorites } = storeToRefs(favoritesStore);
  
  
  // =================================================================
  // Computed Properties (계산된 속성)
  // =================================================================
  
  const shortcutFavorites = computed<FavoriteItem[]>(() =>
    activeFavorites.value
      .filter((favorite) => favorite.shortcut !== null)
      .sort((a, b) => {
        const aIsNumber = /^[0-9]$/.test(a.shortcut ?? '');
        const bIsNumber = /^[0-9]$/.test(b.shortcut ?? '');
        if (aIsNumber && bIsNumber) return Number(a.shortcut) - Number(b.shortcut);
        if (aIsNumber !== bIsNumber) return aIsNumber ? -1 : 1;
        return (a.shortcut ?? '').localeCompare(b.shortcut ?? '', 'en');
      })
  );

  const formatShortcut = (shortcut: string | null): string =>
    shortcut && /^[0-9]$/.test(shortcut) ? `Alt+${shortcut}` : shortcut ?? '';
  </script>
  
  <style scoped>
  /* 스타일은 변경되지 않았으므로 여기에 그대로 유지됩니다. */
  .favorites-preview-container {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background-color: var(--dc-color-preview-bg);
    color: var(--dc-color-preview-text);
    border: 1px solid var(--dc-color-preview-border);
    border-radius: 12px;
    padding: 12px 16px;
    width: 280px;
    z-index: 99999;
    pointer-events: none; /* 컨테이너 아래의 요소 클릭이 가능하도록 설정 */
    font-family: 'Roboto', sans-serif;
    box-shadow: var(--dc-shadow-medium);
    backdrop-filter: blur(5px);
    transition: opacity 0.15s ease-in-out;
  }
  
  .preview-title {
    font-size: 16px;
    font-weight: 500;
    color: var(--dc-color-text-primary);
    margin: 0 0 10px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--dc-color-preview-border);
    text-align: center;
  }
  
  .preview-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow: hidden;
  }
  
  .preview-item {
    display: flex;
    font-size: 14.5px;
    padding: 4px 0;
    white-space: nowrap;
  }
  
  .preview-key {
    font-weight: 500;
    color: var(--dc-color-preview-key); /* 키를 강조하는 밝은 색상 */
    margin-right: 8px;
    min-width: 25px;
  }
  
  .preview-name {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis; /* 이름이 길 경우 ...으로 표시 */
    color: var(--dc-color-preview-text);
  }
  
  .preview-item-empty {
    color: var(--dc-color-text-subtle);
    text-align: center;
    padding: 10px 0;
  }
  </style>
