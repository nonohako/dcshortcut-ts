<template>
  <div class="shortcut-manager" v-show="isVisible">
    <h3 class="shortcut-title">단축키 및 설정 관리</h3>

    <!-- 탭 네비게이션 -->
    <div class="tabs">
      <button class="tab-button" :class="{ active: activeTab === 'shortcuts' }" @click="activeTab = 'shortcuts'">단축키</button>
      <button class="tab-button" :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">고급</button>
      <button class="tab-button" :class="{ active: activeTab === 'dccon' }" @click="activeTab = 'dccon'">디시콘</button>
      <button class="tab-button" :class="{ active: activeTab === 'refresh' }" @click="activeTab = 'refresh'">새로고침</button>
      <button class="tab-button" :class="{ active: activeTab === 'macros' }" @click="activeTab = 'macros'">매크로</button>
      <button class="tab-button" :class="{ active: activeTab === 'data' }" @click="activeTab = 'data'">데이터</button>
    </div>

    <div class="tab-content">
      <!-- 단축키 탭 -->
      <div v-show="activeTab === 'shortcuts'" class="tab-pane">
        <div class="shortcut-section">
          <div class="shortcut-section-title">페이지 탐색</div>
          <ShortcutToggle v-for="action in ['A', 'S', 'Z', 'X', 'Q', 'E', 'GlobalSearch', 'GallerySearch', 'F', 'G', 'R']" :key="action"
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
            storageKeyEnabled="shortcutDRefreshCommentEnabled" :isKeyEditable="false"
            @update:enabled="updateShortcutDRefreshCommentEnabled" />
        </div>

        <div class="shortcut-section">
          <div class="shortcut-section-title">등록 (Alt 필수)</div>
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

        <div class="shortcut-section">
          <div class="shortcut-section-title">즐겨찾기/프로필</div>
          <ShortcutToggle :label="getShortcutLabel('ToggleModal')"
            :enabled="settingsStore.shortcutToggleModalKeyEnabled"
            :currentKey="settingsStore.shortcutKeys.shortcutToggleModalKey"
            storageKeyEnabled="shortcutToggleModalKeyEnabled" storageKeyKey="shortcutToggleModalKey"
            @update:enabled="updateShortcutEnabled" @update:key="updateShortcutKey" />
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
        </div>
      </div>

      <!-- 고급 기능 탭 -->
      <div v-show="activeTab === 'advanced'" class="tab-pane">
        <div class="shortcut-section">
          <div class="shortcut-section-title">즐겨찾기</div>
          <div class="shortcut-interval-setting theme-mode-setting">
            <label for="theme-mode-select" class="interval-label">화면 테마</label>
            <select
              id="theme-mode-select"
              class="theme-mode-select"
              :value="settingsStore.themeMode"
              @change="updateThemeMode"
            >
              <option value="system">시스템 기본값</option>
              <option value="dark">다크</option>
              <option value="light">라이트</option>
            </select>
          </div>
          <ShortcutToggle label="ALT + 숫자 - 해당 번호 즐겨찾기로 바로 이동" :enabled="settingsStore.altNumberEnabled"
            storageKeyEnabled="altNumberEnabled" @update:enabled="updateAltNumberEnabled" :isKeyEditable="false" />
          <ShortcutToggle label="숫자키 - 라벨 글 이동" :enabled="settingsStore.numberNavigationEnabled"
            storageKeyEnabled="numberNavigationEnabled" @update:enabled="updateNumberNavigationEnabled"
            :isKeyEditable="false" />
          <ShortcutToggle label="목록 번호 라벨 표시" :enabled="settingsStore.numberLabelsEnabled"
            storageKeyEnabled="numberLabelsEnabled" @update:enabled="updateNumberLabelsEnabled"
            :isKeyEditable="false" />
          <ShortcutToggle label="작성일에 시간 표시" :enabled="settingsStore.showDateInListEnabled"
            storageKeyEnabled="showDateInListEnabled" @update:enabled="updateShowDateInListEnabled"
            :isKeyEditable="false" />
          <ShortcutToggle label="Alt - 미리보기 표시" :enabled="settingsStore.favoritesPreviewEnabled"
            storageKeyEnabled="favoritesPreviewEnabled" @update:enabled="updateFavoritesPreviewEnabled"
            :isKeyEditable="false" />
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

      <!-- 디시콘 별칭 탭 -->
      <div v-show="activeTab === 'dccon'" class="tab-pane">
        <div class="shortcut-section">
          <div class="shortcut-section-title">디시콘 별칭</div>
          <p class="shortcut-section-note">
            댓글창 디시콘 아이콘 <strong>우클릭</strong> → 별칭 등록.<br>
            댓글에 <strong>@별칭</strong> 입력 시 목록 표시 (TAB/Shift+TAB 전환, ENTER/클릭 선택)
          </p>
          <div class="dccon-toolbar">
            <button class="dc-button dc-button-blue alias-refresh-button" @click="loadDcconAliasItems">
              목록 새로고침
            </button>
            <div class="dccon-enabled-toggle" title="디시콘 별칭 기능 ON/OFF">
              <span class="dccon-enabled-label">디시콘</span>
              <label class="dccon-switch">
                <input type="checkbox" :checked="settingsStore.dcconAliasEnabled" @change="updateDcconAliasEnabled" />
                <span class="dccon-switch-slider"></span>
              </label>
            </div>
          </div>
          <div v-if="dcconAliasItems.length === 0" class="alias-empty-state">
            등록된 디시콘 별칭이 없습니다.
          </div>
          <ul v-else class="alias-list">
            <li v-for="item in dcconAliasItems" :key="item.id" class="alias-list-item">
              <div class="alias-item-main">
                <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.alias" :title="item.aliasTooltip" loading="lazy" />
                <span class="alias-item-aliases" :title="item.aliasTooltip">
                  {{ item.aliases.map((alias) => `@${alias}`).join(', ') }}
                </span>
              </div>
              <div class="alias-item-actions">
                <button class="alias-action-button alias-edit-button" title="별칭 수정" @click="editDcconAlias(item)">
                  ✎
                </button>
                <button class="alias-action-button alias-delete-button" @click="removeDcconAlias(item)">삭제</button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- 자동 새로고침 탭 -->
      <div v-show="activeTab === 'refresh'" class="tab-pane">
        <div class="shortcut-section">
          <div class="shortcut-section-title">새로운 글 자동 새로고침</div>
          <ShortcutToggle label="자동 새로고침 활성화" :enabled="settingsStore.autoRefreshEnabled"
            storageKeyEnabled="autoRefreshEnabled" @update:enabled="updateAutoRefreshEnabled" :isKeyEditable="false" />
          <ShortcutToggle v-if="settingsStore.autoRefreshEnabled" label="모든 탭에서 글 목록 갱신"
            tooltipText="ON이면 열린 DC 탭 모두에서 글 목록 자동 갱신이 동작합니다." :enabled="settingsStore.autoRefreshAllTabsEnabled"
            storageKeyEnabled="autoRefreshAllTabsEnabled" @update:enabled="updateAutoRefreshAllTabsEnabled"
            :isKeyEditable="false" />
          <ShortcutToggle v-if="settingsStore.autoRefreshEnabled && !settingsStore.autoRefreshAllTabsEnabled"
            label="비활성 탭에서 새로고침 일시중지"
            tooltipText="다른 탭을 보거나 브라우저를 최소화하면 새로고침을 멈춰 리소스를 절약합니다." :enabled="settingsStore.pauseOnInactiveEnabled"
            storageKeyEnabled="pauseOnInactiveEnabled" @update:enabled="updatePauseOnInactiveEnabled"
            :isKeyEditable="false" />
          <div class="shortcut-interval-setting" v-if="settingsStore.autoRefreshEnabled">
            <label for="auto-refresh-interval" class="interval-label">새로고침 간격 (초)</label>
            <input type="number" id="auto-refresh-interval" class="interval-input"
              :value="settingsStore.autoRefreshInterval" @input="updateAutoRefreshIntervalDebounced" min="1"
              step="0.5" />
          </div>
          <div class="shortcut-interval-setting" v-if="settingsStore.autoRefreshEnabled">
            <label for="auto-refresh-highlight-color" class="interval-label">새 글 하이라이트 색상</label>
            <input type="color" id="auto-refresh-highlight-color" class="color-input"
              :value="settingsStore.autoRefreshHighlightColor" @input="updateAutoRefreshHighlightColor" />
          </div>
          <div class="shortcut-interval-setting" v-if="settingsStore.autoRefreshEnabled">
            <label for="auto-refresh-highlight-duration" class="interval-label">하이라이트 유지 시간 (초)</label>
            <input type="number" id="auto-refresh-highlight-duration" class="interval-input"
              :value="settingsStore.autoRefreshHighlightDuration" @input="updateAutoRefreshHighlightDurationDebounced"
              min="-1" step="0.5" />
          </div>
          <p v-if="settingsStore.autoRefreshEnabled" class="shortcut-section-note">
            하이라이트 시간: 0은 끄기, -1은 무한 유지
          </p>
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
          <div class="shortcut-section-title">설정 데이터 관리</div>
          <div class="backup-restore-buttons">
            <button class="dc-button dc-button-blue" @click="backupSettings">설정 백업</button>
            <button class="dc-button dc-button-orange" @click="triggerRestoreInput">설정 복원</button>
            <input type="file" id="restore-settings-input" @change="handleFileRestore" accept=".json"
              style="display: none;" />
          </div>
        </div>
        <div class="shortcut-section reset-section">
          <div class="shortcut-section-title">앱 초기화</div>
          <button class="dc-button dc-button-red" @click="openResetDialog">초기화</button>
        </div>
      </div>
    </div>

    <div v-if="isResetDialogVisible" class="reset-dialog-overlay" @click.self="closeResetDialog">
      <div class="reset-dialog" role="dialog" aria-modal="true" aria-label="앱 초기화 확인">
        <h4 class="reset-dialog-title">앱 초기화</h4>
        <p class="reset-dialog-message">
          앱을 정말 초기화 하시겠습니까? 초기화를 원하면 <strong>초기화</strong>를 입력하세요.
        </p>
        <input v-model="resetConfirmInput" class="reset-dialog-input" type="text" autocomplete="off"
          placeholder="초기화" @keydown.enter.prevent="confirmResetApp" />
        <div class="reset-dialog-actions">
          <button class="dc-button dc-button-light" @click="closeResetDialog">취소</button>
          <button class="dc-button dc-button-red" :disabled="resetConfirmInput.trim() !== RESET_CONFIRM_TEXT"
            @click="confirmResetApp">
            초기화
          </button>
        </div>
      </div>
    </div>

    <button class="dc-button close-button-bottom" @click="closeModal">닫기</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, type Ref, type ComputedRef } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { FavoriteGalleryInfo, FavoriteGalleries, FavoriteProfiles } from '@/stores/favoritesStore';
import type { DcconAliasMap, DcconAliasTarget, ThemeMode } from '@/types';
import { useUiStore } from '@/stores/uiStore';
import UI from '@/services/UI';
import Posts from '@/services/Posts';
import Events from '@/services/Events';
import { normalizeShortcutWithFallback } from '@/services/Shortcut';
import {
  ACTIVE_FAVORITES_PROFILE_KEY,
  DCCON_ALIAS_MAP_KEY,
  FAVORITE_GALLERIES_KEY,
} from '@/services/Global';
import Storage from '@/services/Storage';
import PageNavModeSelector from './PageNavModeSelector.vue';
import ShortcutToggle from './ShortcutToggle.vue';
import FootnoteTrigger from './FootnoteTrigger.vue';

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

type TabName = 'shortcuts' | 'advanced' | 'dccon' | 'refresh' | 'macros' | 'data';

type ShortcutLabelKey = 'W' | 'C' | 'D' | 'R' | 'Q' | 'E' | 'F' | 'G' | 'A' | 'S' | 'GallerySearch' | 'GlobalSearch' | 'Z' | 'X' |
  'PrevProfile' | 'NextProfile' | 'SubmitImagePost' | 'SubmitComment' |
  'ToggleModal' | 'DRefresh' | 'MacroZ' | 'MacroX';
const ALT_REQUIRED_ACTIONS = new Set(['SubmitComment', 'SubmitImagePost', 'ToggleModal']);

interface DcconAliasListItem extends DcconAliasTarget {
  aliases: string[];
  aliasTooltip: string;
  id: string;
}

type LocalStorageSnapshot = Record<string, unknown>;

interface SettingsBackupFile {
  backupType: string;
  version: number;
  exportedAt: string;
  data: LocalStorageSnapshot;
}

interface RestorePlan {
  snapshot: LocalStorageSnapshot;
  migratedFromLegacyFavorites: boolean;
}

const SETTINGS_BACKUP_FILE_TYPE = 'dcshortcut-settings-backup';
const SETTINGS_BACKUP_FILE_VERSION = 1;
const RESET_CONFIRM_TEXT = '초기화';
const DEFAULT_PROFILE_NAME = '기본';
const GALLERY_TYPES = new Set<FavoriteGalleryInfo['galleryType']>(['board', 'mgallery', 'mini']);
const FAVORITES_SLOT_KEY_REGEX = /^[0-9]$/;

// =================================================================
// Store Initialization and State (스토어 초기화 및 상태)
// =================================================================
const uiStore = useUiStore();
const settingsStore = useSettingsStore();
const favoritesStore = useFavoritesStore();

// =================================================================
// Component Internal State (컴포넌트 내부 상태)
// =================================================================
const isVisible = ref<boolean>(false);
const activeTab = ref<TabName>('shortcuts');
const macroIntervalTooltipText = ref<string>("너무 짧게 설정 시 IP 차단 위험 증가 (2초 이상 권장)");
const dcconAliasItems = ref<DcconAliasListItem[]>([]);
const isResetDialogVisible = ref<boolean>(false);
const resetConfirmInput = ref<string>('');
let debounceTimer: number | null = null;

// =================================================================
// Computed Properties (계산된 속성)
// =================================================================

const dynamicLabels: ComputedRef<Record<ShortcutLabelKey, string>> = computed(() => {
  const keys = settingsStore.shortcutKeys;
  const defaults = settingsStore.defaultShortcutKeys;
  const getKey = (action: string) =>
    normalizeShortcutWithFallback(
      keys[`shortcut${action}Key`],
      defaults[action as keyof typeof defaults] || '',
      ALT_REQUIRED_ACTIONS.has(action)
    );

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
    GallerySearch: `${getKey('GallerySearch')} - 갤러리 내부 검색`,
    GlobalSearch: `${getKey('GlobalSearch')} - 통합 검색`,
    Z: `${getKey('Z')} - 다음 글`,
    X: `${getKey('X')} - 이전 글`,
    PrevProfile: `${getKey('PrevProfile')} - 이전 프로필`,
    NextProfile: `${getKey('NextProfile')} - 다음 프로필`,
    SubmitImagePost: `${getKey('SubmitImagePost')} - 글 등록`,
    SubmitComment: `${getKey('SubmitComment')} - 댓글 등록`,
    ToggleModal: `${getKey('ToggleModal')} - 즐겨찾기창 열기`,
    DRefresh: `D - 댓글 이동 시 댓글 새로고침`,
    MacroZ: `Alt + Z - 다음 글 자동 넘김`,
    MacroX: `Alt + X - 이전 글 자동 넘김`,
  };
});

const getShortcutLabel = (action: ShortcutLabelKey): string => dynamicLabels.value[action] || action;

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const normalizeAliasKey = (alias: string): string => safeTrim(alias).toLocaleLowerCase();
const sanitizeSingleAliasInput = (rawAlias: string): string => {
  if (typeof rawAlias !== 'string') return '';
  const alias = rawAlias.replace(/^@+/, '').trim();
  if (!alias || /\s/.test(alias)) return '';
  return alias.slice(0, 5);
};
const parseAliasListInput = (rawInput: string): string[] => {
  const aliases: string[] = [];
  const seen = new Set<string>();

  safeTrim(rawInput)
    .split(',')
    .forEach((token) => {
      const alias = sanitizeSingleAliasInput(token);
      if (!alias) return;

      const normalized = normalizeAliasKey(alias);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      aliases.push(alias);
    });

  return aliases;
};
const getAliasSortBucket = (alias: string): number => {
  const firstChar = safeTrim(alias).charAt(0);
  if (!firstChar) return 9;
  if (/^[0-9]$/.test(firstChar)) return 0;
  if (/^[A-Za-z]$/.test(firstChar)) return 1;
  if (/^[ㄱ-ㅎㅏ-ㅣ가-힣]$/.test(firstChar)) return 2;
  return 3;
};
const compareAliasItems = (a: DcconAliasListItem, b: DcconAliasListItem): number => {
  const bucketDiff = getAliasSortBucket(a.alias) - getAliasSortBucket(b.alias);
  if (bucketDiff !== 0) return bucketDiff;

  const aliasCompare = a.alias.localeCompare(b.alias, 'ko', {
    sensitivity: 'base',
    numeric: true,
  });
  if (aliasCompare !== 0) return aliasCompare;

  const packageCompare = a.packageIdx.localeCompare(b.packageIdx, 'en', { numeric: true });
  if (packageCompare !== 0) return packageCompare;
  return a.detailIdx.localeCompare(b.detailIdx, 'en', { numeric: true });
};

const removeAliasTargetFromMap = (
  aliasMap: DcconAliasMap,
  packageIdx: string,
  detailIdx: string
): void => {
  Object.keys(aliasMap).forEach((aliasKey) => {
    const filteredTargets = aliasMap[aliasKey].filter(
      (target) => !(target.packageIdx === packageIdx && target.detailIdx === detailIdx)
    );
    if (filteredTargets.length > 0) {
      aliasMap[aliasKey] = filteredTargets;
    } else {
      delete aliasMap[aliasKey];
    }
  });
};

const setAliasesForTarget = (
  aliasMap: DcconAliasMap,
  target: Pick<DcconAliasTarget, 'packageIdx' | 'detailIdx' | 'title' | 'imageUrl'>,
  aliases: string[]
): void => {
  removeAliasTargetFromMap(aliasMap, target.packageIdx, target.detailIdx);

  const baseTime = Date.now();
  aliases.forEach((alias, index) => {
    const normalized = normalizeAliasKey(alias);
    if (!normalized) return;

    const nextTarget: DcconAliasTarget = {
      alias,
      packageIdx: target.packageIdx,
      detailIdx: target.detailIdx,
      title: target.title,
      imageUrl: target.imageUrl,
      updatedAt: baseTime + index,
    };

    const targets = aliasMap[normalized] ?? [];
    const existingIndex = targets.findIndex(
      (item) => item.packageIdx === target.packageIdx && item.detailIdx === target.detailIdx
    );
    if (existingIndex >= 0) {
      targets[existingIndex] = nextTarget;
    } else {
      targets.unshift(nextTarget);
    }
    aliasMap[normalized] = targets;
  });
};

const storageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void => {
  if (areaName !== 'local' || !changes[DCCON_ALIAS_MAP_KEY]) return;
  void loadDcconAliasItems();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const buildDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
};

const downloadJson = (filename: string, payload: unknown): void => {
  const jsonData = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const getLocalStorageSnapshot = async (): Promise<LocalStorageSnapshot> =>
  new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(items as LocalStorageSnapshot);
    });
  });

const clearLocalStorage = async (): Promise<void> =>
  new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });

const setLocalStorageSnapshot = async (snapshot: LocalStorageSnapshot): Promise<void> =>
  new Promise((resolve, reject) => {
    chrome.storage.local.set(snapshot, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });

const sanitizeSnapshot = (snapshot: LocalStorageSnapshot): LocalStorageSnapshot => {
  const sanitized: LocalStorageSnapshot = {};
  Object.entries(snapshot).forEach(([key, value]) => {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  });
  return sanitized;
};

const applyStorageSnapshot = async (snapshot: LocalStorageSnapshot): Promise<void> => {
  const sanitized = sanitizeSnapshot(snapshot);
  await clearLocalStorage();
  if (Object.keys(sanitized).length > 0) {
    await setLocalStorageSnapshot(sanitized);
  }
};

const normalizeFavoriteGallery = (value: unknown): FavoriteGalleryInfo | null => {
  if (!isRecord(value)) return null;
  if (typeof value.name !== 'string' || typeof value.galleryId !== 'string') return null;
  const galleryType = GALLERY_TYPES.has(value.galleryType as FavoriteGalleryInfo['galleryType'])
    ? (value.galleryType as FavoriteGalleryInfo['galleryType'])
    : 'board';

  return {
    name: value.name,
    galleryId: value.galleryId,
    galleryType,
  };
};

const parseFavoriteGalleries = (value: unknown): FavoriteGalleries | null => {
  if (!isRecord(value)) return null;

  const parsedGalleries: FavoriteGalleries = {};
  for (const [slotKey, slotValue] of Object.entries(value)) {
    if (!FAVORITES_SLOT_KEY_REGEX.test(slotKey)) return null;
    const gallery = normalizeFavoriteGallery(slotValue);
    if (!gallery) return null;
    parsedGalleries[slotKey] = gallery;
  }
  return parsedGalleries;
};

const parseLegacyFavoritesBackup = (value: unknown): FavoriteProfiles | null => {
  const singleProfile = parseFavoriteGalleries(value);
  if (singleProfile) {
    return { [DEFAULT_PROFILE_NAME]: singleProfile };
  }

  if (!isRecord(value)) return null;
  const parsedProfiles: FavoriteProfiles = {};

  for (const [profileName, profileValue] of Object.entries(value)) {
    const parsedProfile = parseFavoriteGalleries(profileValue);
    if (!parsedProfile) return null;
    parsedProfiles[profileName] = parsedProfile;
  }

  return parsedProfiles;
};

const parseSettingsBackupFile = (value: unknown): SettingsBackupFile | null => {
  if (!isRecord(value)) return null;
  if (value.backupType !== SETTINGS_BACKUP_FILE_TYPE) return null;
  if (typeof value.version !== 'number' || value.version < 1) return null;
  if (!isRecord(value.data)) return null;

  return {
    backupType: value.backupType,
    version: value.version,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    data: value.data,
  };
};

const buildRestorePlan = async (parsedData: unknown): Promise<RestorePlan> => {
  const settingsBackup = parseSettingsBackupFile(parsedData);
  if (settingsBackup) {
    return {
      snapshot: settingsBackup.data,
      migratedFromLegacyFavorites: false,
    };
  }

  const legacyFavorites = parseLegacyFavoritesBackup(parsedData);
  if (!legacyFavorites) {
    throw new Error('지원하지 않는 백업 파일 형식입니다.');
  }

  const currentSnapshot = await getLocalStorageSnapshot();
  const nextActiveProfile = Object.keys(legacyFavorites)[0] ?? DEFAULT_PROFILE_NAME;

  return {
    snapshot: {
      ...currentSnapshot,
      [FAVORITE_GALLERIES_KEY]: legacyFavorites,
      [ACTIVE_FAVORITES_PROFILE_KEY]: nextActiveProfile,
    },
    migratedFromLegacyFavorites: true,
  };
};

const syncStateAfterStorageMutation = async (): Promise<void> => {
  await Promise.all([settingsStore.loadSettings(), favoritesStore.loadProfiles()]);
  await loadDcconAliasItems();

  Posts.addNumberLabels(settingsStore.numberLabelsEnabled);
  Posts.formatDates(settingsStore.showDateInListEnabled);
  Events.setPageNavigationMode(settingsStore.pageNavigationMode);
  window.handleAutoRefresherState?.();
};

// =================================================================
// Event Handlers and Functions (이벤트 핸들러 및 함수)
// =================================================================

const debounce = (callback: () => void, delay: number = 500): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(callback, delay);
};

const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  system: '시스템 기본값',
  dark: '다크',
  light: '라이트',
};

const updatePageNavMode = async (mode: 'ajax' | 'full' | 'infinite'): Promise<void> => {
  await settingsStore.savePageNavigationMode(mode);
  Events.setPageNavigationMode(mode);
  const modeLabel =
    mode === 'ajax' ? '빠른 이동' : mode === 'full' ? '기본 이동' : '무한 스크롤';
  UI.showAlert(`페이지 이동 방식이 '${modeLabel}' 모드로 변경되었습니다.`);
};

const updateThemeMode = async (event: Event): Promise<void> => {
  const target = event.target as HTMLSelectElement;
  const mode = target.value as ThemeMode;
  if (mode !== 'system' && mode !== 'dark' && mode !== 'light') {
    target.value = settingsStore.themeMode;
    return;
  }

  await settingsStore.saveThemeMode(mode);
  UI.showAlert(`화면 테마가 '${THEME_MODE_LABELS[mode]}'(으)로 변경되었습니다.`);
};

const updateAltNumberEnabled = async (storageKey: string | undefined, enabled: boolean): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveAltNumberEnabled(enabled);
  UI.showAlert(`ALT + 숫자 즐겨찾기 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateNumberNavigationEnabled = async (
  storageKey: string | undefined,
  enabled: boolean,
  label: string
): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveNumberNavigationEnabled(enabled);
  UI.showAlert(`'${label}' 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateShowDateInListEnabled = async (
  storageKey: string | undefined,
  enabled: boolean,
  label: string
): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveShowDateInListEnabled(enabled);
  UI.showAlert(`'${label}' 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateNumberLabelsEnabled = async (
  storageKey: string | undefined,
  enabled: boolean,
  label: string = '번호 라벨 표시'
): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveNumberLabelsEnabled(enabled);
  Posts.addNumberLabels(enabled);
  UI.showAlert(`'${label}' 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
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

const updateAutoRefreshAllTabsEnabled = async (
  storageKey: string | undefined,
  enabled: boolean
): Promise<void> => {
  if (!storageKey) return;
  await settingsStore.saveAutoRefreshAllTabsEnabled(enabled);
  UI.showAlert(`모든 탭 글 목록 갱신 기능이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
};

const updateAutoRefreshHighlightColor = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const result = await settingsStore.saveAutoRefreshHighlightColor(target.value);
  if (!result.success) {
    UI.showAlert(result.message || '오류 발생');
    target.value = settingsStore.autoRefreshHighlightColor;
  }
};

const updateAutoRefreshHighlightDurationDebounced = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const newValue = target.value;
  debounce(async () => {
    const result = await settingsStore.saveAutoRefreshHighlightDuration(newValue);
    if (!result.success) {
      UI.showAlert(result.message || '오류 발생');
      target.value = settingsStore.autoRefreshHighlightDuration.toString();
    } else {
      UI.showAlert(`하이라이트 유지 시간이 ${newValue}초로 설정되었습니다.`);
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

const updateDcconAliasEnabled = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  await settingsStore.saveDcconAliasEnabled(target.checked);
  UI.showAlert(`디시콘 별칭 기능이 ${target.checked ? '활성화' : '비활성화'}되었습니다.`);
};

const loadDcconAliasItems = async (): Promise<void> => {
  const aliasMap = await Storage.getDcconAliasMap();
  const grouped = new Map<
    string,
    {
      packageIdx: string;
      detailIdx: string;
      title?: string;
      imageUrl?: string;
      aliases: Array<{ alias: string; updatedAt: number }>;
    }
  >();

  Object.values(aliasMap).forEach((targets) => {
    targets.forEach((target) => {
      const groupKey = `${target.packageIdx}:${target.detailIdx}`;
      const draft = grouped.get(groupKey) ?? {
        packageIdx: target.packageIdx,
        detailIdx: target.detailIdx,
        title: target.title,
        imageUrl: target.imageUrl,
        aliases: [],
      };

      draft.aliases.push({
        alias: target.alias,
        updatedAt: Number.isFinite(target.updatedAt) ? target.updatedAt : Date.now(),
      });
      if (!draft.title && target.title) draft.title = target.title;
      if (!draft.imageUrl && target.imageUrl) draft.imageUrl = target.imageUrl;
      grouped.set(groupKey, draft);
    });
  });

  const flattened: DcconAliasListItem[] = [];
  grouped.forEach((draft) => {
    const dedupedAliases = new Map<string, { alias: string; updatedAt: number }>();
    draft.aliases.forEach((entry) => {
      const normalized = normalizeAliasKey(entry.alias);
      if (!normalized) return;

      const prev = dedupedAliases.get(normalized);
      if (!prev || entry.updatedAt < prev.updatedAt) {
        dedupedAliases.set(normalized, entry);
      }
    });

    const aliases = Array.from(dedupedAliases.values())
      .sort((a, b) => a.updatedAt - b.updatedAt || a.alias.localeCompare(b.alias, 'ko', { sensitivity: 'base', numeric: true }))
      .map((entry) => entry.alias);
    if (aliases.length === 0) return;

    flattened.push({
      alias: aliases[0],
      aliases,
      aliasTooltip: aliases.map((alias) => `@${alias}`).join(', '),
      packageIdx: draft.packageIdx,
      detailIdx: draft.detailIdx,
      title: draft.title,
      imageUrl: draft.imageUrl,
      updatedAt: draft.aliases.reduce((max, item) => Math.max(max, item.updatedAt), 0),
      id: `${draft.packageIdx}:${draft.detailIdx}`,
    });
  });

  flattened.sort(compareAliasItems);
  dcconAliasItems.value = flattened;
};

const editDcconAlias = async (item: DcconAliasListItem): Promise<void> => {
  const userInput = window.prompt(
    '새 별칭을 입력하세요. 쉼표(,)로 여러 개 등록 가능\n(@ 없이, 공백 불가, 별칭당 최대 5자)',
    item.aliases.join(', ')
  );
  if (userInput === null) return;

  const aliases = parseAliasListInput(userInput);
  if (aliases.length === 0) {
    UI.showAlert('별칭은 공백 없이 별칭당 최대 5자로 입력해주세요. 예: 안녕, ㅎㅇ');
    return;
  }

  const aliasMap: DcconAliasMap = await Storage.getDcconAliasMap();
  setAliasesForTarget(
    aliasMap,
    {
      packageIdx: item.packageIdx,
      detailIdx: item.detailIdx,
      title: item.title,
      imageUrl: item.imageUrl,
    },
    aliases
  );

  await Storage.saveDcconAliasMap(aliasMap);
  await loadDcconAliasItems();
  UI.showAlert(`별칭을 ${aliases.map((alias) => `@${alias}`).join(', ')}(으)로 수정했습니다.`);
};

const removeDcconAlias = async (item: DcconAliasListItem): Promise<void> => {
  const aliasMap: DcconAliasMap = await Storage.getDcconAliasMap();
  removeAliasTargetFromMap(aliasMap, item.packageIdx, item.detailIdx);

  await Storage.saveDcconAliasMap(aliasMap);
  await loadDcconAliasItems();
  UI.showAlert(`${item.aliasTooltip} 별칭을 삭제했습니다.`);
};

const triggerRestoreInput = (): void => {
  document.getElementById('restore-settings-input')?.click();
};

const backupSettings = async (): Promise<void> => {
  try {
    const snapshot = await getLocalStorageSnapshot();
    const backupFile: SettingsBackupFile = {
      backupType: SETTINGS_BACKUP_FILE_TYPE,
      version: SETTINGS_BACKUP_FILE_VERSION,
      exportedAt: new Date().toISOString(),
      data: snapshot,
    };
    downloadJson(`dcinside_settings_backup_${buildDateString()}.json`, backupFile);
  } catch (error) {
    console.error('설정 백업 오류:', error);
    UI.showAlert(`설정 백업 실패: ${getErrorMessage(error, '알 수 없는 오류가 발생했습니다.')}`);
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

  try {
    const fileText = await file.text();
    const parsedData = JSON.parse(fileText) as unknown;
    const restorePlan = await buildRestorePlan(parsedData);

    const confirmMessage = restorePlan.migratedFromLegacyFavorites
      ? '기존 즐겨찾기 백업 파일을 감지했습니다. 현재 즐겨찾기만 파일 내용으로 덮어씌우고 나머지 설정은 유지합니다. 계속하시겠습니까?'
      : '현재 설정을 선택한 파일 내용으로 모두 덮어쓰시겠습니까? 이 작업은 되돌릴 수 없습니다.';
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      UI.showAlert('설정 복원이 취소되었습니다.');
      return;
    }

    await applyStorageSnapshot(restorePlan.snapshot);
    await syncStateAfterStorageMutation();

    UI.showAlert(
      restorePlan.migratedFromLegacyFavorites
        ? '기존 즐겨찾기 백업을 설정 형식으로 마이그레이션해 복원했습니다.'
        : '설정이 성공적으로 복원되었습니다.'
    );
  } catch (error) {
    console.error('설정 복원 중 오류:', error);
    UI.showAlert(`설정 복원 실패: ${getErrorMessage(error, '유효하지 않은 JSON 파일입니다.')}`);
  } finally {
    target.value = '';
  }
};

const openResetDialog = (): void => {
  resetConfirmInput.value = '';
  isResetDialogVisible.value = true;
};

const closeResetDialog = (): void => {
  isResetDialogVisible.value = false;
  resetConfirmInput.value = '';
};

const confirmResetApp = async (): Promise<void> => {
  if (resetConfirmInput.value.trim() !== RESET_CONFIRM_TEXT) {
    UI.showAlert(`초기화를 원하면 '${RESET_CONFIRM_TEXT}'를 입력하세요.`);
    return;
  }

  try {
    await clearLocalStorage();
    await syncStateAfterStorageMutation();
    closeResetDialog();
    UI.showAlert('앱이 기본값으로 초기화되었습니다.');
  } catch (error) {
    console.error('앱 초기화 중 오류:', error);
    UI.showAlert(`초기화 실패: ${getErrorMessage(error, '알 수 없는 오류가 발생했습니다.')}`);
  }
};

const closeModal = (): void => uiStore.closeModal();

onMounted(() => {
  settingsStore.loadSettings();
  void loadDcconAliasItems();
  chrome.storage.onChanged.addListener(storageChangeListener);
  requestAnimationFrame(() => {
    isVisible.value = true;
  });
});

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(storageChangeListener);
});
</script>

<style scoped>
/* ShortcutManagerModal.vue 스타일 */
.shortcut-manager {
  position: fixed;
  top: 50%;
  left: 50%;
  background-color: var(--dc-color-bg);
  padding: 24px;
  border-radius: 12px;
  box-shadow: var(--dc-shadow-medium);
  z-index: 10001;
  width: 500px;
  height: 800px;
  display: flex;
  flex-direction: column;
  font-family: "Noto Sans CJK KR", "NanumGothic", sans-serif;
  border: 1px solid var(--dc-color-border);
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
  overflow: hidden;
}

.shortcut-manager:not([style*="display: none;"]) {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.shortcut-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--dc-color-text-primary);
  margin: 0 0 16px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--dc-color-border-soft);
  flex-shrink: 0;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--dc-color-border);
  padding-bottom: 6px;
  flex-shrink: 0;
  align-items: end;
}

.tab-button {
  width: 100%;
  padding: 8px 4px;
  cursor: pointer;
  border: none;
  background-color: transparent;
  font-size: 0.83rem;
  font-weight: 500;
  color: var(--dc-color-text-muted);
  margin-bottom: 0;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease-in-out, border-color 0.15s ease-in-out;
  white-space: nowrap;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-button:hover {
  color: var(--dc-color-accent);
}

.tab-button.active {
  color: var(--dc-color-accent);
  border-bottom-color: var(--dc-color-accent);
  font-weight: 600;
}

.tab-content {
  flex-grow: 1;
  overflow-y: auto;
}

.shortcut-section {
  background-color: var(--dc-color-surface);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: var(--dc-shadow-soft);
  border: 1px solid var(--dc-color-border-soft);
}

.tab-pane>.shortcut-section:last-of-type {
  margin-bottom: 0;
}

.shortcut-section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--dc-color-text-secondary);
  margin-bottom: 12px;
}

.shortcut-interval-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding: 12px 10px;
  border-radius: 6px;
  border: 1px solid var(--dc-color-border-soft);
  background-color: var(--dc-color-surface);
}

.interval-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--dc-color-text-primary);
  display: inline-flex;
  align-items: center;
}

.interval-input {
  width: 80px;
  padding: 8px 10px;
  border: 1px solid var(--dc-color-border-strong);
  border-radius: 6px;
  font-size: 0.9rem;
  text-align: right;
  background: var(--dc-color-surface);
  color: var(--dc-color-text-primary);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.interval-input:focus {
  border-color: var(--dc-color-accent);
  box-shadow: var(--dc-focus-ring);
}

.color-input {
  width: 52px;
  height: 34px;
  border: 1px solid var(--dc-color-border-strong);
  border-radius: 6px;
  padding: 2px;
  background: var(--dc-color-surface);
  cursor: pointer;
}

.theme-mode-setting {
  margin-bottom: 10px;
}

.theme-mode-select {
  min-width: 140px;
  border: 1px solid var(--dc-color-border-strong);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 0.9rem;
  background: var(--dc-color-surface);
  color: var(--dc-color-text-primary);
  outline: none;
}

.theme-mode-select:focus {
  border-color: var(--dc-color-accent);
  box-shadow: var(--dc-focus-ring);
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
  color: var(--dc-color-text-muted);
  text-align: center;
  margin-top: 8px;
}

.dc-button {
  display: block;
  width: 100%;
  padding: 10px 16px;
  color: var(--dc-color-tooltip-text);
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
  text-align: center;
  box-shadow: var(--dc-shadow-soft);
}

.dc-button:hover {
  box-shadow: var(--dc-shadow-medium);
}

.dc-button:active {
  transform: translateY(1px);
  box-shadow: none;
}

.dc-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  box-shadow: none;
}

.close-button-bottom {
  background-color: var(--dc-color-text-muted);
  margin-top: 20px;
  flex-shrink: 0;
}

.close-button-bottom:hover {
  background-color: var(--dc-color-text-secondary);
}

.dc-button-blue {
  background-color: var(--dc-color-accent);
}

.dc-button-blue:hover {
  background-color: var(--dc-color-accent-hover);
}

.dc-button-orange {
  background-color: var(--dc-color-orange);
  color: var(--dc-color-text-primary);
}

.dc-button-orange:hover {
  background-color: var(--dc-color-orange-hover);
}

.dc-button-red {
  background-color: var(--dc-color-danger-strong);
}

.dc-button-red:hover:not(:disabled) {
  background-color: var(--dc-color-danger);
}

.dc-button-light {
  background-color: var(--dc-color-switch-off);
}

.dc-button-light:hover {
  background-color: var(--dc-color-text-muted);
}

.shortcut-section> :deep(.shortcut-toggle) {
  margin-bottom: 8px;
}

.shortcut-section> :deep(.shortcut-toggle:last-child) {
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
  background: var(--dc-color-border-soft);
  outline: none;
  border-radius: 4px;
  transition: opacity .2s;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--dc-color-accent);
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid var(--dc-color-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.opacity-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--dc-color-accent);
  cursor: pointer;
  border-radius: 50%;
  border: 2px solid var(--dc-color-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.slider-value {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--dc-color-text-secondary);
  min-width: 40px;
  text-align: right;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
}

.shortcut-section-note {
  font-size: 0.85rem;
  color: var(--dc-color-text-muted);
  margin-bottom: 16px;
  line-height: 1.5;
  background-color: var(--dc-color-bg);
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--dc-color-border-soft);
}

.dccon-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.alias-refresh-button {
  width: auto;
  display: inline-block;
  margin: 0;
  padding: 6px 10px;
  font-size: 0.82rem;
}

.dccon-enabled-toggle {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dccon-enabled-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--dc-color-text-secondary);
}

.dccon-switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 21px;
}

.dccon-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.dccon-switch-slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background-color: var(--dc-color-switch-off);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.dccon-switch-slider::before {
  content: '';
  position: absolute;
  width: 17px;
  height: 17px;
  left: 2px;
  top: 2px;
  border-radius: 50%;
  background-color: var(--dc-color-surface);
  transition: transform 0.15s ease;
}

.dccon-switch input:checked + .dccon-switch-slider {
  background-color: var(--dc-color-accent);
}

.dccon-switch input:checked + .dccon-switch-slider::before {
  transform: translateX(17px);
}

.alias-empty-state {
  font-size: 0.85rem;
  color: var(--dc-color-text-muted);
  border: 1px dashed var(--dc-color-border-strong);
  border-radius: 6px;
  padding: 10px;
  text-align: center;
}

.alias-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 410px;
  overflow-y: auto;
}

.alias-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--dc-color-border-soft);
  border-radius: 6px;
  padding: 8px;
  background: var(--dc-color-surface);
}

.alias-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.alias-item-main img {
  width: 50px;
  height: 50px;
  object-fit: contain;
  background: var(--dc-color-surface-subtle);
  border-radius: 4px;
  border: 1px solid var(--dc-color-border-soft);
  flex-shrink: 0;
}

.alias-item-aliases {
  font-size: 0.85rem;
  color: var(--dc-color-text-primary);
  line-height: 1.4;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.alias-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.alias-action-button {
  border: 1px solid var(--dc-color-border-strong);
  background: var(--dc-color-surface);
  color: var(--dc-color-text-secondary);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.76rem;
  cursor: pointer;
  flex-shrink: 0;
}

.alias-edit-button {
  width: 28px;
  padding: 4px 0;
  font-size: 0.88rem;
}

.alias-delete-button {
  min-width: 40px;
}

.alias-action-button:hover,
.alias-delete-button:hover {
  background: var(--dc-color-bg);
}

.warning-note {
  font-size: 0.8rem;
  color: var(--dc-color-warning-text);
  background-color: var(--dc-color-warning-bg);
  border: 1px solid var(--dc-color-warning-border);
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

.reset-dialog-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: var(--dc-color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.reset-dialog {
  width: 100%;
  max-width: 420px;
  background: var(--dc-color-surface);
  border: 1px solid var(--dc-color-border);
  border-radius: 10px;
  padding: 18px;
  box-shadow: var(--dc-shadow-medium);
}

.reset-dialog-title {
  margin: 0 0 10px;
  font-size: 1rem;
  color: var(--dc-color-text-primary);
}

.reset-dialog-message {
  margin: 0 0 12px;
  font-size: 0.9rem;
  color: var(--dc-color-text-secondary);
  line-height: 1.5;
}

.reset-dialog-input {
  width: 50%;
  min-width: 150px;
  max-width: 220px;
  display: block;
  margin: 0 auto;
  border: 1px solid var(--dc-color-border-strong);
  border-radius: 6px;
  padding: 9px 10px;
  font-size: 0.9rem;
  background: var(--dc-color-surface);
  color: var(--dc-color-text-primary);
  outline: none;
  text-align: center;
}

.reset-dialog-input:focus {
  border-color: var(--dc-color-accent);
  box-shadow: var(--dc-focus-ring);
}

.reset-dialog-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.reset-dialog-actions .dc-button {
  margin-top: 0;
}
</style>
