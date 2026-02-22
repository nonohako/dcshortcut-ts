import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import Storage from '@/services/Storage';
// [수정] FAVORITE_GALLERIES_KEY를 import 합니다.
import { ACTIVE_FAVORITES_PROFILE_KEY, FAVORITE_GALLERIES_KEY } from '@/services/Global';
import type { FavoriteGalleries, FavoriteGalleryInfo, FavoriteProfiles } from '@/types';

export type { FavoriteGalleries, FavoriteGalleryInfo, FavoriteProfiles };

export const useFavoritesStore = defineStore('favorites', () => {
  // --- STATE (상태) ---

  /**
   * @description 모든 즐겨찾기 프로필 데이터를 담는 객체.
   * 초기값은 null이며, loadProfiles()를 통해 로드된 후 FavoriteProfiles 타입의 객체를 가집니다.
   */
  const profiles = ref<FavoriteProfiles | null>(null);

  /**
   * @description 현재 활성화된 프로필의 이름.
   */
  const activeProfileName = ref<string>('기본');

  // --- COMPUTED (계산된 속성) ---

  /**
   * @description 현재 활성화된 프로필에 해당하는 즐겨찾기 목록만 반환합니다.
   * 활성 프로필이 존재하지 않을 경우, 빈 객체를 반환하여 오류를 방지합니다.
   */
  const activeFavorites = computed<FavoriteGalleries>(() => {
    if (profiles.value && profiles.value[activeProfileName.value]) {
      return profiles.value[activeProfileName.value];
    }
    return {}; // 안전하게 빈 객체 반환
  });

  // --- HELPERS (헬퍼 함수) ---

  /**
   * @description profiles 상태가 로드되었는지 확인하고, 로드되지 않았다면 로드를 시도합니다.
   * 다른 액션 함수들이 데이터에 접근하기 전에 호출하여 데이터 무결성을 보장합니다.
   * @throws {Error} 프로필 데이터 로딩에 실패하면 에러를 발생시킵니다.
   */
  async function ensureProfilesLoaded(): Promise<void> {
    if (profiles.value === null) {
      console.log('[Pinia Fav Ensure] 상태가 null이므로 로드를 시도합니다...');
      await loadProfiles();
      // 로드 후에도 null이면 로딩 실패로 간주
      if (profiles.value === null) {
        console.error('[Pinia Fav Ensure] 프로필 로딩에 실패했습니다.');
        throw new Error('즐겨찾기 데이터를 불러오지 못했습니다.');
      }
      console.log('[Pinia Fav Ensure] 프로필이 성공적으로 로드되었습니다.');
    }
  }

  // --- ACTIONS (액션) ---

  /**
   * Storage에서 즐겨찾기 데이터를 불러와 profiles 상태를 설정합니다.
   * 구 버전의 데이터 형식을 감지하면 새로운 프로필 구조로 마이그레이션합니다.
   */
  async function loadProfiles(): Promise<void> {
    console.log('[Pinia Fav Load] 프로필 로드를 시도합니다...');
    try {
      // [핵심 수정] 올바른 스토리지 키(FAVORITE_GALLERIES_KEY)를 사용하여 전체 프로필 데이터를 가져옵니다.
      const loadedData = (await Storage.getData(FAVORITE_GALLERIES_KEY, {})) as unknown;
      // 활성 프로필 이름은 별도의 키로 가져옵니다.
      const loadedActiveProfile = await Storage.getData(ACTIVE_FAVORITES_PROFILE_KEY, '기본');

      if (!loadedData || typeof loadedData !== 'object' || Object.keys(loadedData).length === 0) {
        profiles.value = { 기본: {} };
      } else {
        const keys = Object.keys(loadedData);
        const isOldFormat = keys.length > 0 && keys.every((key) => /^[0-9]$/.test(key));

        if (isOldFormat) {
          console.warn(
            '[Pinia Fav Load] 구 버전 즐겨찾기 데이터를 발견했습니다. 새 프로필 형식으로 마이그레이션합니다...'
          );
          profiles.value = { 기본: loadedData as FavoriteGalleries };
          await saveProfiles();
          console.log('[Pinia Fav Load] 마이그레이션 완료 및 저장 성공.');
        } else {
          profiles.value = loadedData as FavoriteProfiles;
        }
      }

      if (profiles.value && profiles.value.hasOwnProperty(loadedActiveProfile)) {
        activeProfileName.value = loadedActiveProfile;
      } else {
        activeProfileName.value = '기본';
        await Storage.setData(ACTIVE_FAVORITES_PROFILE_KEY, '기본');
      }

      console.log(`[Pinia Fav Load] 프로필 로딩 성공. 활성 프로필: ${activeProfileName.value}`);
    } catch (error) {
      console.error('[Pinia Fav Load] 프로필 로딩 중 오류 발생:', error);
      profiles.value = { 기본: {} };
    }
  }

  async function saveProfiles(): Promise<void> {
    if (profiles.value === null) {
      throw new Error('null 상태의 프로필은 저장할 수 없습니다.');
    }
    await Storage.saveFavorites(profiles.value);
  }

  /**
   * 현재 활성화된 프로필에 즐겨찾기를 추가하거나 업데이트합니다.
   * @param {string} key - 갤러리 ID
   * @param {FavoriteGalleryInfo} galleryData - 저장할 갤러리 정보 (예: { name: '갤러리 이름' })
   */
  async function addOrUpdateFavorite(key: string, galleryData: FavoriteGalleryInfo): Promise<void> {
    try {
      await ensureProfilesLoaded();
      // ensureProfilesLoaded 이후 profiles.value는 null이 아님을 단언(!)
      const currentProfile = profiles.value![activeProfileName.value] || {};
      const updatedProfile = { ...currentProfile, [key]: galleryData };
      profiles.value = { ...profiles.value!, [activeProfileName.value]: updatedProfile };
      await saveProfiles();
    } catch (error) {
      console.error('[Pinia Fav Add/Update] 실패:', error);
      throw error;
    }
  }

  /**
   * 현재 활성화된 프로필에서 특정 즐겨찾기를 삭제합니다.
   * @param {string} key - 삭제할 갤러리 ID
   */
  async function removeFavorite(key: string): Promise<void> {
    try {
      await ensureProfilesLoaded();
      const currentProfile = profiles.value![activeProfileName.value];
      if (!currentProfile || !currentProfile[key]) return;

      const newProfile = { ...currentProfile };
      delete newProfile[key];
      profiles.value = { ...profiles.value!, [activeProfileName.value]: newProfile };
      await saveProfiles();
    } catch (error) {
      console.error('[Pinia Fav Remove] 실패:', error);
      throw error;
    }
  }

  /**
   * 현재 활성화된 프로필에 특정 즐겨찾기가 있는지 확인합니다.
   * @param {string} key - 확인할 갤러리 ID
   * @returns {Promise<boolean>} 존재 여부
   */
  async function hasFavorite(key: string): Promise<boolean> {
    try {
      await ensureProfilesLoaded();
      const currentProfile = profiles.value![activeProfileName.value];
      return currentProfile ? currentProfile.hasOwnProperty(key) : false;
    } catch (error) {
      console.error(`[Pinia Fav Has] 키 '${key}' 확인 중 오류:`, error);
      return false;
    }
  }

  /**
   * 현재 활성화된 프로필에서 특정 즐겨찾기 정보를 가져옵니다.
   * @param {string} key - 가져올 갤러리 ID
   * @returns {Promise<FavoriteGalleryInfo | null>} 갤러리 정보 또는 null
   */
  async function getFavorite(key: string): Promise<FavoriteGalleryInfo | null> {
    try {
      await ensureProfilesLoaded();
      const currentProfile = profiles.value![activeProfileName.value];
      return currentProfile ? currentProfile[key] || null : null;
    } catch (error) {
      console.error(`[Pinia Fav Get] 키 '${key}' 가져오는 중 오류:`, error);
      return null;
    }
  }

  /**
   * 제공된 데이터로 모든 프로필을 덮어씁니다. (데이터 가져오기 기능용)
   * @param {FavoriteProfiles} newProfilesData - 새로 설정할 전체 프로필 데이터
   */
  async function clearAndSetFavorites(newProfilesData: FavoriteProfiles): Promise<void> {
    console.log(
      '[Pinia Fav ClearSet] 새 프로필 데이터로 전체 덮어쓰기:',
      JSON.stringify(newProfilesData)
    );
    if (typeof newProfilesData !== 'object' || newProfilesData === null) {
      throw new Error('프로필 설정에 제공된 데이터가 유효하지 않습니다.');
    }

    // 1. 스토어의 내부 상태(ref)를 새로운 데이터로 교체합니다.
    profiles.value = { ...newProfilesData };

    // 2. 새 데이터의 첫 번째 프로필을 활성 프로필로 설정합니다.
    const firstProfile = Object.keys(newProfilesData)[0] || '기본';
    // switchProfile은 활성 프로필 이름만 저장하므로 그대로 둡니다.
    await switchProfile(firstProfile);

    // 3. [핵심 수정] 변경된 전체 프로필 데이터를 chrome.storage에 영구적으로 저장합니다.
    await saveProfiles();
    console.log('[Pinia Fav ClearSet] 새 프로필 데이터를 스토리지에 저장 완료.');
  }

  // --- NEW PROFILE MANAGEMENT ACTIONS (새 프로필 관리 액션) ---

  /**
   * 활성 프로필을 전환합니다.
   * @param {string} profileName - 전환할 프로필 이름
   */
  async function switchProfile(profileName: string): Promise<void> {
    await ensureProfilesLoaded();
    if (profiles.value!.hasOwnProperty(profileName)) {
      activeProfileName.value = profileName;
      await Storage.setData(ACTIVE_FAVORITES_PROFILE_KEY, profileName);
      console.log(`[Pinia Fav] 프로필 전환 완료: ${profileName}`);
    } else {
      console.error(`[Pinia Fav] 프로필 "${profileName}"을(를) 찾을 수 없습니다.`);
    }
  }

  /**
   * 새로운 프로필을 추가합니다.
   * @param {string} profileName - 추가할 프로필 이름
   */
  async function addProfile(profileName: string): Promise<void> {
    await ensureProfilesLoaded();
    const trimmedName = typeof profileName === 'string' ? profileName.trim() : '';
    if (!trimmedName) {
      throw new Error('프로필 이름은 비워둘 수 없습니다.');
    }
    if (profiles.value!.hasOwnProperty(trimmedName)) {
      throw new Error('이미 존재하는 프로필 이름입니다.');
    }
    profiles.value = { ...profiles.value!, [trimmedName]: {} };
    await saveProfiles();
    await switchProfile(trimmedName); // 추가 후 바로 전환
  }

  /**
   * 기존 프로필을 삭제합니다.
   * @param {string} profileName - 삭제할 프로필 이름
   */
  async function removeProfile(profileName: string): Promise<void> {
    await ensureProfilesLoaded();
    if (Object.keys(profiles.value!).length <= 1) {
      throw new Error('최소 한 개의 프로필은 남겨두어야 합니다.');
    }
    if (!profiles.value!.hasOwnProperty(profileName)) return;

    const newProfiles = { ...profiles.value! };
    delete newProfiles[profileName];
    profiles.value = newProfiles;

    // 삭제된 프로필이 현재 활성 프로필이었다면, 남은 프로필 중 첫 번째 것으로 전환
    if (activeProfileName.value === profileName) {
      const nextProfile = Object.keys(profiles.value)[0];
      await switchProfile(nextProfile);
    }
    await saveProfiles();
  }

  /**
   * 프로필의 이름을 변경합니다.
   * @param {string} oldName - 현재 프로필 이름
   * @param {string} newName - 새로운 프로필 이름
   */
  async function renameProfile(oldName: string, newName: string): Promise<void> {
    await ensureProfilesLoaded();
    const trimmedNewName = typeof newName === 'string' ? newName.trim() : '';
    if (!trimmedNewName) {
      throw new Error('프로필 이름은 비워둘 수 없습니다.');
    }
    if (!profiles.value!.hasOwnProperty(oldName)) {
      throw new Error('존재하지 않는 프로필입니다.');
    }
    if (profiles.value!.hasOwnProperty(trimmedNewName)) {
      throw new Error('이미 존재하는 프로필 이름입니다.');
    }

    const profileData = profiles.value![oldName];
    const newProfiles = { ...profiles.value! };
    delete newProfiles[oldName];
    newProfiles[trimmedNewName] = profileData;
    profiles.value = newProfiles;

    // 이름이 변경된 프로필이 활성 프로필이었다면, 활성 프로필 이름도 업데이트
    if (activeProfileName.value === oldName) {
      await switchProfile(trimmedNewName);
    }
    await saveProfiles();
  }

  // --- Return (반환) ---
  return {
    // State
    profiles,
    activeProfileName,
    // Computed
    activeFavorites,
    // Actions
    loadProfiles,
    addOrUpdateFavorite,
    removeFavorite,
    hasFavorite,
    getFavorite,
    clearAndSetFavorites,
    // Profile Management Actions
    switchProfile,
    addProfile,
    removeProfile,
    renameProfile,
    saveProfiles,
  };
});
