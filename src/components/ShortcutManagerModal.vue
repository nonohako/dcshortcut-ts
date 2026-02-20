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
          <ShortcutToggle v-for="action in ['A', 'S', 'GallerySearch', 'GlobalSearch', 'Z', 'X', 'Q', 'E', 'F', 'G', 'R']" :key="action"
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
import { ref, onMounted, onUnmounted, computed, nextTick, type Ref, type ComputedRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settingsStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { FavoriteGalleries, FavoriteProfiles } from '@/stores/favoritesStore';
import type { DcconAliasMap, DcconAliasTarget } from '@/types';
import { useUiStore } from '@/stores/uiStore';
import UI from '@/services/UI';
import Posts from '@/services/Posts';
import Events from '@/services/Events';
import { normalizeShortcutWithFallback } from '@/services/Shortcut';
import { DCCON_ALIAS_MAP_KEY } from '@/services/Global';
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
const activeTab = ref<TabName>('shortcuts');
const macroIntervalTooltipText = ref<string>("너무 짧게 설정 시 IP 차단 위험 증가 (2초 이상 권장)");
const dcconAliasItems = ref<DcconAliasListItem[]>([]);
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

const normalizeAliasKey = (alias: string): string => alias.trim().toLocaleLowerCase();
const sanitizeSingleAliasInput = (rawAlias: string): string => {
  const alias = rawAlias.replace(/^@+/, '').trim();
  if (!alias || /\s/.test(alias)) return '';
  return alias.slice(0, 5);
};
const parseAliasListInput = (rawInput: string): string[] => {
  const aliases: string[] = [];
  const seen = new Set<string>();

  rawInput.split(',').forEach((token) => {
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
  const firstChar = alias.trim().charAt(0);
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

// =================================================================
// Event Handlers and Functions (이벤트 핸들러 및 함수)
// =================================================================

const debounce = (callback: () => void, delay: number = 500): void => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(callback, delay);
};

const updatePageNavMode = async (mode: 'ajax' | 'full' | 'infinite'): Promise<void> => {
  await settingsStore.savePageNavigationMode(mode);
  Events.setPageNavigationMode(mode);
  const modeLabel =
    mode === 'ajax' ? '빠른 이동' : mode === 'full' ? '기본 이동' : '무한 스크롤';
  UI.showAlert(`페이지 이동 방식이 '${modeLabel}' 모드로 변경되었습니다.`);
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
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid #dee2e6;
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
  color: #6c757d;
  margin-bottom: 0;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease-in-out, border-color 0.15s ease-in-out;
  white-space: nowrap;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
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

.tab-pane>.shortcut-section:last-of-type {
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

.color-input {
  width: 52px;
  height: 34px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  padding: 2px;
  background: #fff;
  cursor: pointer;
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
  color: #495057;
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
  background-color: #adb5bd;
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
  background-color: #fff;
  transition: transform 0.15s ease;
}

.dccon-switch input:checked + .dccon-switch-slider {
  background-color: #0d6efd;
}

.dccon-switch input:checked + .dccon-switch-slider::before {
  transform: translateX(17px);
}

.alias-empty-state {
  font-size: 0.85rem;
  color: #6c757d;
  border: 1px dashed #ced4da;
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
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 8px;
  background: #fff;
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
  background: #f7f8fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  flex-shrink: 0;
}

.alias-item-aliases {
  font-size: 0.85rem;
  color: #212529;
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
  border: 1px solid #ced4da;
  background: #fff;
  color: #495057;
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
  background: #f8f9fa;
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
