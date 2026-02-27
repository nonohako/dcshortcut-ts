<template>
    <div class="favorites-container" v-show="isVisible">
      <!-- 프로필 관리 섹션 -->
      <div class="profile-management">
        <select class="profile-select" :value="activeProfileName" @change="handleProfileChange">
          <option v-for="name in profileNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
        <div class="profile-actions">
          <button class="profile-action-btn" @click="handleAddNewProfile" title="새 프로필 추가">+</button>
          <button class="profile-action-btn" @click="startEditingProfileName" title="현재 프로필 이름 변경">✎</button>
          <button class="profile-action-btn danger" @click="handleRemoveCurrentProfile" title="현재 프로필 삭제">🗑</button>
        </div>
      </div>
  
      <!-- 제목 (일반 모드/이름 수정 모드) -->
      <div class="title-container">
        <h3 v-if="!isEditingProfileName" class="shortcut-title">{{ activeProfileName }} 즐겨찾기</h3>
        <input
          v-else
          ref="profileNameInputRef"
          type="text"
          class="shortcut-title-input"
          v-model="editedProfileName"
          @keyup.enter="handleRenameProfile"
          @blur="handleRenameProfile"
          @keyup.esc="cancelEditingProfileName"
        />
      </div>
  
      <!-- 즐겨찾기 목록 -->
      <ul class="favorites-list" v-if="profiles !== null">
        <template v-if="Object.keys(activeFavorites).length > 0">
          <li v-for="(gallery, key) in sortedFavorites" :key="key" class="favorite-item" @click="navigateTo(gallery)">
            <span class="favorite-name">{{ key }}: {{ gallery.name || gallery.galleryId || 'Unknown' }}</span>
            <button class="favorite-remove" @click.stop="remove(key)">✕</button>
          </li>
        </template>
        <li v-else class="favorite-item-empty">
          이 프로필에 등록된 즐겨찾기가 없습니다.
        </li>
      </ul>
      <div v-else class="favorites-loading">
        즐겨찾기 목록을 불러오는 중...
      </div>
  
      <div class="shortcut-divider"></div>
  
      <!-- 현재 갤러리 추가 섹션 -->
      <div class="add-favorite">
        <input type="text" class="add-favorite-input" placeholder="0-9" maxlength="1" v-model="newFavoriteKey"
          @keyup.enter="addCurrentGallery" @input="validateInput" />
        <button class="add-favorite-button" @click="addCurrentGallery">
          현재 갤러리 추가
        </button>
      </div>
  
      <!-- 하단 버튼 -->
      <button class="dc-button dc-button-green" @click="openShortcutManager">
        설정
      </button>
      <button class="dc-button" @click="closeModal">
        닫기
      </button>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, onMounted, nextTick, type Ref, type ComputedRef } from 'vue';
  import { storeToRefs } from 'pinia';
  import { useFavoritesStore } from '@/stores/favoritesStore';
  import { useUiStore } from '@/stores/uiStore';
  import Gallery from '@/services/Gallery';
  import UI from '@/services/UI';
  import type { FavoriteGalleries, FavoriteGalleryInfo } from '@/types';
  
  // =================================================================
  // Store Initialization and State (스토어 초기화 및 상태)
  // =================================================================
  const favoritesStore = useFavoritesStore();
  const uiStore = useUiStore();
  
  // storeToRefs를 사용하여 스토어의 상태를 반응형으로 가져옵니다.
  const { profiles, activeProfileName, activeFavorites } = storeToRefs(favoritesStore);
  // 스토어의 액션들을 구조 분해 할당으로 가져옵니다.
  const { loadProfiles, addOrUpdateFavorite, removeFavorite, switchProfile, addProfile, removeProfile, renameProfile } = favoritesStore;
  
  // =================================================================
  // Component Internal State (컴포넌트 내부 상태)
  // =================================================================
  const newFavoriteKey = ref<string>('');
  const isVisible = ref<boolean>(false);
  const isEditingProfileName = ref<boolean>(false);
  const editedProfileName = ref<string>('');
  const profileNameInputRef = ref<HTMLInputElement | null>(null);
  
  // =================================================================
  // Computed Properties (계산된 속성)
  // =================================================================
  /**
   * @description 현재 활성화된 즐겨찾기 목록을 키(숫자) 순서로 정렬합니다.
   */
  const sortedFavorites: ComputedRef<FavoriteGalleries> = computed(() => {
    if (activeFavorites.value && typeof activeFavorites.value === 'object') {
      return Object.entries(activeFavorites.value)
        .sort(([keyA], [keyB]) => parseInt(keyA, 10) - parseInt(keyB, 10))
        .reduce((obj: FavoriteGalleries, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});
    }
    return {};
  });
  
  /**
   * @description 프로필 목록의 이름들을 배열로 반환합니다.
   */
  const profileNames: ComputedRef<string[]> = computed(() => (profiles.value ? Object.keys(profiles.value) : []));
  
  // =================================================================
  // Functions (함수)
  // =================================================================
  
  /**
   * @description 프로필 선택 드롭다운 변경 시 호출됩니다.
   */
  const handleProfileChange = async (event: Event): Promise<void> => {
    const target = event.target as HTMLSelectElement;
    await switchProfile(target.value);
  };
  
  /**
   * @description 새 프로필 추가 버튼 클릭 시 호출됩니다.
   */
  const handleAddNewProfile = async (): Promise<void> => {
    const newName = window.prompt('추가할 새 프로필의 이름을 입력하세요:');
    if (newName) {
      try {
        await addProfile(newName);
        UI.showAlert(`'${newName}' 프로필이 추가되었습니다.`);
      } catch (error) {
        if (error instanceof Error) UI.showAlert(`오류: ${error.message}`);
      }
    }
  };
  
  /**
   * @description 현재 프로필 삭제 버튼 클릭 시 호출됩니다.
   */
  const handleRemoveCurrentProfile = async (): Promise<void> => {
    if (window.confirm(`'${activeProfileName.value}' 프로필을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      try {
        await removeProfile(activeProfileName.value);
        UI.showAlert('프로필이 삭제되었습니다.');
      } catch (error) {
        if (error instanceof Error) UI.showAlert(`오류: ${error.message}`);
      }
    }
  };
  
  /**
   * @description 프로필 이름 수정 모드를 시작합니다.
   */
  const startEditingProfileName = async (): Promise<void> => {
    isEditingProfileName.value = true;
    editedProfileName.value = activeProfileName.value;
    await nextTick(); // DOM 업데이트를 기다린 후
    profileNameInputRef.value?.focus(); // input 요소에 포커스
  };
  
  /**
   * @description 프로필 이름 변경을 적용합니다. (Enter 또는 blur 시)
   */
  const handleRenameProfile = async (): Promise<void> => {
    if (!isEditingProfileName.value) return;
  
    const oldName = activeProfileName.value;
    const newName = editedProfileName.value.trim();
  
    isEditingProfileName.value = false;
  
    if (newName && oldName !== newName) {
      try {
        await renameProfile(oldName, newName);
        UI.showAlert('프로필 이름이 변경되었습니다.');
      } catch (error) {
        if (error instanceof Error) UI.showAlert(`오류: ${error.message}`);
      }
    }
  };
  
  /**
   * @description 프로필 이름 변경을 취소합니다. (ESC 키)
   */
  const cancelEditingProfileName = (): void => {
    isEditingProfileName.value = false;
  };
  
  /**
   * @description 즐겨찾기 항목 클릭 시 해당 갤러리로 이동합니다.
   */
  const navigateTo = (gallery: FavoriteGalleryInfo): void => {
    // FavoriteGalleryInfo는 galleryId와 galleryType을 포함해야 함
    // Storage.ts의 GalleryInfo와 호환되어야 함
    if ('galleryId' in gallery && 'galleryType' in gallery) {
        UI.navigateToGallery(gallery as any); // 타입 단언
        uiStore.closeModal();
    }
  };
  
  /**
   * @description 즐겨찾기 항목을 삭제합니다.
   */
   const remove = async (key: string) => { // [수정] key 타입을 명시적으로 string으로 지정
    await removeFavorite(key);
  };
  
  /**
   * @description 현재 페이지의 갤러리를 즐겨찾기에 추가합니다.
   */
  const addCurrentGallery = async (): Promise<void> => {
    const key = newFavoriteKey.value;
    if (!/^[0-9]$/.test(key)) {
      UI.showAlert('0부터 9까지의 숫자를 입력해주세요.');
      return;
    }
    const currentGalleryInfo = Gallery.getInfo();
    if (currentGalleryInfo.galleryId && currentGalleryInfo.galleryType) {
      try {
        // addOrUpdateFavorite 액션은 FavoriteGalleryInfo 타입을 기대합니다.
        await addOrUpdateFavorite(key, {
        galleryType: currentGalleryInfo.galleryType as 'board' | 'mgallery' | 'mini',
        galleryId: currentGalleryInfo.galleryId,
        name: currentGalleryInfo.galleryName,
    });
        UI.showAlert(`'${activeProfileName.value}' 프로필에 즐겨찾기가 추가되었습니다.`);
        newFavoriteKey.value = '';
      } catch (error) {
        console.error("즐겨찾기 추가 중 오류:", error);
        UI.showAlert("즐겨찾기 추가 중 오류가 발생했습니다.");
      }
    } else {
      UI.showAlert('갤러리 정보를 가져올 수 없습니다. (갤러리 페이지인지 확인)');
    }
  };
  
  /**
   * @description 입력 필드에 숫자만 입력되도록 유효성을 검사합니다.
   */
  const validateInput = (): void => {
    newFavoriteKey.value = newFavoriteKey.value.replace(/[^0-9]/g, '');
  };
  
  const closeModal = (): void => uiStore.closeModal();
  const openShortcutManager = (): void => uiStore.openShortcutManagerModal();
  
  // =================================================================
  // Lifecycle Hooks (라이프사이클 훅)
  // =================================================================
  onMounted(() => {
    console.log('[FavoritesModal] 마운트됨. 프로필 로드를 시작합니다...');
    loadProfiles(); // 컴포넌트 마운트 시 프로필 데이터 로드
    requestAnimationFrame(() => { isVisible.value = true; }); // 부드러운 등장을 위해
  });
  </script>
  
  <style scoped>
  /* FavoritesModal.vue에만 적용될 스타일 */
  .favorites-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--dc-color-surface);
    padding: 20px;
    border-radius: 16px;
    box-shadow: var(--dc-shadow-strong);
    z-index: 10000;
    width: 380px; /* 너비 약간 증가 */
    max-height: 85vh;
    display: flex; /* Flexbox 레이아웃 */
    flex-direction: column; /* 세로 방향 */
    font-family: 'Roboto', sans-serif;
    border: 1px solid var(--dc-color-border);
    transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
    opacity: 1;
  }
  
  /* --- NEW: Profile Management Styles --- */
  .profile-management {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
    flex-shrink: 0; /* 크기 고정 */
  }
  .profile-select {
    flex-grow: 1;
    padding: 8px 12px;
    font-size: 15px;
    border: 1px solid var(--dc-color-border);
    border-radius: 8px;
    background-color: var(--dc-color-surface-muted);
    color: var(--dc-color-text-primary);
    outline: none;
    cursor: pointer;
  }
  .profile-select:focus {
    border-color: var(--dc-color-primary);
  }
  .profile-actions {
    display: flex;
    gap: 5px;
  }
  .profile-action-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--dc-color-border);
    background-color: var(--dc-color-surface);
    color: var(--dc-color-text-muted);
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .profile-action-btn:hover {
    background-color: var(--dc-color-surface-hover);
    color: var(--dc-color-text-primary);
  }
  .profile-action-btn.danger:hover {
    background-color: var(--dc-color-danger-bg);
    color: var(--dc-color-danger);
  }
  
  /* --- MODIFIED: Title Styles --- */
  .title-container {
    padding-bottom: 10px;
    border-bottom: 1px solid var(--dc-color-border);
    margin-bottom: 15px;
    flex-shrink: 0;
  }
  .shortcut-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--dc-color-text-primary);
    margin: 0;
  }
  .shortcut-title-input {
    width: 100%;
    font-size: 18px;
    font-weight: 700;
    color: var(--dc-color-text-primary);
    border: none;
    border-bottom: 2px solid var(--dc-color-primary);
    padding: 0;
    outline: none;
    background: transparent;
  }
  
  
  /* 즐겨찾기 목록 (스크롤 영역) */
  .favorites-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto; /* 스크롤 활성화 */
    flex-grow: 1; /* 남은 공간 모두 차지 */
  }
  
  .favorite-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 15px;
    margin: 5px 0;
    background-color: var(--dc-color-surface-subtle);
    border-radius: 10px;
    transition: background-color 0.2s ease;
    cursor: pointer;
  }
  .favorite-item:hover {
    background-color: var(--dc-color-surface-hover);
  }
  .favorite-item-empty {
    padding: 20px;
    text-align: center;
    color: var(--dc-color-text-muted);
    font-size: 14px;
  }
  .favorite-name {
    font-size: 15px;
    font-weight: 400;
    color: var(--dc-color-text-secondary);
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 10px;
  }
  .favorite-remove {
    background-color: transparent;
    color: var(--dc-color-text-muted);
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease;
    flex-shrink: 0;
  }
  .favorite-remove:hover {
    color: var(--dc-color-danger);
    background-color: var(--dc-color-danger-bg);
  }
  
  /* 구분선 스타일 */
  .shortcut-divider {
    height: 1px;
    background-color: var(--dc-color-border);
    margin: 15px 0;
    border: none;
    flex-shrink: 0;
  }
  
  /* 즐겨찾기 추가 영역 */
  .add-favorite {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0 0 15px 0; /* margin-top 제거 */
    padding: 15px;
    background-color: var(--dc-color-surface-muted);
    border-radius: 10px;
    flex-shrink: 0;
  }
  .add-favorite-input {
    width: 45px;
    padding: 8px;
    border: 1px solid var(--dc-color-border);
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
    outline: none;
    transition: border-color 0.2s ease;
    background-color: var(--dc-color-surface);
    color: var(--dc-color-text-primary);
  }
  .add-favorite-input:focus {
    border-color: var(--dc-color-primary);
  }
  .add-favorite-button {
    padding: 8px 16px;
    background-color: var(--dc-color-primary);
    color: var(--dc-color-tooltip-text);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
    flex-grow: 1;
  }
  .add-favorite-button:hover {
    background-color: var(--dc-color-primary-hover);
  }
  
  /* 공통 버튼 스타일 (닫기, 단축키 관리 버튼) */
  .dc-button {
    display: block;
    width: 100%;
    padding: 10px;
    margin-top: 10px;
    background-color: var(--dc-color-primary);
    color: var(--dc-color-tooltip-text);
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
    text-align: center;
    flex-shrink: 0;
  }
  .dc-button:first-of-type {
      margin-top: 0;
  }
  .dc-button:hover {
    background-color: var(--dc-color-primary-hover);
  }
  .dc-button-green {
    background-color: var(--dc-color-success);
  }
  .dc-button-green:hover {
    background-color: var(--dc-color-success-hover);
  }
  </style>
