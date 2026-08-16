<template>
  <div
    ref="favoritesContainer"
    class="favorites-container"
    :class="{ 'is-resizing': isResizing }"
    :style="favoritesContainerStyle"
    v-show="isVisible"
  >
    <header class="favorites-header">
      <div>
        <h2>즐겨찾기</h2>
        <p>폴더와 순서를 드래그해서 변경할 수 있습니다.</p>
      </div>
      <div class="favorites-header-actions">
        <button class="layout-reset-button" title="창과 폴더 영역 크기를 기본값으로 되돌립니다." @click="resetLayoutSize">
          크기 초기화
        </button>
        <button class="icon-button close-icon" title="닫기" @click="closeModal">×</button>
      </div>
    </header>

    <div class="favorites-layout" v-if="folders !== null">
      <aside class="folder-panel" :style="folderPanelStyle">
        <div class="folder-panel-header">
          <strong>폴더</strong>
          <button class="icon-button" title="새 폴더" @click="handleAddFolder">＋</button>
        </div>

        <label class="search-box folder-search-box">
          <span>⌕</span>
          <input
            ref="searchInput"
            :value="searchQuery"
            type="search"
            placeholder="모든 폴더 검색"
            aria-label="모든 폴더 즐겨찾기 검색"
            @input="updateSearchQuery"
            @compositionend="updateSearchQuery"
          />
          <button v-if="searchQuery" type="button" title="검색어 지우기" @click="searchQuery = ''">×</button>
        </label>

        <ul class="folder-list">
          <li
            v-for="folder in folders"
            :key="folder.id"
            class="folder-item"
            :class="{
              active: folder.id === activeFolderId,
              'drop-target': dragOverFolderId === folder.id,
            }"
            @click="selectFolder(folder.id)"
            @dragover.prevent="handleFolderDragOver(folder.id)"
            @dragleave="clearFolderDragOver(folder.id)"
            @drop.prevent="handleDropOnFolder(folder.id)"
          >
            <span
              class="drag-handle folder-drag-handle"
              draggable="true"
              title="폴더 순서 변경"
              @click.stop
              @dragstart="handleFolderDragStart($event, folder.id)"
              @dragend="clearDragState"
            >⋮⋮</span>
            <span class="folder-name">{{ folder.name }}</span>
            <span class="folder-count">{{ folder.favorites.length }}</span>
          </li>
        </ul>

        <button class="add-folder-button" @click="handleAddFolder">＋ 새 폴더</button>
      </aside>

      <div
        v-if="!isCompactLayout"
        class="sidebar-resize-handle"
        role="separator"
        aria-label="폴더 영역 너비 조절"
        aria-orientation="vertical"
        :aria-valuenow="Math.round(sidebarWidth)"
        title="드래그하여 폴더 영역 너비 조절"
        @pointerdown="startSidebarResize"
      ></div>

      <section class="favorites-panel">
        <div class="favorites-toolbar">
          <div class="folder-title-wrap">
            <h3>{{ isSearching ? '전체 검색 결과' : activeFolderName }}</h3>
            <span>{{ isSearching ? filteredFavorites.length : activeFavorites.length }}개</span>
          </div>
          <div class="toolbar-actions">
            <button class="small-button" title="현재 선택된 폴더 이름 변경" @click="handleRenameFolder">이름 변경</button>
            <button
              class="small-button danger-text"
              title="현재 선택된 폴더 삭제"
              :disabled="folders.length <= 1"
              @click="handleRemoveFolder"
            >폴더 삭제</button>
            <button class="small-button" @click="toggleSelectionMode">
              {{ selectionMode ? '선택 종료' : '여러 항목 선택' }}
            </button>
            <button class="small-button primary add-current-button" @click="addCurrentFavorite">
              {{ addCurrentFavoriteLabel }}
            </button>
          </div>
        </div>

        <div v-if="selectionMode" class="selection-toolbar">
          <label class="select-all-label">
            <input
              type="checkbox"
              :checked="allFilteredSelected"
              :disabled="filteredFavorites.length === 0"
              @change="toggleSelectAllFiltered"
            />
            검색 결과 전체
          </label>
          <strong>{{ selectedIds.size }}개 선택</strong>
          <select v-model="batchTargetFolderId" :disabled="selectedIds.size === 0 || batchTargetFolders.length === 0">
            <option value="">이동할 폴더…</option>
            <option v-for="folder in batchTargetFolders" :key="folder.id" :value="folder.id">
              {{ folder.name }}
            </option>
          </select>
          <button
            class="small-button primary"
            :disabled="selectedIds.size === 0 || !batchTargetFolderId"
            @click="moveSelectedFavorites"
          >이동</button>
          <button
            class="small-button danger"
            :disabled="selectedIds.size === 0"
            @click="removeSelectedFavorites"
          >삭제</button>
        </div>

        <TransitionGroup
          tag="ul"
          name="favorite-sort"
          class="favorites-list"
          :class="{ 'is-dragging': draggedFavoriteIds.length > 0 }"
          @dragover.prevent="handleFavoritesListDragOver"
          @drop.prevent="commitFavoriteDrop"
        >
          <li
            v-for="favorite in displayedFavorites"
            :key="favorite.id"
            :data-favorite-id="favorite.id"
            class="favorite-item"
            :class="{
              selected: selectedIds.has(favorite.id),
              'drag-preview-item': draggedFavoriteIds.includes(favorite.id),
            }"
            @dragover.prevent="handleFavoriteDragOver($event, favorite.id)"
            @drop.stop.prevent="commitFavoriteDrop"
          >
            <input
              v-if="selectionMode"
              class="favorite-checkbox"
              type="checkbox"
              :checked="selectedIds.has(favorite.id)"
              @click.stop
              @change="toggleSelected(favorite.id)"
            />
            <span
              class="drag-handle favorite-drag-handle"
              :class="{ disabled: isSearching }"
              :draggable="!isSearching"
              :title="isSearching ? '전체 검색 중에는 폴더별 순서 변경을 사용할 수 없습니다.' : '드래그하여 순서 변경 또는 다른 폴더로 이동'"
              @click.stop
              @dragstart="handleFavoriteDragStart($event, favorite)"
              @dragend="clearDragState"
            >⋮⋮</span>
            <input
              v-if="customShortcutItemId === favorite.id"
              :ref="setCustomShortcutInput"
              class="shortcut-select custom-shortcut-input"
              type="text"
              readonly
              value=""
              placeholder="키 입력..."
              title="원하는 단축키를 누르세요. Esc로 취소합니다."
              @click.stop
              @keydown="handleCustomShortcutKeydown(favorite.id, favorite.sourceFolderId, $event)"
              @blur="cancelCustomShortcutCapture(favorite.id)"
            />
            <select
              v-else
              class="shortcut-select"
              :value="getShortcutSelectValue(favorite.shortcut)"
              title="즐겨찾기 단축키 지정"
              @click.stop
              @change="handleShortcutChange(favorite.id, favorite.sourceFolderId, $event)"
            >
              <option value="">—</option>
              <option
                v-if="isCustomShortcut(favorite.shortcut)"
                :value="CURRENT_CUSTOM_SHORTCUT_VALUE"
                disabled
              >
                {{ favorite.shortcut }}
              </option>
              <option v-for="shortcut in shortcutOptions" :key="shortcut" :value="shortcut">
                Alt+{{ shortcut }}
              </option>
              <option :value="CUSTOM_SHORTCUT_VALUE">Custom</option>
            </select>
            <button
              class="favorite-main"
              title="클릭하여 열기 · 휠 클릭으로 새 탭에서 열기"
              @click="navigateTo(favorite)"
              @mousedown.middle.prevent
              @auxclick="handleFavoriteAuxClick(favorite, $event)"
            >
              <span class="favorite-name">
                <span class="favorite-title">{{ favorite.name || favorite.galleryId }}</span><span v-if="isSearching" class="favorite-folder-label">({{ favorite.sourceFolderName }})</span>
              </span>
              <span class="favorite-meta">{{ favorite.galleryId }}</span>
            </button>
            <select
              class="move-select"
              value=""
              title="다른 폴더로 이동"
              :disabled="getOtherFolders(favorite.sourceFolderId).length === 0"
              @click.stop
              @change="moveSingleFavorite(favorite.id, favorite.sourceFolderId, $event)"
            >
              <option value="">이동…</option>
              <option v-for="folder in getOtherFolders(favorite.sourceFolderId)" :key="folder.id" :value="folder.id">
                {{ folder.name }}
              </option>
            </select>
            <button class="icon-button remove-button" title="삭제" @click.stop="removeOne(favorite.id, favorite.sourceFolderId)">×</button>
          </li>

          <li v-if="filteredFavorites.length === 0" key="favorite-empty" class="favorite-empty">
            {{ searchQuery ? '검색 결과가 없습니다.' : '이 폴더에 등록된 즐겨찾기가 없습니다.' }}
          </li>
        </TransitionGroup>

      </section>
    </div>

    <div v-else class="favorites-loading">즐겨찾기 목록을 불러오는 중...</div>

    <footer class="favorites-footer">
      <button class="footer-button settings-button" @click="openShortcutManager">설정</button>
      <button class="footer-button" @click="closeModal">닫기</button>
    </footer>

    <Transition name="favorites-undo">
      <div v-if="pendingUndo" class="favorites-undo-toast" role="status" aria-live="polite">
        <span>{{ pendingUndo.message }}</span>
        <button type="button" @click="undoLastFavoritesChange">실행 취소</button>
      </div>
    </Transition>

    <div
      class="modal-resize-handle"
      role="separator"
      aria-label="즐겨찾기 창 크기 조절"
      title="드래그하여 창 크기 조절"
      @pointerdown="startModalResize"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import Gallery from '@/services/Gallery';
import Storage from '@/services/Storage';
import UI from '@/services/UI';
import { getShortcutComboFromEvent } from '@/services/Shortcut';
import { FAVORITES_LAYOUT_KEY } from '@/services/Global';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import type {
  FavoriteFolder,
  FavoriteGalleryInfo,
  FavoriteItem,
  FavoriteShortcut,
  FavoritesStateSnapshot,
} from '@/types';

const favoritesStore = useFavoritesStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const { folders, activeFolderId, activeFolderName, activeFavorites } = storeToRefs(favoritesStore);

const isVisible = ref(false);
const searchQuery = ref('');
const selectionMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const batchTargetFolderId = ref('');
const draggedFavoriteIds = ref<string[]>([]);
const draggedSourceFolderId = ref<string | null>(null);
const draggedFolderId = ref<string | null>(null);
const dragOverFolderId = ref<string | null>(null);
const dragPreviewOrderIds = ref<string[] | null>(null);
const customShortcutItemId = ref<string | null>(null);
const customShortcutInput = ref<HTMLInputElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);

interface PendingUndo {
  message: string;
  snapshot: FavoritesStateSnapshot;
  expectedDataKey: string;
}

const pendingUndo = ref<PendingUndo | null>(null);
let undoTimer: number | null = null;
const UNDO_DURATION_MS = 7000;

interface FavoritesLayoutPreferences {
  width: number;
  height: number;
  sidebarWidth: number;
}

interface DisplayFavorite extends FavoriteItem {
  sourceFolderId: string;
  sourceFolderName: string;
}

type ActiveResize =
  | {
      kind: 'modal';
      pointerId: number;
      startX: number;
      startY: number;
      startWidth: number;
      startHeight: number;
    }
  | {
      kind: 'sidebar';
      pointerId: number;
      startX: number;
      startWidth: number;
    };

const DEFAULT_LAYOUT: FavoritesLayoutPreferences = {
  width: 820,
  height: 680,
  sidebarWidth: 190,
};
const favoritesContainer = ref<HTMLElement | null>(null);
const modalWidth = ref(DEFAULT_LAYOUT.width);
const modalHeight = ref(DEFAULT_LAYOUT.height);
const sidebarWidth = ref(DEFAULT_LAYOUT.sidebarWidth);
const isCompactLayout = ref(window.innerWidth <= 620);
const isResizing = ref(false);
let activeResize: ActiveResize | null = null;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampLayout = (layout: FavoritesLayoutPreferences): FavoritesLayoutPreferences => {
  const compact = window.innerWidth <= 620;
  const viewportPadding = compact ? 12 : 24;
  const maxWidth = Math.max(320, window.innerWidth - viewportPadding);
  const maxHeight = Math.max(360, window.innerHeight - viewportPadding);
  const minWidth = Math.min(520, maxWidth);
  const minHeight = Math.min(420, maxHeight);
  const width = clamp(layout.width, minWidth, maxWidth);
  const height = clamp(layout.height, minHeight, maxHeight);
  const maxSidebarWidth = Math.max(130, Math.min(340, width - 340));

  return {
    width,
    height,
    sidebarWidth: clamp(layout.sidebarWidth, 130, maxSidebarWidth),
  };
};

const applyLayout = (layout: FavoritesLayoutPreferences): void => {
  const clamped = clampLayout(layout);
  modalWidth.value = clamped.width;
  modalHeight.value = clamped.height;
  sidebarWidth.value = clamped.sidebarWidth;
};

const favoritesContainerStyle = computed(() => ({
  width: `${modalWidth.value}px`,
  height: `${modalHeight.value}px`,
}));

const folderPanelStyle = computed(() =>
  isCompactLayout.value
    ? undefined
    : {
        width: `${sidebarWidth.value}px`,
        minWidth: `${sidebarWidth.value}px`,
      }
);

const isDcInsidePage = (() => {
  const hostname = window.location.hostname.toLocaleLowerCase();
  return hostname === 'dcinside.com' || hostname.endsWith('.dcinside.com');
})();

const addCurrentFavoriteLabel = computed(() =>
  isDcInsidePage ? '＋ 현재 갤러리 추가' : '＋ 현재 페이지 추가'
);

const getFavoritesDataKey = (snapshot: FavoritesStateSnapshot): string =>
  JSON.stringify(snapshot.data);

const dismissPendingUndo = (): void => {
  if (undoTimer !== null) window.clearTimeout(undoTimer);
  undoTimer = null;
  pendingUndo.value = null;
};

const showPendingUndo = (
  message: string,
  snapshot: FavoritesStateSnapshot,
  expectedDataKey: string
): void => {
  dismissPendingUndo();
  pendingUndo.value = { message, snapshot, expectedDataKey };
  undoTimer = window.setTimeout(dismissPendingUndo, UNDO_DURATION_MS);
};

const performUndoableChange = async <T,>(message: string, operation: () => Promise<T>): Promise<T> => {
  dismissPendingUndo();
  const before = favoritesStore.getStateSnapshot();
  try {
    return await operation();
  } finally {
    const after = favoritesStore.getStateSnapshot();
    const beforeDataKey = getFavoritesDataKey(before);
    const afterDataKey = getFavoritesDataKey(after);
    if (beforeDataKey !== afterDataKey) showPendingUndo(message, before, afterDataKey);
  }
};

const undoLastFavoritesChange = async (): Promise<void> => {
  const undo = pendingUndo.value;
  if (!undo) return;

  if (getFavoritesDataKey(favoritesStore.getStateSnapshot()) !== undo.expectedDataKey) {
    dismissPendingUndo();
    UI.showAlert('이후에 다른 변경이 있어 되돌릴 수 없습니다.');
    return;
  }

  dismissPendingUndo();
  try {
    await favoritesStore.restoreStateSnapshot(undo.snapshot);
    searchQuery.value = '';
    resetSelection();
    UI.showAlert('즐겨찾기 변경을 되돌렸습니다.');
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '즐겨찾기 변경을 되돌리지 못했습니다.');
  }
};

// 되돌리기 대상 이후에 다른 로컬/동기화 변경이 생기면 오래된 스냅샷을 즉시 폐기합니다.
watch(folders, () => {
  if (pendingUndo.value) dismissPendingUndo();
}, { deep: true, flush: 'sync' });

const parseStoredLayout = (value: unknown): FavoritesLayoutPreferences => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return DEFAULT_LAYOUT;
  const record = value as Record<string, unknown>;
  const readDimension = (key: keyof FavoritesLayoutPreferences, fallback: number): number => {
    const parsed = Number(record[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    width: readDimension('width', DEFAULT_LAYOUT.width),
    height: readDimension('height', DEFAULT_LAYOUT.height),
    sidebarWidth: readDimension('sidebarWidth', DEFAULT_LAYOUT.sidebarWidth),
  };
};

const saveLayoutPreferences = async (): Promise<void> => {
  await Storage.setData(FAVORITES_LAYOUT_KEY, {
    width: Math.round(modalWidth.value),
    height: Math.round(modalHeight.value),
    sidebarWidth: Math.round(sidebarWidth.value),
  } satisfies FavoritesLayoutPreferences);
};

const loadLayoutPreferences = async (): Promise<void> => {
  const stored = await Storage.getData<unknown>(FAVORITES_LAYOUT_KEY, DEFAULT_LAYOUT);
  applyLayout(parseStoredLayout(stored));
};

const resetLayoutSize = async (): Promise<void> => {
  applyLayout(DEFAULT_LAYOUT);
  try {
    await saveLayoutPreferences();
  } catch (error) {
    console.error('[Favorites Layout] 크기 초기화 저장 실패:', error);
  }
};

const detachResizeListeners = (): void => {
  window.removeEventListener('pointermove', handleResizePointerMove);
  window.removeEventListener('pointerup', finishResize);
  window.removeEventListener('pointercancel', finishResize);
};

const attachResizeListeners = (): void => {
  detachResizeListeners();
  window.addEventListener('pointermove', handleResizePointerMove);
  window.addEventListener('pointerup', finishResize);
  window.addEventListener('pointercancel', finishResize);
};

const startModalResize = (event: PointerEvent): void => {
  if (event.button !== 0) return;
  event.preventDefault();
  activeResize = {
    kind: 'modal',
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: modalWidth.value,
    startHeight: modalHeight.value,
  };
  isResizing.value = true;
  attachResizeListeners();
};

const startSidebarResize = (event: PointerEvent): void => {
  if (event.button !== 0) return;
  event.preventDefault();
  activeResize = {
    kind: 'sidebar',
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: sidebarWidth.value,
  };
  isResizing.value = true;
  attachResizeListeners();
};

function handleResizePointerMove(event: PointerEvent): void {
  if (!activeResize || event.pointerId !== activeResize.pointerId) return;
  event.preventDefault();

  if (activeResize.kind === 'modal') {
    // 창은 화면 중앙 고정이므로 양쪽 가장자리가 함께 늘어나는 만큼 2배로 반영합니다.
    applyLayout({
      width: activeResize.startWidth + (event.clientX - activeResize.startX) * 2,
      height: activeResize.startHeight + (event.clientY - activeResize.startY) * 2,
      sidebarWidth: sidebarWidth.value,
    });
    return;
  }

  applyLayout({
    width: modalWidth.value,
    height: modalHeight.value,
    sidebarWidth: activeResize.startWidth + event.clientX - activeResize.startX,
  });
}

function finishResize(event: PointerEvent): void {
  if (!activeResize || event.pointerId !== activeResize.pointerId) return;
  activeResize = null;
  isResizing.value = false;
  detachResizeListeners();
  void saveLayoutPreferences().catch((error) => {
    console.error('[Favorites Layout] 크기 저장 실패:', error);
  });
}

const handleViewportResize = (): void => {
  isCompactLayout.value = window.innerWidth <= 620;
  applyLayout({
    width: modalWidth.value,
    height: modalHeight.value,
    sidebarWidth: sidebarWidth.value,
  });
};

const shortcutOptions: FavoriteShortcut[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const NUMBER_SHORTCUT_PATTERN = /^[0-9]$/;
const ALT_NUMBER_SHORTCUT_PATTERN = /^Alt\+([0-9])$/;
const CUSTOM_SHORTCUT_VALUE = '__custom__';
const CURRENT_CUSTOM_SHORTCUT_VALUE = '__current_custom__';

const isCustomShortcut = (shortcut: FavoriteShortcut | null): boolean =>
  shortcut !== null && !NUMBER_SHORTCUT_PATTERN.test(shortcut);

const getShortcutSelectValue = (shortcut: FavoriteShortcut | null): string =>
  isCustomShortcut(shortcut) ? CURRENT_CUSTOM_SHORTCUT_VALUE : shortcut ?? '';

const formatFavoriteShortcut = (shortcut: FavoriteShortcut): string =>
  NUMBER_SHORTCUT_PATTERN.test(shortcut) ? `Alt+${shortcut}` : shortcut;

const getConfiguredShortcutConflictMessage = (
  shortcut: FavoriteShortcut
): string | null => {
  const shortcutCombo = formatFavoriteShortcut(shortcut);
  const conflict = settingsStore.findConfiguredShortcutConflict(shortcutCombo);
  return conflict
    ? `'${shortcutCombo}'는 이미 '${conflict.label}' 기능에 할당되어 있습니다.`
    : null;
};

const getStoredFavoriteShortcut = (
  itemId: string,
  folderId: string
): FavoriteShortcut | null =>
  folders.value
    ?.find((folder) => folder.id === folderId)
    ?.favorites.find((favorite) => favorite.id === itemId)
    ?.shortcut ?? null;

const setCustomShortcutInput = (element: unknown): void => {
  customShortcutInput.value = element instanceof HTMLInputElement ? element : null;
};

const startCustomShortcutCapture = async (itemId: string): Promise<void> => {
  customShortcutItemId.value = itemId;
  await nextTick();
  customShortcutInput.value?.focus();
};

const cancelCustomShortcutCapture = (itemId: string): void => {
  if (customShortcutItemId.value === itemId) customShortcutItemId.value = null;
};

const updateSearchQuery = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  // Vue의 기본 v-model은 한글 조합이 끝날 때까지 값을 보류하므로 현재 DOM 값을 즉시 반영합니다.
  searchQuery.value = target.value;
};

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const HANGUL_SYLLABLE_BLOCK = 588;
const INITIAL_CONSONANTS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const INITIAL_CONSONANT_PATTERN = /^[ㄱ-ㅎ\s]+$/;

const extractInitialConsonants = (value: string): string =>
  [...value].map((character) => {
    const code = character.charCodeAt(0);
    if (code < HANGUL_BASE || code > HANGUL_END) return character;
    return INITIAL_CONSONANTS[Math.floor((code - HANGUL_BASE) / HANGUL_SYLLABLE_BLOCK)];
  }).join('');

const matchesSearchQuery = (favorite: DisplayFavorite, query: string): boolean => {
  const searchTarget = `${favorite.name} ${favorite.galleryId} ${favorite.sourceFolderName}`
    .toLocaleLowerCase();
  if (searchTarget.includes(query)) return true;
  return INITIAL_CONSONANT_PATTERN.test(query) && extractInitialConsonants(searchTarget).includes(query);
};

const isSearching = computed(() => searchQuery.value.trim().length > 0);

const allFavorites = computed<DisplayFavorite[]>(() =>
  (folders.value ?? []).flatMap((folder) =>
    folder.favorites.map((favorite) => ({
      ...favorite,
      sourceFolderId: folder.id,
      sourceFolderName: folder.name,
    }))
  )
);

const activeDisplayFavorites = computed<DisplayFavorite[]>(() =>
  activeFavorites.value.map((favorite) => ({
    ...favorite,
    sourceFolderId: activeFolderId.value,
    sourceFolderName: activeFolderName.value,
  }))
);

const filteredFavorites = computed<DisplayFavorite[]>(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return activeDisplayFavorites.value;
  return allFavorites.value.filter((favorite) => matchesSearchQuery(favorite, query));
});

const displayedFavorites = computed(() => {
  if (!dragPreviewOrderIds.value) return filteredFavorites.value;
  const filteredById = new Map(filteredFavorites.value.map((favorite) => [favorite.id, favorite]));
  return dragPreviewOrderIds.value.flatMap((itemId) => {
    const favorite = filteredById.get(itemId);
    return favorite ? [favorite] : [];
  });
});

const getOtherFolders = (sourceFolderId: string): FavoriteFolder[] =>
  folders.value?.filter((folder) => folder.id !== sourceFolderId) ?? [];

const selectedFavorites = computed(() => {
  const selected = selectedIds.value;
  return allFavorites.value.filter((favorite) => selected.has(favorite.id));
});

const batchTargetFolders = computed(() => {
  const availableFolders = folders.value ?? [];
  const sourceFolderIds = new Set(selectedFavorites.value.map((favorite) => favorite.sourceFolderId));
  if (sourceFolderIds.size !== 1) return availableFolders;
  const [onlySourceFolderId] = sourceFolderIds;
  return availableFolders.filter((folder) => folder.id !== onlySourceFolderId);
});

const allFilteredSelected = computed(() =>
  filteredFavorites.value.length > 0 &&
  filteredFavorites.value.every((favorite) => selectedIds.value.has(favorite.id))
);

const replaceSelectedIds = (ids: Iterable<string>): void => {
  selectedIds.value = new Set(ids);
};

const resetSelection = (): void => {
  replaceSelectedIds([]);
  batchTargetFolderId.value = '';
};

const selectFolder = async (folderId: string): Promise<void> => {
  if (folderId === activeFolderId.value) return;
  await favoritesStore.switchFolder(folderId);
  searchQuery.value = '';
  resetSelection();
};

const toggleSelectionMode = (): void => {
  selectionMode.value = !selectionMode.value;
  resetSelection();
};

const toggleSelected = (itemId: string): void => {
  const next = new Set(selectedIds.value);
  if (next.has(itemId)) next.delete(itemId);
  else next.add(itemId);
  selectedIds.value = next;
};

const toggleSelectAllFiltered = (): void => {
  const next = new Set(selectedIds.value);
  if (allFilteredSelected.value) {
    filteredFavorites.value.forEach((favorite) => next.delete(favorite.id));
  } else {
    filteredFavorites.value.forEach((favorite) => next.add(favorite.id));
  }
  selectedIds.value = next;
};

const handleAddFolder = async (): Promise<void> => {
  const name = window.prompt('새 폴더 이름을 입력하세요:');
  if (!name) return;
  try {
    await favoritesStore.addFolder(name);
    searchQuery.value = '';
    resetSelection();
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '폴더를 추가하지 못했습니다.');
  }
};

const handleRenameFolder = async (): Promise<void> => {
  const name = window.prompt('폴더 이름을 변경하세요:', activeFolderName.value);
  if (!name || name.trim() === activeFolderName.value) return;
  try {
    await favoritesStore.renameFolder(activeFolderId.value, name);
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '폴더 이름을 변경하지 못했습니다.');
  }
};

const handleRemoveFolder = async (): Promise<void> => {
  if (!folders.value || folders.value.length <= 1) return;
  const count = activeFavorites.value.length;
  if (!window.confirm(`'${activeFolderName.value}' 폴더와 즐겨찾기 ${count}개를 삭제할까요?`)) return;
  try {
    await performUndoableChange('폴더를 삭제했습니다.', () =>
      favoritesStore.removeFolder(activeFolderId.value)
    );
    searchQuery.value = '';
    resetSelection();
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '폴더를 삭제하지 못했습니다.');
  }
};

const navigateTo = (gallery: FavoriteGalleryInfo): void => {
  UI.navigateToGallery(gallery, { newTab: settingsStore.favoritesOpenInNewTab });
  uiStore.closeModal();
};

const handleFavoriteAuxClick = (gallery: FavoriteGalleryInfo, event: MouseEvent): void => {
  if (event.button !== 1) return;
  event.preventDefault();
  event.stopPropagation();
  UI.navigateToGallery(gallery, { newTab: true });
};

const addCurrentFavorite = async (): Promise<void> => {
  try {
    let favorite: FavoriteGalleryInfo;
    let itemLabel: '갤러리' | '페이지';

    if (isDcInsidePage) {
      const info = Gallery.getInfo();
      if (!info.galleryId || !['board', 'mgallery', 'mini'].includes(info.galleryType)) {
        UI.showAlert('즐겨찾기 등록은 갤러리 페이지에서만 가능합니다.');
        return;
      }
      favorite = {
        galleryType: info.galleryType as FavoriteGalleryInfo['galleryType'],
        galleryId: info.galleryId,
        name: info.galleryName,
      };
      itemLabel = '갤러리';
    } else {
      const url = new URL(window.location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        UI.showAlert('이 페이지 주소는 즐겨찾기에 등록할 수 없습니다.');
        return;
      }
      url.hash = '';
      const title = document.title.replace(/\s+/g, ' ').trim().slice(0, 120);
      favorite = {
        galleryType: 'web',
        galleryId: url.href,
        url: url.href,
        name: title || url.hostname,
      };
      itemLabel = '페이지';
    }

    const result = await favoritesStore.addFavorite(favorite);
    UI.showAlert(result.created ? `현재 ${itemLabel}를 추가했습니다.` : `이미 등록된 ${itemLabel}입니다.`);
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '즐겨찾기를 추가하지 못했습니다.');
  }
};

const removeOne = async (itemId: string, sourceFolderId: string): Promise<void> => {
  try {
    await performUndoableChange('즐겨찾기를 삭제했습니다.', () =>
      favoritesStore.removeFavorites([itemId], sourceFolderId)
    );
    const next = new Set(selectedIds.value);
    next.delete(itemId);
    selectedIds.value = next;
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '즐겨찾기를 삭제하지 못했습니다.');
  }
};

const groupFavoritesByFolder = (favorites: DisplayFavorite[]): Map<string, DisplayFavorite[]> => {
  const grouped = new Map<string, DisplayFavorite[]>();
  favorites.forEach((favorite) => {
    const group = grouped.get(favorite.sourceFolderId) ?? [];
    group.push(favorite);
    grouped.set(favorite.sourceFolderId, group);
  });
  return grouped;
};

const removeSelectedFavorites = async (): Promise<void> => {
  if (selectedIds.value.size === 0) return;
  if (!window.confirm(`선택한 즐겨찾기 ${selectedIds.value.size}개를 삭제할까요?`)) return;
  try {
    const count = selectedIds.value.size;
    await performUndoableChange(`${count}개 즐겨찾기를 삭제했습니다.`, async () => {
      for (const [folderId, favorites] of groupFavoritesByFolder(selectedFavorites.value)) {
        await favoritesStore.removeFavorites(favorites.map((favorite) => favorite.id), folderId);
      }
    });
    resetSelection();
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '즐겨찾기를 삭제하지 못했습니다.');
  }
};

const moveSelectedFavorites = async (): Promise<void> => {
  if (!batchTargetFolderId.value || selectedIds.value.size === 0) return;
  try {
    let movedCount = 0;
    await performUndoableChange('즐겨찾기를 일괄 이동했습니다.', async () => {
      for (const [sourceFolderId, favorites] of groupFavoritesByFolder(selectedFavorites.value)) {
        if (sourceFolderId === batchTargetFolderId.value) continue;
        await favoritesStore.moveFavorites(
          favorites.map((favorite) => favorite.id),
          sourceFolderId,
          batchTargetFolderId.value
        );
        movedCount += favorites.length;
      }
    });
    UI.showAlert(
      movedCount > 0
        ? `${movedCount}개 즐겨찾기를 이동했습니다.`
        : '선택한 즐겨찾기가 이미 대상 폴더에 있습니다.'
    );
    resetSelection();
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '즐겨찾기를 이동하지 못했습니다.');
  }
};

const moveSingleFavorite = async (
  itemId: string,
  sourceFolderId: string,
  event: Event
): Promise<void> => {
  const select = event.target as HTMLSelectElement;
  const targetFolderId = select.value;
  select.value = '';
  if (!targetFolderId) return;
  try {
    await performUndoableChange('즐겨찾기를 이동했습니다.', () =>
      favoritesStore.moveFavorites([itemId], sourceFolderId, targetFolderId)
    );
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '즐겨찾기를 이동하지 못했습니다.');
  }
};

const handleShortcutChange = async (
  itemId: string,
  sourceFolderId: string,
  event: Event
): Promise<void> => {
  const select = event.target as HTMLSelectElement;
  if (select.value === CUSTOM_SHORTCUT_VALUE) {
    await startCustomShortcutCapture(itemId);
    return;
  }
  if (select.value === CURRENT_CUSTOM_SHORTCUT_VALUE) return;

  const shortcut = select.value === '' ? null : select.value as FavoriteShortcut;
  if (shortcut) {
    const conflictMessage = getConfiguredShortcutConflictMessage(shortcut);
    if (conflictMessage) {
      select.value = getShortcutSelectValue(getStoredFavoriteShortcut(itemId, sourceFolderId));
      UI.showAlert(conflictMessage);
      return;
    }
  }
  try {
    await favoritesStore.assignShortcut(itemId, shortcut, sourceFolderId);
    UI.showAlert(
      shortcut === null
        ? '즐겨찾기 단축키를 해제했습니다.'
        : `${formatFavoriteShortcut(shortcut)} 단축키를 지정했습니다.`
    );
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '단축키를 변경하지 못했습니다.');
  }
};

const handleCustomShortcutKeydown = async (
  itemId: string,
  sourceFolderId: string,
  event: KeyboardEvent
): Promise<void> => {
  event.preventDefault();
  event.stopPropagation();

  if (event.key === 'Escape') {
    cancelCustomShortcutCapture(itemId);
    return;
  }

  const shortcutCombo = getShortcutComboFromEvent(event);
  if (!shortcutCombo) return;
  const altNumberMatch = shortcutCombo.match(ALT_NUMBER_SHORTCUT_PATTERN);
  const shortcut = (altNumberMatch?.[1] ?? shortcutCombo) as FavoriteShortcut;
  const conflictMessage = getConfiguredShortcutConflictMessage(shortcut);
  if (conflictMessage) {
    UI.showAlert(conflictMessage);
    return;
  }

  try {
    await favoritesStore.assignShortcut(itemId, shortcut, sourceFolderId);
    UI.showAlert(`${formatFavoriteShortcut(shortcut)} 단축키를 지정했습니다.`);
    cancelCustomShortcutCapture(itemId);
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '단축키를 변경하지 못했습니다.');
  }
};

const handleFavoriteDragStart = (event: DragEvent, favorite: DisplayFavorite): void => {
  if (isSearching.value) {
    event.preventDefault();
    return;
  }

  const sourceFolder = folders.value?.find((folder) => folder.id === favorite.sourceFolderId);
  if (!sourceFolder) {
    event.preventDefault();
    return;
  }

  const ids = selectedIds.value.has(favorite.id)
    ? sourceFolder.favorites
        .filter((favorite) => selectedIds.value.has(favorite.id))
        .map((favorite) => favorite.id)
    : [favorite.id];
  draggedFavoriteIds.value = ids;
  draggedSourceFolderId.value = favorite.sourceFolderId;
  dragPreviewOrderIds.value = sourceFolder.favorites.map((favorite) => favorite.id);
  event.dataTransfer?.setData('text/plain', favorite.id);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';

    // draggable이 손잡이에만 있어도 브라우저가 행 전체를 드래그 이미지로 표시하게 합니다.
    const handleElement = event.currentTarget as HTMLElement;
    const itemElement = handleElement.closest<HTMLElement>('.favorite-item');
    if (itemElement) {
      const itemRect = itemElement.getBoundingClientRect();
      const offsetX = Math.max(0, Math.min(event.clientX - itemRect.left, itemRect.width));
      const offsetY = Math.max(0, Math.min(event.clientY - itemRect.top, itemRect.height));
      event.dataTransfer.setDragImage(itemElement, offsetX, offsetY);
    }
  }
};

const handleFolderDragStart = (event: DragEvent, folderId: string): void => {
  draggedFolderId.value = folderId;
  event.dataTransfer?.setData('text/plain', folderId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
};

const handleFolderDragOver = (folderId: string): void => {
  if (draggedFavoriteIds.value.length > 0 || draggedFolderId.value) dragOverFolderId.value = folderId;
};

const clearFolderDragOver = (folderId: string): void => {
  if (dragOverFolderId.value === folderId) dragOverFolderId.value = null;
};

const updateFavoriteOrderPreview = (targetItemId: string | null, placeAfter = false): void => {
  const currentOrder = dragPreviewOrderIds.value;
  if (!currentOrder || draggedFavoriteIds.value.length === 0) return;

  const draggedSet = new Set(draggedFavoriteIds.value);
  if (targetItemId && draggedSet.has(targetItemId)) return;

  const remainingIds = currentOrder.filter((itemId) => !draggedSet.has(itemId));
  let targetIndex = targetItemId ? remainingIds.indexOf(targetItemId) : remainingIds.length;
  if (targetIndex < 0) targetIndex = remainingIds.length;
  if (targetItemId && placeAfter) targetIndex += 1;

  const nextOrder = [...remainingIds];
  nextOrder.splice(targetIndex, 0, ...draggedFavoriteIds.value);
  if (nextOrder.every((itemId, index) => itemId === currentOrder[index])) return;
  dragPreviewOrderIds.value = nextOrder;
};

const handleFavoriteDragOver = (event: DragEvent, itemId: string): void => {
  if (
    draggedFavoriteIds.value.length === 0 ||
    draggedSourceFolderId.value !== activeFolderId.value
  ) return;

  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  const itemElement = event.currentTarget as HTMLElement;
  const itemRect = itemElement.getBoundingClientRect();
  updateFavoriteOrderPreview(itemId, event.clientY >= itemRect.top + itemRect.height / 2);
};

const handleFavoritesListDragOver = (event: DragEvent): void => {
  if (
    draggedFavoriteIds.value.length === 0 ||
    draggedSourceFolderId.value !== activeFolderId.value
  ) return;

  const target = event.target;
  if (target instanceof Element && target.closest('.favorite-item')) return;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

  const listElement = event.currentTarget as HTMLElement;
  const itemElements = Array.from(
    listElement.querySelectorAll<HTMLElement>('.favorite-item')
  );
  if (itemElements.length === 0) return;

  const firstItem = itemElements[0];
  const lastItem = itemElements[itemElements.length - 1];
  const firstRect = firstItem.getBoundingClientRect();
  const lastRect = lastItem.getBoundingClientRect();

  if (event.clientY < firstRect.top) {
    const firstItemId = firstItem.dataset.favoriteId;
    if (firstItemId) updateFavoriteOrderPreview(firstItemId);
    return;
  }

  // 항목 사이 margin 영역에서는 직전 미리보기 위치를 유지합니다.
  // 실제 마지막 행보다 충분히 아래쪽의 빈 공간에 진입했을 때만 맨 끝으로 보냅니다.
  if (event.clientY > lastRect.bottom + 8) {
    updateFavoriteOrderPreview(null);
  }
};

const handleDropOnFolder = async (targetFolderId: string): Promise<void> => {
  try {
    if (draggedFolderId.value) {
      await performUndoableChange('폴더 순서를 변경했습니다.', () =>
        favoritesStore.reorderFolder(draggedFolderId.value!, targetFolderId)
      );
    } else if (
      draggedFavoriteIds.value.length > 0 &&
      draggedSourceFolderId.value &&
      draggedSourceFolderId.value !== targetFolderId
    ) {
      await performUndoableChange('즐겨찾기를 이동했습니다.', () =>
        favoritesStore.moveFavorites(
          draggedFavoriteIds.value,
          draggedSourceFolderId.value!,
          targetFolderId
        )
      );
      UI.showAlert(`${draggedFavoriteIds.value.length}개 즐겨찾기를 이동했습니다.`);
      resetSelection();
    }
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '드래그 이동에 실패했습니다.');
  } finally {
    clearDragState();
  }
};

const commitFavoriteDrop = async (): Promise<void> => {
  const sourceFolderId = draggedSourceFolderId.value;
  const previewOrderIds = dragPreviewOrderIds.value ? [...dragPreviewOrderIds.value] : null;
  if (
    draggedFavoriteIds.value.length === 0 ||
    !sourceFolderId ||
    sourceFolderId !== activeFolderId.value ||
    !previewOrderIds
  ) {
    clearDragState();
    return;
  }

  try {
    await performUndoableChange('즐겨찾기 순서를 변경했습니다.', () =>
      favoritesStore.setFavoriteOrder(sourceFolderId, previewOrderIds)
    );
  } catch (error) {
    UI.showAlert(error instanceof Error ? error.message : '순서를 변경하지 못했습니다.');
  } finally {
    clearDragState();
  }
};

function clearDragState(): void {
  draggedFavoriteIds.value = [];
  draggedSourceFolderId.value = null;
  draggedFolderId.value = null;
  dragOverFolderId.value = null;
  dragPreviewOrderIds.value = null;
}

const closeModal = (): void => uiStore.closeModal();
const openShortcutManager = (): void => uiStore.openShortcutManagerModal();

onMounted(async () => {
  await Promise.all([favoritesStore.loadProfiles(), loadLayoutPreferences()]);
  window.addEventListener('resize', handleViewportResize);
  await nextTick();
  requestAnimationFrame(() => {
    isVisible.value = true;
    void nextTick(() => searchInput.value?.focus({ preventScroll: true }));
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', handleViewportResize);
  detachResizeListeners();
  dismissPendingUndo();
});
</script>

<style scoped>
.favorites-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10000;
  width: 820px;
  height: 680px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--dc-color-text-primary);
  background: var(--dc-color-bg);
  border: 1px solid var(--dc-color-border);
  border-radius: 14px;
  box-shadow: var(--dc-shadow-strong);
  font-family: "Noto Sans CJK KR", "NanumGothic", sans-serif;
  box-sizing: border-box;
}

.favorites-container.is-resizing { user-select: none; }

button, input, select { font: inherit; }
button { color: inherit; }

.favorites-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--dc-color-border);
  flex: 0 0 auto;
}

.favorites-header h2 { margin: 0; font-size: 18.5px; }
.favorites-header p { margin: 3px 0 0; color: var(--dc-color-text-muted); font-size: 12.5px; }
.favorites-header-actions { display: flex; align-items: center; gap: 8px; }
.layout-reset-button { padding: 6px 9px; border: 1px solid var(--dc-color-border); border-radius: 6px; color: var(--dc-color-text-muted); background: var(--dc-color-surface); cursor: pointer; font-size: 11.5px; }
.layout-reset-button:hover { color: var(--dc-color-accent); border-color: var(--dc-color-accent); }

.favorites-layout { display: flex; min-height: 0; flex: 1 1 auto; }

.folder-panel {
  width: 190px;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--dc-color-surface);
}

.sidebar-resize-handle { position: relative; width: 17px; margin: 0 -8px; flex: 0 0 17px; z-index: 2; cursor: col-resize; touch-action: none; }
.sidebar-resize-handle::before { content: ""; position: absolute; top: 50%; left: 3px; width: 9px; height: 42px; transform: translateY(-50%); border: 1px solid var(--dc-color-border-strong); border-radius: 999px; background: var(--dc-color-surface-muted); box-shadow: var(--dc-shadow-soft); transition: border-color 0.12s ease, background 0.12s ease, transform 0.12s ease; }
.sidebar-resize-handle::after { content: ""; position: absolute; top: 50%; left: 50%; width: 3px; height: 19px; transform: translate(-50%, -50%); background: radial-gradient(circle, var(--dc-color-text-muted) 1px, transparent 1.35px) center / 3px 6px repeat-y; transition: background 0.12s ease; }
.sidebar-resize-handle:hover::before, .favorites-container.is-resizing .sidebar-resize-handle::before { border-color: var(--dc-color-accent); background: var(--dc-color-surface-hover); transform: translateY(-50%) scale(1.04); }
.sidebar-resize-handle:hover::after, .favorites-container.is-resizing .sidebar-resize-handle::after { background: radial-gradient(circle, var(--dc-color-accent) 1px, transparent 1.35px) center / 3px 6px repeat-y; }

.folder-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.folder-panel-header strong { font-size: 14px; }
.folder-search-box { flex: 0 0 auto; padding: 7px 8px; margin-bottom: 10px; }
.folder-search-box input { font-size: 12px; }
.folder-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1 1 auto; }

.folder-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 8px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--dc-color-text-secondary);
  cursor: pointer;
}

.folder-item:hover { background: var(--dc-color-surface-hover); }
.folder-item.active { color: var(--dc-color-accent); background: var(--dc-color-surface-muted); border-color: var(--dc-color-accent); }
.folder-item.drop-target { box-shadow: inset 0 0 0 2px var(--dc-color-accent); background: var(--dc-color-surface-hover); }
.folder-name { min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.folder-count { min-width: 24px; padding: 2px 6px; border-radius: 10px; text-align: center; background: var(--dc-color-surface-subtle); color: var(--dc-color-text-muted); font-size: 11.5px; }
.add-folder-button { margin-top: 8px; padding: 9px; border: 1px dashed var(--dc-color-border-strong); border-radius: 7px; background: transparent; color: var(--dc-color-text-muted); cursor: pointer; }
.add-folder-button:hover { color: var(--dc-color-accent); border-color: var(--dc-color-accent); }

.favorites-panel { min-width: 0; display: flex; flex: 1 1 auto; flex-direction: column; padding: 14px 16px; }
.favorites-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.folder-title-wrap { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.folder-title-wrap h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 17px; }
.folder-title-wrap span { color: var(--dc-color-text-muted); font-size: 12.5px; white-space: nowrap; }
.toolbar-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

.small-button, .icon-button, .footer-button {
  border: 1px solid var(--dc-color-border);
  border-radius: 7px;
  background: var(--dc-color-surface);
  cursor: pointer;
}
.small-button { padding: 6px 9px; color: var(--dc-color-text-secondary); font-size: 12px; }
.small-button:hover:not(:disabled), .icon-button:hover { background: var(--dc-color-surface-hover); }
.small-button.primary { color: var(--dc-color-tooltip-text); background: var(--dc-color-accent); border-color: var(--dc-color-accent); }
.add-current-button { margin-left: 4px; font-weight: 600; white-space: nowrap; }
.small-button.danger { color: var(--dc-color-tooltip-text); background: var(--dc-color-danger); border-color: var(--dc-color-danger); }
.danger-text { color: var(--dc-color-danger); }
.small-button:disabled { opacity: 0.45; cursor: not-allowed; }
.icon-button { width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--dc-color-text-muted); }
.close-icon { font-size: 21px; }

.search-box { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 10px; border: 1px solid var(--dc-color-border); border-radius: 8px; background: var(--dc-color-surface); }
.search-box:focus-within { border-color: var(--dc-color-accent); box-shadow: var(--dc-focus-ring); }
.search-box input { min-width: 0; flex: 1; border: 0; outline: 0; color: var(--dc-color-text-primary); background: transparent; font-size: 13.5px; }
.search-box button { border: 0; background: transparent; color: var(--dc-color-text-muted); cursor: pointer; }

.selection-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 8px; border-radius: 8px; background: var(--dc-color-surface-muted); font-size: 12px; }
.selection-toolbar strong { white-space: nowrap; color: var(--dc-color-accent); }
.selection-toolbar select { min-width: 110px; flex: 1 1 auto; padding: 6px; border: 1px solid var(--dc-color-border); border-radius: 6px; background: var(--dc-color-surface); color: var(--dc-color-text-primary); }
.select-all-label { display: flex; align-items: center; gap: 5px; white-space: nowrap; }

.favorites-list { list-style: none; min-height: 0; margin: 0; padding: 0 3px 0 0; overflow-y: auto; flex: 1 1 auto; }
.favorite-item { position: relative; display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 7px 8px; margin-bottom: 6px; border: 1px solid var(--dc-color-border-soft); border-radius: 8px; background: var(--dc-color-surface); }
.favorite-item:hover { border-color: var(--dc-color-border-strong); background: var(--dc-color-surface-hover); }
.favorite-item.selected { border-color: var(--dc-color-accent); }
.favorite-item.drag-preview-item { opacity: 0.58; border-color: var(--dc-color-accent); background: var(--dc-color-surface-muted); }
.favorite-sort-move { transition: transform 140ms ease; }
.drag-handle { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; border-radius: 6px; color: var(--dc-color-text-muted); cursor: grab; user-select: none; letter-spacing: -3px; }
.drag-handle:hover { color: var(--dc-color-accent); background: var(--dc-color-surface-hover); }
.drag-handle:active { cursor: grabbing; }
.drag-handle.disabled, .drag-handle.disabled:hover { color: var(--dc-color-border-strong); background: transparent; cursor: not-allowed; }
.folder-drag-handle { width: 28px; height: 32px; margin: -6px 0 -6px -6px; font-size: 13px; }
.favorite-drag-handle { align-self: stretch; width: 36px; min-height: 42px; margin: -2px 0 -2px -4px; font-size: 14.5px; }
.favorite-checkbox { flex: 0 0 auto; }
.shortcut-select, .move-select { border: 1px solid var(--dc-color-border); border-radius: 6px; background: var(--dc-color-surface-muted); color: var(--dc-color-text-primary); }
.shortcut-select {
  width: 86px;
  min-width: 86px;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  padding: 6px 8px;
  text-align: center;
  text-align-last: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--dc-color-accent);
}
.custom-shortcut-input { cursor: text; font-size: 11.5px; }
.move-select { width: 74px; padding: 6px 4px; font-size: 11.5px; }
.favorite-main { align-self: stretch; min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; margin: -7px 0; padding: 7px 6px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; text-align: left; }
.favorite-main:hover { background: var(--dc-color-surface-hover); }
.favorite-name { max-width: 100%; min-width: 0; display: flex; align-items: baseline; white-space: nowrap; color: var(--dc-color-text-primary); font-size: 14px; }
.favorite-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.favorite-folder-label { flex: 0 0 auto; color: var(--dc-color-text-muted); font-size: 12px; }
.favorite-meta { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dc-color-text-muted); font-size: 11.2px; }
.remove-button { flex: 0 0 auto; border-color: transparent; background: transparent; }
.remove-button:hover { color: var(--dc-color-danger); background: var(--dc-color-danger-bg); }
.favorite-empty { padding: 42px 12px; text-align: center; color: var(--dc-color-text-muted); font-size: 13.5px; }

.favorites-loading { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--dc-color-text-muted); }
.favorites-footer { display: flex; gap: 10px; padding: 12px 42px 12px 16px; border-top: 1px solid var(--dc-color-border); flex: 0 0 auto; }
.footer-button { flex: 1; padding: 10px; color: var(--dc-color-tooltip-text); background: var(--dc-color-text-muted); border: 0; font-weight: 600; }
.footer-button:hover { background: var(--dc-color-text-secondary); }
.settings-button { background: var(--dc-color-success); }
.settings-button:hover { background: var(--dc-color-success-hover); }

.favorites-undo-toast {
  position: absolute;
  left: 50%;
  bottom: 70px;
  z-index: 7;
  min-width: 240px;
  max-width: calc(100% - 32px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 10px 12px 10px 14px;
  border: 1px solid var(--dc-color-border-strong);
  border-radius: 8px;
  color: var(--dc-color-tooltip-text);
  background: var(--dc-color-tooltip-bg);
  box-shadow: var(--dc-shadow-strong);
  transform: translateX(-50%);
  font-size: 12.5px;
}
.favorites-undo-toast span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.favorites-undo-toast button { flex: 0 0 auto; padding: 3px 5px; border: 0; color: var(--dc-color-accent); background: transparent; font-weight: 700; cursor: pointer; }
.favorites-undo-enter-active, .favorites-undo-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.favorites-undo-enter-from, .favorites-undo-leave-to { opacity: 0; transform: translate(-50%, 6px); }

.modal-resize-handle { position: absolute; right: 0; bottom: 0; width: 34px; height: 34px; z-index: 5; cursor: nwse-resize; touch-action: none; }
.modal-resize-handle::before { content: none; }
.modal-resize-handle::after { content: ""; position: absolute; right: 7px; bottom: 7px; width: 15px; height: 15px; clip-path: polygon(100% 0, 100% 100%, 0 100%); background: repeating-linear-gradient(135deg, transparent 0 3px, var(--dc-color-text-muted) 3px 4.5px); transition: background 0.12s ease; }
.modal-resize-handle:hover::after, .favorites-container.is-resizing .modal-resize-handle::after { background: repeating-linear-gradient(135deg, transparent 0 3px, var(--dc-color-accent) 3px 4.5px); }

@media (max-width: 620px) {
  .folder-panel { width: 138px; min-width: 138px; padding: 9px 7px; }
  .favorites-panel { padding: 11px 9px; }
  .favorites-toolbar { align-items: flex-start; flex-direction: column; }
  .toolbar-actions { justify-content: flex-start; }
  .move-select { display: none; }
  .selection-toolbar { align-items: stretch; flex-wrap: wrap; }
  .selection-toolbar select { min-width: 130px; }
  .add-current-button { margin-left: 0; }
}
</style>
