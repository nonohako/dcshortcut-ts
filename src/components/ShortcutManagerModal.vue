<template>
  <div class="shortcut-manager" v-show="isVisible">
    <h3 class="shortcut-title">단축키 및 설정 관리</h3>

    <!-- 탭 네비게이션 -->
    <div class="tabs">
      <button class="tab-button" :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">일반 설정</button>
      <button class="tab-button" :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">고급 기능</button>
      <button class="tab-button" :class="{ active: activeTab === 'refresh' }" @click="activeTab = 'refresh'">자동 새로고침</button>
      <button class="tab-button" :class="{ active: activeTab === 'macros' }" @click="activeTab = 'macros'">매크로</button>
      <button class="tab-button" :class="{ active: activeTab === 'data' }" @click="activeTab = 'data'">데이터 관리</button>
    </div>

    <div class="tab-content">
      <!-- 일반 설정 탭 -->
      <div v-show="activeTab === 'general'" class="tab-pane">
        <div class="shortcut-section">
          <div class="shortcut-section-title">페이지 탐색</div>
          <ShortcutToggle v-for="action in ['A', 'S', 'Z', 'X', 'Q', 'E', 'F', 'G', 'R']" :key="action"
            :label="getShortcutLabel(action as ShortcutLabelKey)"
            :enabled="settingsStore.shortcutEnabled[`shortcut${action}Enabled`]"
            :currentKey="settingsStore.shortcutKeys[`shortcut${action}Key`]"
            :storageKeyEnabled="`shortcut${action}Enabled`" :storageKeyKey="`shortcut${action}Key`"
            @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
        </div>

        <div class="shortcut-section">
          <div class="shortcut-section-title">글/댓글</div>
          <ShortcutToggle :label="getShortcutLabel('W')" :enabled="settingsStore.shortcutEnabled.shortcutWEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutWKey" storageKeyEnabled="shortcutWEnabled"
            storageKeyKey="shortcutWKey" @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
          <ShortcutToggle :label="getShortcutLabel('C')" :enabled="settingsStore.shortcutEnabled.shortcutCEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutCKey" storageKeyEnabled="shortcutCEnabled"
            storageKeyKey="shortcutCKey" @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
          <ShortcutToggle :label="getShortcutLabel('D')" :enabled="settingsStore.shortcutEnabled.shortcutDEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutDKey" storageKeyEnabled="shortcutDEnabled"
            storageKeyKey="shortcutDKey" @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
          <ShortcutToggle :label="getShortcutLabel('DRefresh')" :enabled="settingsStore.shortcutDRefreshCommentEnabled"
            storageKeyEnabled="shortcutDRefreshCommentEnabled" :isKeyEditable="false" @update:enabled="updateShortcutDRefreshCommentEnabled" />
        </div>

        <div class="shortcut-section">
          <div class="shortcut-section-title">등록 (Alt 고정)</div>
          <ShortcutToggle :label="getShortcutLabel('SubmitImagePost')"
            :enabled="settingsStore.shortcutSubmitImagePostKeyEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutSubmitImagePostKey"
            storageKeyEnabled="shortcutSubmitImagePostKeyEnabled" storageKeyKey="shortcutSubmitImagePostKey"
            @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
          <ShortcutToggle :label="getShortcutLabel('SubmitComment')"
            :enabled="settingsStore.shortcutSubmitCommentKeyEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutSubmitCommentKey"
            storageKeyEnabled="shortcutSubmitCommentKeyEnabled" storageKeyKey="shortcutSubmitCommentKey"
            @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
        </div>
      </div>

      <!-- 고급 기능 탭 -->
      <div v-show="activeTab === 'advanced'" class="tab-pane">
        <div class="shortcut-section">
          <div class="shortcut-section-title">즐겨찾기</div>
          <ShortcutToggle :label="getShortcutLabel('ToggleModal')"
            :enabled="settingsStore.shortcutToggleModalKeyEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutToggleModalKey"
            storageKeyEnabled="shortcutToggleModalKeyEnabled" storageKeyKey="shortcutToggleModalKey"
            @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
          <ShortcutToggle label="ALT + 숫자 - 해당 번호 즐겨찾기로 바로 이동" :enabled="settingsStore.altNumberEnabled"
            storageKeyEnabled="altNumberEnabled" @update:enabled="updateAltNumberEnabled" :isKeyEditable="false" />
          <ShortcutToggle :label="getShortcutLabel('PrevProfile')"
            :enabled="settingsStore.shortcutEnabled.shortcutPrevProfileEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutPrevProfileKey"
            storageKeyEnabled="shortcutPrevProfileEnabled" storageKeyKey="shortcutPrevProfileKey"
            @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
          <ShortcutToggle :label="getShortcutLabel('NextProfile')"
            :enabled="settingsStore.shortcutEnabled.shortcutNextProfileEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutNextProfileKey"
            storageKeyEnabled="shortcutNextProfileEnabled" storageKeyKey="shortcutNextProfileKey"
            @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
          <ShortcutToggle label="Alt - 미리보기 표시" :enabled="settingsStore.favoritesPreviewEnabled"
            storageKeyEnabled="favoritesPreviewEnabled" @update:enabled="updateFavoritesPreviewEnabled" :isKeyEditable="false" />
          <div class="shortcut-interval-setting" v-if="settingsStore.favoritesPreviewEnabled">
            <label for="preview-opacity" class="interval-label">미리보기 투명도</label>
            <div class="slider-container">
              <input type="range" id="preview-opacity" class="opacity-slider"
                :value="settingsStore.favoritesPreviewOpacity" @input="updatePreviewOpacityDebounced" min="0.1"
                max="1.0" step="0.05" />
              <span class="slider-value">{{ Math.round(settingsStore.favoritesPreviewOpacity * 100) }}%</span>
            </div>
          </div>
        </div>

        <div class="shortcut-section">
          <div class="shortcut-section-title">페이지 이동 방식</div>
          <PageNavModeSelector :currentMode="settingsStore.pageNavigationMode" @update:mode="updatePageNavMode" />
        </div>
      </div>

      <!-- 자동 새로고침 탭 -->
      <div v-show="activeTab === 'refresh'" class="tab-pane">
        <div class="shortcut-section">
          <div class="shortcut-section-title">새로운 글 자동 새로고침</div>
          <p class="shortcut-section-note">가장 마지막으로 포커스된 탭의 글 목록을 자동으로 갱신합니다.</p>
          <ShortcutToggle label="자동 새로고침 활성화" :enabled="settingsStore.autoRefreshEnabled"
            storageKeyEnabled="autoRefreshEnabled" @update:enabled="updateAutoRefreshEnabled" :isKeyEditable="false" />
          <ShortcutToggle v-if="settingsStore.autoRefreshEnabled" label="비활성 탭에서 새로고침 일시중지"
            tooltipText="다른 탭을 보거나 브라우저를 최소화하면 새로고침을 멈춰 리소스를 절약합니다." :enabled="settingsStore.pauseOnInactiveEnabled"
            storageKeyEnabled="pauseOnInactiveEnabled" @update:enabled="updatePauseOnInactiveEnabled" :isKeyEditable="false" />
          <div class="shortcut-interval-setting" v-if="settingsStore.autoRefreshEnabled">
            <label for="auto-refresh-interval" class="interval-label">새로고침 간격 (초)</label>
            <input type="number" id="auto-refresh-interval" class="interval-input"
              :value="settingsStore.autoRefreshInterval" @input="updateAutoRefreshIntervalDebounced" min="1"
              step="0.5" />
          </div>
          <p v-if="settingsStore.autoRefreshEnabled && settingsStore.autoRefreshInterval < 5" class="warning-note">
            <span class="warning-icon">⚠️</span> 5초 미만의 간격은 IP 차단 위험이 매우 높습니다.
          </p>
        </div>
      </div>

      <!-- 매크로 탭 -->
      <div v-show="activeTab === 'macros'" class="tab-pane">
        <div class="shortcut-section">
          <div class="shortcut-section-title">매크로 실행 설정</div>
          <ShortcutToggle :label="getShortcutLabel('MacroZ')" :enabled="settingsStore.macroZEnabled" :isMacro="true"
            storageKeyEnabled="shortcutMacroZEnabled" @update:enabled="updateMacroEnabled" />
          <ShortcutToggle :label="getShortcutLabel('MacroX')" :enabled="settingsStore.macroXEnabled" :isMacro="true"
            storageKeyEnabled="shortcutMacroXEnabled" @update:enabled="updateMacroEnabled" />
          <div class="shortcut-interval-setting">
            <label for="macro-interval" class="interval-label">매크로 간격 (ms)
              <FootnoteTrigger :tooltipText="macroIntervalTooltipText" style="margin-left: 6px;" />
            </label>
            <input type="number" id="macro-interval" class="interval-input" :value="settingsStore.macroInterval"
              @input="updateMacroIntervalDebounced" min="500" step="100" />
          </div>
          <p v-if="settingsStore.macroInterval < 5000" class="warning-note">
            <span class="warning-icon">⚠️</span> 5초 미만의 간격은 IP 차단 위험이 매우 높습니다.
          </p>
        </div>
      </div>

      <!-- 데이터 관리 탭 -->
      <div v-show="activeTab === 'data'" class="tab-pane">
        <div class="shortcut-section backup-restore-section">
          <div class="shortcut-section-title">즐겨찾기 데이터 관리</div>
          <div class="backup-restore-buttons">
            <button class="dc-button dc-button-blue" @click="backupFavorites">즐겨찾기 백업</button>
            <button class="dc-button dc-button-orange" @click="triggerRestoreInput">즐겨찾기 복원</button>
            <input type="file" id="restore-favorites-input" @change="handleFileRestore" accept=".json"
              style="display: none;" />
          </div>
          <p class="backup-restore-note">주의: 복원 시 현재 즐겨찾기 목록을 덮어씁니다.</p>
        </div>
      </div>
    </div>

    <button class="dc-button close-button-bottom" @click="closeModal">닫기</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, type Ref, type ComputedRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settingsStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { FavoriteGalleries, FavoriteProfiles } from '@/stores/favoritesStore';
import { useUiStore } from '@/stores/uiStore';
import UI from '@/services/UI';
import PageNavModeSelector from './PageNavModeSelector.vue';
import ShortcutToggle from './ShortcutToggle.vue';
import FootnoteTrigger from './FootnoteTrigger.vue';

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

type TabName = 'general' | 'advanced' | 'refresh' | 'macros' | 'data';

type ShortcutLabelKey = 'W' | 'C' | 'D' | 'R' | 'Q' | 'E' | 'F' | 'G' | 'A' | 'S' | 'Z' | 'X' |
  'PrevProfile' | 'NextProfile' | 'SubmitImagePost' | 'SubmitComment' |
  'ToggleModal' | 'DRefresh' | 'MacroZ' | 'MacroX';

// =================================================================
// Store Initialization and State (스토어 초기화 및 상태)
// =================================================================
const uiStore = useUiStore();
const settingsStore = useSettingsStore();
const favoritesStore = useFavoritesStore();
const { profiles } = storeToRefs(favoritesStore);

// =================================================================
// Component Internal State (컴포넌트 내부 상태)
// =================================================================
const isVisible = ref<boolean>(false);
const activeTab = ref<TabName>('general');
const macroIntervalTooltipText = ref<string>("너무 짧게 설정 시 IP 차단 위험 증가 (2초 이상 권장)");
let debounceTimer: number | null = null;

// =================================================================
// Computed Properties (계산된 속성)
// =================================================================

const dynamicLabels: ComputedRef<Record<ShortcutLabelKey, string>> = computed(() => {
  const keys = settingsStore.shortcutKeys;
  const defaults = settingsStore.defaultShortcutKeys;
  const getKey = (action: string) => (keys[`shortcut${action}Key`] || defaults[action as keyof typeof defaults] || '').toUpperCase();

  return {
    W: `${getKey('W')} - 글쓰기`,
    C: `${getKey('C')} - 댓글 쓰기`,
    D: `${getKey('D')} - 댓글 보기`,
    R: `${getKey('R')} - 페이지 새로고침`,
    Q: `${getKey('Q')} - 최상단 이동`,
    E: `${getKey('E')} - 글 목록 이동`,
    F: `${getKey('F')} - 전체글 보기`,
    G: `${getKey('G')} - 개념글 보기`,
    A: `${getKey('A')} - 다음 페이지`,
    S: `${getKey('S')} - 이전 페이지`,
    Z: `${getKey('Z')} - 다음 글`,
    X: `${getKey('X')} - 이전 글`,
    PrevProfile: `${getKey('PrevProfile')} - 이전 프로필`,
    NextProfile: `${getKey('NextProfile')} - 다음 프로필`,
    SubmitImagePost: `Alt + ${getKey('SubmitImagePost')} - 글 등록`,
    SubmitComment: `Alt + ${getKey('SubmitComment')} - 댓글 등록`,
    ToggleModal: `Alt + ${getKey('ToggleModal')} - 즐겨찾기창 열기`,
    DRefresh: `D - 댓글 이동 시 댓글 새로고침`,
    MacroZ: `Alt + Z - 다음 글 자동 넘김`,
    MacroX: `Alt + X - 이전 글 자동 넘김`,
  };
});

const getShortcutLabel = (action: ShortcutLabelKey): string => dynamicLabels.value[action] || action;

// =================================================================
// Event Handlers and Functions (이벤트 핸들러 및 함수)
// =================================================================

const debounce = (callback: () => void, delay: number = 500): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(callback, delay);
};

const updatePageNavMode = async (mode: 'ajax' | 'full'): Promise<void> => {
  await settingsStore.savePageNavigationMode(mode);
  UI.showAlert(`페이지 이동 방식이 '${mode === 'ajax' ? '빠른 이동' : '기본 이동'}' 모드로 변경되었습니다.`);
};

const updateAltNumberEnabled = async (storageKey: string | undefined, enabled: boolean): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveAltNumberEnabled(enabled);
  UI.showAlert(`ALT + 숫자 즐겨찾기 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateShortcutEnabled = async (storageKey: string | undefined, enabled: boolean, label: string): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveShortcutEnabled(storageKey, enabled);
  UI.showAlert(`'${label}' 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateMacroEnabled = async (storageKey: string | undefined, enabled: boolean, label: string): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveShortcutEnabled(storageKey, enabled);
  UI.showAlert(`'${label}' 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateShortcutDRefreshCommentEnabled = async (storageKey: string | undefined, enabled: boolean): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveShortcutDRefreshCommentEnabled(enabled);
  UI.showAlert(`'${getShortcutLabel('DRefresh')}' 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateShortcutKey = async (storageKey: string | undefined, newKey: string, label: string): Promise<void> => {
  if (!storageKey) return;
  const action = storageKey.replace('shortcut', '').replace('Key', '');
  const isAltRequired = ['SubmitComment', 'SubmitImagePost', 'ToggleModal'].includes(action);
  const result = await settingsStore.saveShortcutKey(storageKey, newKey, isAltRequired);
  if (result.success) {
    await nextTick();
    UI.showAlert(`'${label}' 단축키가 '${getShortcutLabel(action as ShortcutLabelKey)}'(으)로 변경되었습니다.`);
  } else {
    UI.showAlert(result.message || '알 수 없는 오류');
  }
};

const updateAutoRefreshEnabled = async (storageKey: string | undefined, enabled: boolean): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveAutoRefreshEnabled(enabled);
  UI.showAlert(`자동 새로고침 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateAutoRefreshIntervalDebounced = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const newValue = target.value;
  debounce(async () => {
    const result = await settingsStore.saveAutoRefreshInterval(newValue);
    if (!result.success) {
      UI.showAlert(result.message || '오류 발생');
      target.value = settingsStore.autoRefreshInterval.toString();
    } else {
      UI.showAlert(`확인 간격이 ${newValue}초로 설정되었습니다.`);
    }
  });
};

const updateMacroIntervalDebounced = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const newValue = target.value;
  debounce(async () => {
    const result = await settingsStore.saveMacroInterval(newValue);
    if (!result.success) {
      UI.showAlert(result.message || '오류 발생');
      target.value = settingsStore.macroInterval.toString();
    } else {
      UI.showAlert(`매크로 간격이 ${newValue}ms로 설정되었습니다.`);
    }
  });
};

const updateFavoritesPreviewEnabled = async (storageKey: string | undefined, enabled: boolean): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveFavoritesPreviewEnabled(enabled);
  UI.showAlert(`즐겨찾기 미리보기 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updatePreviewOpacityDebounced = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const newValue = target.value;
  debounce(async () => {
    await settingsStore.saveFavoritesPreviewOpacity(newValue);
  }, 200);
};

const updatePauseOnInactiveEnabled = async (storageKey: string | undefined, enabled: boolean): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.savePauseOnInactiveEnabled(enabled);
  UI.showAlert(`비활성 탭에서 새로고침 일시중지 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const triggerRestoreInput = (): void => {
  document.getElementById('restore-favorites-input')?.click();
};

const backupFavorites = async (): Promise<void> => {
  try {
    const profilesData = profiles.value;
    if (!profilesData || Object.keys(profilesData).length === 0) {
      UI.showAlert('백업할 즐겨찾기 데이터가 없습니다.');
      return;
    }
    const jsonData = JSON.stringify(profilesData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date();
    const dateString = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    a.download = `dcinside_favorites_backup_${dateString}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.showAlert('즐겨찾기가 JSON 파일로 백업되었습니다.');
  } catch (error) {
    console.error('즐겨찾기 백업 오류:', error);
    UI.showAlert('즐겨찾기 백업 중 오류가 발생했습니다.');
  }
};

const handleFileRestore = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.name.endsWith('.json')) {
    UI.showAlert('JSON 파일만 복원할 수 있습니다. (.json)');
    target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e: ProgressEvent<FileReader>) => {
    try {
      const jsonData = e.target?.result as string;
      const parsedData = JSON.parse(jsonData);

      if (typeof parsedData !== 'object' || parsedData === null) {
        throw new Error('유효하지 않은 JSON 파일 형식입니다.');
      }

      let dataToRestore: FavoriteProfiles;

      // --- 백업 파일 형식 감지 및 마이그레이션 로직 ---
      const keys = Object.keys(parsedData);
      // 1. 파일 내용의 키가 모두 한 자리 숫자인지 확인하여 구 버전 형식인지 판별
      const isOldFormat = keys.length > 0 && keys.every(key => /^[0-9]$/.test(key));

      if (isOldFormat) {
        // 1-1. 구 버전 백업 파일 감지
        console.warn("구 버전 백업 파일을 감지했습니다. '기본' 프로필로 복원합니다.");
        // 간단한 유효성 검사
        for (const key in parsedData) {
            const item = parsedData[key];
            if (typeof item?.galleryId !== 'string' || typeof item?.name !== 'string') {
                throw new Error(`백업 파일의 ${key}번 항목 데이터가 올바르지 않습니다.`);
            }
        }
        // 구 버전 데이터를 '기본' 프로필 아래에 중첩하여 새 형식으로 변환
        dataToRestore = { '기본': parsedData as FavoriteGalleries };
      } else {
        // 1-2. 신 버전(프로필) 형식 백업 파일 유효성 검사
        for (const profileName in parsedData) {
          const profile = parsedData[profileName];
          if (typeof profile !== 'object' || profile === null) {
            throw new Error(`백업 파일의 '${profileName}' 프로필 데이터 형식이 올바르지 않습니다.`);
          }
          for (const key in profile) {
            const item = profile[key];
            if (!/^[0-9]$/.test(key) || typeof item?.name !== 'string' || typeof item?.galleryId !== 'string' || !['board', 'mgallery', 'mini'].includes(item?.galleryType)) {
              throw new Error(`'${profileName}' 프로필의 즐겨찾기 내용(키: ${key})이 올바르지 않습니다.`);
            }
          }
        }
        dataToRestore = parsedData as FavoriteProfiles;
      }
      // --- 마이그레이션 로직 종료 ---

      const confirmed = window.confirm('현재 모든 즐겨찾기 프로필을 선택한 파일의 내용으로 덮어쓰시겠습니까? 이 작업은 되돌릴 수 없습니다.');
      if (!confirmed) {
        UI.showAlert('즐겨찾기 복원이 취소되었습니다.');
        return;
      }

      await favoritesStore.clearAndSetFavorites(dataToRestore);
      UI.showAlert('즐겨찾기가 성공적으로 복원되었습니다.');

    } catch (error) {
      if (error instanceof Error) {
        console.error('즐겨찾기 복원 중 오류:', error);
        UI.showAlert(`즐겨찾기 복원 실패: ${error.message}`);
      }
    } finally {
      target.value = '';
    }
  };
  reader.onerror = () => {
    UI.showAlert('파일을 읽는 중 오류가 발생했습니다.');
    target.value = '';
  };
  reader.readAsText(file);
};

const closeModal = (): void => uiStore.closeModal();

onMounted(() => {
  settingsStore.loadSettings();
  requestAnimationFrame(() => {
    isVisible.value = true;
  });
});
</script>

<style scoped>
/* ShortcutManagerModal.vue 스타일 */
.shortcut-manager {
  position: fixed;
  top: 50%;
  left: 50%;
  background-color: #f8f9fa;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  z-index: 10001;
  width: 500px;
  height: 800px;
  display: flex;
  flex-direction: column;
  font-family: "Noto Sans CJK KR", "NanumGothic", sans-serif;
  border: 1px solid #dee2e6;
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}

.shortcut-manager:not([style*="display: none;"]) {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.shortcut-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #212529;
  margin: 0 0 16px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid #e9ecef;
  flex-shrink: 0;
}

.tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #dee2e6;
  flex-shrink: 0;
}

.tab-button {
  padding: 10px 15px;
  cursor: pointer;
  border: none;
  background-color: transparent;
  font-size: 0.95rem;
  font-weight: 500;
  color: #6c757d;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease-in-out, border-color 0.15s ease-in-out;
  white-space: nowrap;
  width: auto;
}

.tab-button:hover {
  color: #0d6efd;
}

.tab-button.active {
  color: #0d6efd;
  border-bottom-color: #0d6efd;
  font-weight: 600;
}

.tab-content {
  flex-grow: 1;
  overflow-y: auto;
}

.shortcut-section {
  background-color: #ffffff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #e9ecef;
}

.tab-pane > .shortcut-section:last-of-type {
  margin-bottom: 0;
}

.shortcut-section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 12px;
}

.shortcut-interval-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 12px 10px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  background-color: #fff;
}

.interval-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #343a40;
  display: inline-flex;
  align-items: center;
}

.interval-input {
  width: 80px;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.9rem;
  text-align: right;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.interval-input:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

.backup-restore-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.backup-restore-buttons .dc-button {
  flex-grow: 1;
  margin-top: 0;
}

.backup-restore-note {
  font-size: 0.8rem;
  color: #6c757d;
  text-align: center;
  margin-top: 8px;
}

.dc-button {
  display: block;
  width: 100%;
  padding: 10px 16px;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.dc-button:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.dc-button:active {
  transform: translateY(1px);
  box-shadow: none;
}

.close-button-bottom {
  background-color: #6c757d;
  margin-top: 20px;
  flex-shrink: 0;
}

.close-button-bottom:hover {
  background-color: #5a6268;
}

.dc-button-blue {
  background-color: #0d6efd;
}

.dc-button-blue:hover {
  background-color: #0b5ed7;
}

.dc-button-orange {
  background-color: #ffc107;
  color: #000;
}

.dc-button-orange:hover {
  background-color: #ffca2c;
}

.shortcut-section > :deep(.shortcut-toggle) {
  margin-bottom: 8px;
}

.shortcut-section > :deep(.shortcut-toggle:last-child) {
  margin-bottom: 0;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.opacity-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 150px;
  height: 8px;
  background: #e9ecef;
  outline: none;
  border-radius: 4px;
  transition: opacity .2s;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #0d6efd;
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.opacity-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #0d6efd;
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.slider-value {
  font-size: 0.85rem;
  font-weight: 500;
  color: #495057;
  min-width: 40px;
  text-align: right;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

.shortcut-section-note {
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 16px;
  line-height: 1.5;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.warning-note {
  font-size: 0.8rem;
  color: #c0392b;
  background-color: #fbe9e7;
  border: 1px solid #ffab91;
  border-radius: 6px;
  padding: 10px;
  margin-top: 12px;
  line-height: 1.5;
  display: flex;
  align-items: center;
}

.warning-icon {
  margin-right: 8px;
  font-size: 1rem;
}
</style>