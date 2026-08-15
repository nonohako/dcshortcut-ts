import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import Storage from '@/services/Storage';
import { normalizeShortcutCombo } from '@/services/Shortcut';
import { ACTIVE_FAVORITES_PROFILE_KEY, FAVORITE_GALLERIES_KEY } from '@/services/Global';
import type {
  FavoriteFolder,
  FavoriteGalleryInfo,
  FavoriteItem,
  FavoriteShortcut,
  FavoritesData,
  LegacyFavoriteGalleries,
  LegacyFavoriteProfiles,
} from '@/types';

export type {
  FavoriteFolder,
  FavoriteGalleryInfo,
  FavoriteItem,
  FavoriteShortcut,
  FavoritesData,
  LegacyFavoriteGalleries,
  LegacyFavoriteProfiles,
};

const FAVORITES_DATA_VERSION = 2;
const DEFAULT_FOLDER_NAME = '기본';
const NUMBER_SHORTCUT_PATTERN = /^[0-9]$/;
const ALT_NUMBER_SHORTCUT_PATTERN = /^Alt\+([0-9])$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createId = (prefix: 'folder' | 'favorite'): string => {
  const uuid = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
};

const normalizeFavoriteShortcut = (value: unknown): FavoriteShortcut | null => {
  if (typeof value !== 'string') return null;
  if (NUMBER_SHORTCUT_PATTERN.test(value)) return value;

  const normalized = normalizeShortcutCombo(value);
  if (!normalized) return null;
  const altNumberMatch = normalized.match(ALT_NUMBER_SHORTCUT_PATTERN);
  return altNumberMatch ? altNumberMatch[1] : normalized;
};

const isFavoriteShortcut = (value: unknown): value is FavoriteShortcut =>
  normalizeFavoriteShortcut(value) !== null;

const parseGalleryInfo = (value: unknown): FavoriteGalleryInfo | null => {
  if (!isRecord(value)) return null;
  if (typeof value.galleryId !== 'string' || !value.galleryId.trim()) return null;
  if (!['board', 'mgallery', 'mini'].includes(String(value.galleryType))) return null;

  return {
    name: typeof value.name === 'string' ? value.name : '',
    galleryId: value.galleryId,
    galleryType: value.galleryType as FavoriteGalleryInfo['galleryType'],
  };
};

const createFavoriteItem = (
  gallery: FavoriteGalleryInfo,
  shortcut: FavoriteShortcut | null = null,
  id = createId('favorite')
): FavoriteItem => ({ id, ...gallery, shortcut });

const createDefaultFolder = (): FavoriteFolder => ({
  id: createId('folder'),
  name: DEFAULT_FOLDER_NAME,
  favorites: [],
});

const parseFavoritesData = (value: unknown): FavoritesData | null => {
  if (!isRecord(value) || value.version !== FAVORITES_DATA_VERSION || !Array.isArray(value.folders)) {
    return null;
  }

  const usedFolderIds = new Set<string>();
  const usedItemIds = new Set<string>();
  const usedFolderNames = new Set<string>();
  const folders: FavoriteFolder[] = [];

  for (const rawFolder of value.folders) {
    if (!isRecord(rawFolder) || !Array.isArray(rawFolder.favorites)) continue;

    const baseName = typeof rawFolder.name === 'string' && rawFolder.name.trim()
      ? rawFolder.name.trim()
      : '새 폴더';
    let name = baseName;
    let suffix = 2;
    while (usedFolderNames.has(name)) name = `${baseName} ${suffix++}`;
    usedFolderNames.add(name);

    const rawFolderId = typeof rawFolder.id === 'string' ? rawFolder.id : '';
    const folderId = rawFolderId && !usedFolderIds.has(rawFolderId)
      ? rawFolderId
      : createId('folder');
    usedFolderIds.add(folderId);

    const favorites: FavoriteItem[] = [];
    const usedShortcuts = new Set<FavoriteShortcut>();
    for (const rawItem of rawFolder.favorites) {
      const gallery = parseGalleryInfo(rawItem);
      if (!gallery || !isRecord(rawItem)) continue;

      const rawItemId = typeof rawItem.id === 'string' ? rawItem.id : '';
      const itemId = rawItemId && !usedItemIds.has(rawItemId)
        ? rawItemId
        : createId('favorite');
      usedItemIds.add(itemId);

      const requestedShortcut = normalizeFavoriteShortcut(rawItem.shortcut);
      const shortcut = requestedShortcut && !usedShortcuts.has(requestedShortcut)
        ? requestedShortcut
        : null;
      if (shortcut) usedShortcuts.add(shortcut);
      favorites.push(createFavoriteItem(gallery, shortcut, itemId));
    }

    folders.push({ id: folderId, name, favorites });
  }

  return {
    version: FAVORITES_DATA_VERSION,
    folders: folders.length > 0 ? folders : [createDefaultFolder()],
  };
};

const parseLegacyGalleryMap = (value: unknown): LegacyFavoriteGalleries | null => {
  if (!isRecord(value)) return null;
  const parsed: LegacyFavoriteGalleries = {};

  for (const [shortcut, rawGallery] of Object.entries(value)) {
    if (!NUMBER_SHORTCUT_PATTERN.test(shortcut)) return null;
    const gallery = parseGalleryInfo(rawGallery);
    if (!gallery) return null;
    parsed[shortcut] = gallery;
  }
  return parsed;
};

const migrateLegacyProfiles = (value: unknown): FavoritesData | null => {
  const singleFolder = parseLegacyGalleryMap(value);
  if (singleFolder && Object.keys(singleFolder).length > 0) {
    return {
      version: FAVORITES_DATA_VERSION,
      folders: [legacyFolderToFolder(DEFAULT_FOLDER_NAME, singleFolder)],
    };
  }
  if (!isRecord(value)) return null;

  const folders: FavoriteFolder[] = [];
  for (const [name, rawFavorites] of Object.entries(value)) {
    const favorites = parseLegacyGalleryMap(rawFavorites);
    if (!favorites) return null;
    folders.push(legacyFolderToFolder(name, favorites));
  }

  return folders.length > 0 ? { version: FAVORITES_DATA_VERSION, folders } : null;
};

function legacyFolderToFolder(name: string, favorites: LegacyFavoriteGalleries): FavoriteFolder {
  return {
    id: createId('folder'),
    name: name.trim() || DEFAULT_FOLDER_NAME,
    favorites: Object.entries(favorites)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([shortcut, gallery]) =>
        createFavoriteItem(gallery, NUMBER_SHORTCUT_PATTERN.test(shortcut) ? shortcut : null)
      ),
  };
}

export const normalizeFavoritesData = (value: unknown): FavoritesData | null =>
  parseFavoritesData(value) ?? migrateLegacyProfiles(value);

export const resolveActiveFavoriteFolderId = (
  data: FavoritesData,
  storedActiveFolder: unknown
): string => {
  const candidate = typeof storedActiveFolder === 'string' ? storedActiveFolder : '';
  return data.folders.find(
    (folder) => folder.id === candidate || folder.name === candidate
  )?.id ?? data.folders[0].id;
};

export const useFavoritesStore = defineStore('favorites', () => {
  const folders = ref<FavoriteFolder[] | null>(null);
  const activeFolderId = ref<string>('');

  const activeFolder = computed<FavoriteFolder | null>(() =>
    folders.value?.find((folder) => folder.id === activeFolderId.value) ?? null
  );
  const activeFolderName = computed<string>(() => activeFolder.value?.name ?? DEFAULT_FOLDER_NAME);
  const activeFavorites = computed<FavoriteItem[]>(() => activeFolder.value?.favorites ?? []);

  let loadPromise: Promise<void> | null = null;
  let favoriteWriteQueue: Promise<void> = Promise.resolve();
  let lastPersistedSnapshot: FavoritesData | null = null;
  const pendingLocalFavoriteWrites = new Set<string>();

  function createSnapshot(source = folders.value): FavoritesData {
    const parsed = parseFavoritesData({
      version: FAVORITES_DATA_VERSION,
      folders: source ?? [],
    });
    return parsed ?? {
      version: FAVORITES_DATA_VERSION,
      folders: [createDefaultFolder()],
    };
  }

  function getSnapshotKey(data: FavoritesData): string {
    return JSON.stringify(data);
  }

  function markPendingLocalWrite(snapshotKey: string): void {
    pendingLocalFavoriteWrites.add(snapshotKey);
    // onChanged는 실제 값이 달라질 때만 발생합니다. 동일 값 저장으로 남은 표식은
    // 무한히 늘지 않도록 오래된 항목부터 제한합니다.
    if (pendingLocalFavoriteWrites.size > 50) {
      const oldestKey = pendingLocalFavoriteWrites.values().next().value as string | undefined;
      if (oldestKey) pendingLocalFavoriteWrites.delete(oldestKey);
    }
  }

  function consumePendingLocalWrite(snapshotKey: string): boolean {
    return pendingLocalFavoriteWrites.delete(snapshotKey);
  }

  async function loadProfiles(): Promise<void> {
    // 최초 로드 이후에는 storage.onChanged가 외부 변경을 동기화합니다.
    // 매 단축키 입력/모달 열기마다 다시 읽으면 진행 중인 로컬 변경을 오래된 값으로 덮을 수 있습니다.
    if (folders.value !== null) return;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const loadedData = await Storage.getData<unknown>(FAVORITE_GALLERIES_KEY, {});
        const storedActiveFolder = await Storage.getData<string>(
          ACTIVE_FAVORITES_PROFILE_KEY,
          DEFAULT_FOLDER_NAME
        );

        const parsed = parseFavoritesData(loadedData);
        const migrated: FavoritesData = normalizeFavoritesData(loadedData) ?? {
          version: FAVORITES_DATA_VERSION,
          folders: [createDefaultFolder()],
        };
        folders.value = migrated.folders;
        lastPersistedSnapshot = createSnapshot(migrated.folders);

        const matchingFolderId = resolveActiveFavoriteFolderId(migrated, storedActiveFolder);
        activeFolderId.value = matchingFolderId;

        if (!parsed || storedActiveFolder !== matchingFolderId) {
          await Promise.all([
            Storage.saveFavorites(migrated),
            Storage.setData(ACTIVE_FAVORITES_PROFILE_KEY, matchingFolderId),
          ]);
        }
      } catch (error) {
        console.error('[Pinia Favorites] 즐겨찾기 로드 실패:', error);
        const fallback = createDefaultFolder();
        folders.value = [fallback];
        activeFolderId.value = fallback.id;
      }
    })();

    try {
      await loadPromise;
    } finally {
      loadPromise = null;
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (folders.value === null) await loadProfiles();
    if (folders.value === null) throw new Error('즐겨찾기 데이터를 불러오지 못했습니다.');
  }

  async function reloadProfiles(): Promise<void> {
    if (loadPromise) await loadPromise;
    folders.value = null;
    await loadProfiles();
  }

  async function saveProfiles(): Promise<void> {
    await ensureLoaded();
    // Vue 반응형 객체를 직접 넘기지 않고 이 시점의 일반 객체 스냅샷을 저장합니다.
    // 저장 중 다음 작업이 상태를 바꾸더라도 앞선 쓰기의 내용이 함께 변하지 않습니다.
    const snapshot = createSnapshot();
    const snapshotKey = getSnapshotKey(snapshot);
    markPendingLocalWrite(snapshotKey);

    const writePromise = favoriteWriteQueue.then(() => Storage.saveFavorites(snapshot));
    // 한 번의 실패가 뒤의 모든 저장까지 막지 않도록 큐 자체는 복구된 Promise로 유지합니다.
    favoriteWriteQueue = writePromise.catch(() => undefined);

    try {
      await writePromise;
      lastPersistedSnapshot = snapshot;
    } catch (error) {
      consumePendingLocalWrite(snapshotKey);
      // 실패한 쓰기 이후 더 최신 변경이 없다면 마지막 저장 성공 상태로 되돌립니다.
      if (
        lastPersistedSnapshot &&
        folders.value !== null &&
        getSnapshotKey(createSnapshot()) === snapshotKey
      ) {
        const restored = createSnapshot(lastPersistedSnapshot.folders);
        folders.value = restored.folders;
        if (!folders.value.some((folder) => folder.id === activeFolderId.value)) {
          activeFolderId.value = folders.value[0].id;
        }
      }
      throw error;
    }

  }

  function getFolder(folderId: string): FavoriteFolder {
    const folder = folders.value?.find((item) => item.id === folderId);
    if (!folder) throw new Error('존재하지 않는 폴더입니다.');
    return folder;
  }

  async function switchFolder(folderId: string): Promise<void> {
    await ensureLoaded();
    const folder = getFolder(folderId);
    activeFolderId.value = folder.id;
    await Storage.setData(ACTIVE_FAVORITES_PROFILE_KEY, folder.id);
  }

  function syncActiveFolderFromStorage(folderId: unknown): void {
    if (typeof folderId !== 'string' || !folders.value) return;
    const folder = folders.value.find((item) => item.id === folderId || item.name === folderId);
    if (folder) activeFolderId.value = folder.id;
  }

  function syncFavoritesFromStorage(value: unknown): void {
    // 전체 초기화/복원 과정의 clear 이벤트는 후속 set 또는 명시적 loadProfiles가 처리합니다.
    if (value === undefined) return;
    const parsed = parseFavoritesData(value);
    const normalized = parsed ?? migrateLegacyProfiles(value);
    if (!normalized) {
      console.warn('[Pinia Favorites] 지원하지 않는 즐겨찾기 변경값을 무시했습니다.');
      return;
    }

    const incomingSnapshotKey = getSnapshotKey(normalized);
    // 자신의 저장 이벤트를 다시 적용하면, 그 사이 만들어진 더 최신 로컬 변경이 사라질 수 있습니다.
    if (consumePendingLocalWrite(incomingSnapshotKey)) return;

    if (folders.value !== null && getSnapshotKey(createSnapshot()) === incomingSnapshotKey) return;

    lastPersistedSnapshot = normalized;
    folders.value = normalized.folders;
    if (!folders.value.some((folder) => folder.id === activeFolderId.value)) {
      activeFolderId.value = folders.value[0].id;
    }

    if (!parsed) {
      void saveProfiles().catch((error) => {
        console.error('[Pinia Favorites] 구버전 즐겨찾기 자동 변환 저장 실패:', error);
      });
    }
  }

  async function addFolder(name: string): Promise<string> {
    await ensureLoaded();
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error('폴더 이름은 비워둘 수 없습니다.');
    if (folders.value!.some((folder) => folder.name === normalizedName)) {
      throw new Error('이미 존재하는 폴더 이름입니다.');
    }

    const folder: FavoriteFolder = { id: createId('folder'), name: normalizedName, favorites: [] };
    folders.value!.push(folder);
    await saveProfiles();
    await switchFolder(folder.id);
    return folder.id;
  }

  async function renameFolder(folderId: string, name: string): Promise<void> {
    await ensureLoaded();
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error('폴더 이름은 비워둘 수 없습니다.');
    if (folders.value!.some((folder) => folder.id !== folderId && folder.name === normalizedName)) {
      throw new Error('이미 존재하는 폴더 이름입니다.');
    }
    getFolder(folderId).name = normalizedName;
    await saveProfiles();
  }

  async function removeFolder(folderId: string): Promise<void> {
    await ensureLoaded();
    if (folders.value!.length <= 1) throw new Error('최소 한 개의 폴더는 남겨두어야 합니다.');
    const index = folders.value!.findIndex((folder) => folder.id === folderId);
    if (index < 0) return;
    folders.value!.splice(index, 1);

    if (activeFolderId.value === folderId) {
      const nextFolder = folders.value![Math.min(index, folders.value!.length - 1)];
      activeFolderId.value = nextFolder.id;
      await Storage.setData(ACTIVE_FAVORITES_PROFILE_KEY, nextFolder.id);
    }
    await saveProfiles();
  }

  async function reorderFolder(sourceFolderId: string, targetFolderId: string): Promise<void> {
    await ensureLoaded();
    if (sourceFolderId === targetFolderId) return;
    const sourceIndex = folders.value!.findIndex((folder) => folder.id === sourceFolderId);
    const targetIndex = folders.value!.findIndex((folder) => folder.id === targetFolderId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [folder] = folders.value!.splice(sourceIndex, 1);
    folders.value!.splice(targetIndex, 0, folder);
    await saveProfiles();
  }

  async function assignShortcut(
    itemId: string,
    shortcut: FavoriteShortcut | null,
    folderId = activeFolderId.value
  ): Promise<void> {
    await ensureLoaded();
    const folder = getFolder(folderId);
    const item = folder.favorites.find((favorite) => favorite.id === itemId);
    if (!item) throw new Error('존재하지 않는 즐겨찾기입니다.');
    const normalizedShortcut = shortcut === null ? null : normalizeFavoriteShortcut(shortcut);
    if (shortcut !== null && !normalizedShortcut) throw new Error('유효한 단축키 조합이 아닙니다.');
    if (item.shortcut === normalizedShortcut) return;

    const previousShortcut = item.shortcut;
    const conflicting = normalizedShortcut
      ? folder.favorites.find(
          (favorite) => favorite.id !== itemId && favorite.shortcut === normalizedShortcut
        )
      : null;
    if (conflicting) conflicting.shortcut = previousShortcut;
    item.shortcut = normalizedShortcut;
    await saveProfiles();
  }

  async function addFavorite(
    galleryData: FavoriteGalleryInfo,
    options: { folderId?: string; shortcut?: FavoriteShortcut | null } = {}
  ): Promise<{ item: FavoriteItem; created: boolean }> {
    await ensureLoaded();
    const folder = getFolder(options.folderId ?? activeFolderId.value);
    const existing = folder.favorites.find(
      (item) => item.galleryId === galleryData.galleryId && item.galleryType === galleryData.galleryType
    );

    if (existing) {
      existing.name = galleryData.name || existing.name;
      if (options.shortcut !== undefined && existing.shortcut !== options.shortcut) {
        const conflicting = options.shortcut
          ? folder.favorites.find(
              (item) => item.id !== existing.id && item.shortcut === options.shortcut
            )
          : null;
        if (conflicting) conflicting.shortcut = existing.shortcut;
        existing.shortcut = options.shortcut;
      }
      await saveProfiles();
      return { item: existing, created: false };
    }

    const shortcut = options.shortcut ?? null;
    if (shortcut) {
      const conflicting = folder.favorites.find((item) => item.shortcut === shortcut);
      if (conflicting) conflicting.shortcut = null;
    }
    const item = createFavoriteItem(galleryData, shortcut);
    folder.favorites.push(item);
    await saveProfiles();
    return { item, created: true };
  }

  async function removeFavorites(
    itemIds: string[],
    folderId = activeFolderId.value
  ): Promise<void> {
    await ensureLoaded();
    const folder = getFolder(folderId);
    const ids = new Set(itemIds);
    folder.favorites = folder.favorites.filter((item) => !ids.has(item.id));
    await saveProfiles();
  }

  async function moveFavorites(
    itemIds: string[],
    sourceFolderId: string,
    targetFolderId: string,
    beforeItemId: string | null = null
  ): Promise<void> {
    await ensureLoaded();
    const sourceFolder = getFolder(sourceFolderId);
    const targetFolder = getFolder(targetFolderId);
    const ids = new Set(itemIds);
    const movingItems = sourceFolder.favorites.filter((item) => ids.has(item.id));
    if (movingItems.length === 0) return;

    if (sourceFolderId !== targetFolderId) {
      const duplicate = movingItems.find((moving) =>
        targetFolder.favorites.some(
          (target) =>
            target.galleryId === moving.galleryId && target.galleryType === moving.galleryType
        )
      );
      if (duplicate) throw new Error(`'${duplicate.name || duplicate.galleryId}'은(는) 대상 폴더에 이미 있습니다.`);
    }

    sourceFolder.favorites = sourceFolder.favorites.filter((item) => !ids.has(item.id));
    const destination = sourceFolderId === targetFolderId
      ? sourceFolder.favorites
      : targetFolder.favorites;

    if (sourceFolderId !== targetFolderId) {
      const occupiedShortcuts = new Set(
        destination.map((item) => item.shortcut).filter(isFavoriteShortcut)
      );
      movingItems.forEach((item) => {
        if (item.shortcut && occupiedShortcuts.has(item.shortcut)) item.shortcut = null;
        if (item.shortcut) occupiedShortcuts.add(item.shortcut);
      });
    }

    const targetIndex = beforeItemId
      ? destination.findIndex((item) => item.id === beforeItemId)
      : -1;
    destination.splice(targetIndex >= 0 ? targetIndex : destination.length, 0, ...movingItems);
    await saveProfiles();
  }

  async function setFavoriteOrder(folderId: string, orderedItemIds: string[]): Promise<void> {
    await ensureLoaded();
    const folder = getFolder(folderId);
    const itemById = new Map(folder.favorites.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const reordered: FavoriteItem[] = [];

    orderedItemIds.forEach((itemId) => {
      const item = itemById.get(itemId);
      if (!item || seen.has(itemId)) return;
      seen.add(itemId);
      reordered.push(item);
    });
    // 드래그 도중 외부 동기화로 새 항목이 들어와도 누락시키지 않습니다.
    folder.favorites.forEach((item) => {
      if (!seen.has(item.id)) reordered.push(item);
    });

    const orderChanged = reordered.some((item, index) => item.id !== folder.favorites[index]?.id);
    if (!orderChanged) return;

    folder.favorites = reordered;
    await saveProfiles();
  }

  async function getFavoriteByShortcut(shortcut: string): Promise<FavoriteItem | null> {
    await ensureLoaded();
    const normalizedShortcut = normalizeFavoriteShortcut(shortcut);
    if (!normalizedShortcut) return null;
    return activeFavorites.value.find((item) => item.shortcut === normalizedShortcut) ?? null;
  }

  async function clearAndSetFavorites(value: unknown): Promise<void> {
    const parsed = normalizeFavoritesData(value);
    if (!parsed) throw new Error('즐겨찾기 데이터 형식이 올바르지 않습니다.');
    folders.value = parsed.folders;
    activeFolderId.value = parsed.folders[0].id;
    await Promise.all([
      saveProfiles(),
      Storage.setData(ACTIVE_FAVORITES_PROFILE_KEY, activeFolderId.value),
    ]);
  }

  return {
    folders,
    activeFolderId,
    activeFolder,
    activeFolderName,
    activeFavorites,
    loadProfiles,
    reloadProfiles,
    saveProfiles,
    switchFolder,
    syncFavoritesFromStorage,
    syncActiveFolderFromStorage,
    addFolder,
    renameFolder,
    removeFolder,
    reorderFolder,
    addFavorite,
    removeFavorites,
    moveFavorites,
    setFavoriteOrder,
    assignShortcut,
    getFavoriteByShortcut,
    clearAndSetFavorites,
  };
});
