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
      <!-- 활성 프로필 이름을 제목으로 표시합니다. -->
      <h4 class="preview-title">{{ favoritesStore.activeProfileName }}</h4>
      
      <!-- 정렬된 즐겨찾기 목록을 표시합니다. -->
      <ul class="preview-list">
        <li v-for="(gallery, key) in sortedFavorites" :key="key" class="preview-item">
          <span class="preview-key">{{ key }}:</span>
          <span class="preview-name">{{ gallery.name || gallery.galleryId }}</span>
        </li>
        <!-- 즐겨찾기가 하나도 없을 경우 메시지를 표시합니다. -->
        <li v-if="Object.keys(sortedFavorites).length === 0" class="preview-item-empty">
          즐겨찾기 없음
        </li>
      </ul>
    </div>
  </template>
  
  <script setup lang="ts">
  import { computed, type ComputedRef } from 'vue';
  import { storeToRefs } from 'pinia';
  import { useUiStore } from '@/stores/uiStore';
  import { useFavoritesStore, type FavoriteGalleries, type FavoriteGalleryInfo } from '@/stores/favoritesStore';
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
  // activeFavorites: 현재 활성화된 프로필의 즐겨찾기 목록입니다.
  const { activeFavorites } = storeToRefs(favoritesStore);
  
  
  // =================================================================
  // Computed Properties (계산된 속성)
  // =================================================================
  
  /**
   * @description 활성 프로필의 즐겨찾기 목록을 숫자 키(1, 2, 3...) 순서로 정렬하여 반환합니다.
   * @returns {ComputedRef<FavoriteGalleries>} 정렬된 즐겨찾기 목록 객체.
   */
  const sortedFavorites: ComputedRef<FavoriteGalleries> = computed(() => {
    // activeFavorites.value가 유효한 객체인지 확인합니다.
    if (activeFavorites.value && typeof activeFavorites.value === 'object') {
      // 1. Object.entries: 객체를 [key, value] 쌍의 배열로 변환합니다.
      // 2. sort: 키(keyA)를 숫자로 변환하여 오름차순으로 정렬합니다.
      // 3. reduce: 정렬된 배열을 다시 객체 형태로 변환합니다.
      return Object.entries(activeFavorites.value)
        .sort(([keyA], [keyB]) => parseInt(keyA, 10) - parseInt(keyB, 10))
        .reduce((obj: FavoriteGalleries, [key, value]: [string, FavoriteGalleryInfo]) => {
          obj[key] = value;
          return obj;
        }, {} as FavoriteGalleries); // 초기값으로 빈 FavoriteGalleries 객체를 제공합니다.
    }
    // 유효하지 않은 경우 빈 객체를 반환합니다.
    return {};
  });
  </script>
  
  <style scoped>
  /* 스타일은 변경되지 않았으므로 여기에 그대로 유지됩니다. */
  .favorites-preview-container {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background-color: rgba(20, 20, 20, 0.9);
    color: #f0f0f0;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 12px 16px;
    width: 280px;
    z-index: 99999;
    pointer-events: none; /* 컨테이너 아래의 요소 클릭이 가능하도록 설정 */
    font-family: 'Roboto', sans-serif;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(5px);
    transition: opacity 0.15s ease-in-out;
  }
  
  .preview-title {
    font-size: 1rem;
    font-weight: 500;
    color: #ffffff;
    margin: 0 0 10px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
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
    font-size: 0.9rem;
    padding: 4px 0;
    white-space: nowrap;
  }
  
  .preview-key {
    font-weight: 500;
    color: #ffc107; /* 키를 강조하는 밝은 색상 */
    margin-right: 8px;
    min-width: 25px;
  }
  
  .preview-name {
    flex-grow: 1;
    overflow: hidden;
    text-overflow: ellipsis; /* 이름이 길 경우 ...으로 표시 */
    color: #e0e0e0;
  }
  
  .preview-item-empty {
    color: #888;
    text-align: center;
    padding: 10px 0;
  }
  </style>