import { defineStore } from 'pinia';
import { ref, reactive, type Ref } from 'vue';
import Storage from '@/services/Storage';
import type { PageNavigationMode } from '@/types';
import {
  normalizeShortcutCombo,
  normalizeShortcutWithFallback,
  shortcutComboHasAlt,
} from '@/services/Shortcut';

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

interface SaveResult {
  success: boolean;
  message?: string;
}

type ShortcutAction =
  | 'W'
  | 'C'
  | 'D'
  | 'R'
  | 'Q'
  | 'E'
  | 'F'
  | 'G'
  | 'A'
  | 'S'
  | 'GallerySearch'
  | 'GlobalSearch'
  | 'Z'
  | 'X'
  | 'PrevProfile'
  | 'NextProfile'
  | 'SubmitComment'
  | 'SubmitImagePost'
  | 'ToggleModal';

type ShortcutKeysState = { [key: string]: string };
type ShortcutEnabledState = { [key: string]: boolean };

// 스토어가 반환하는 모든 값의 타입을 명시하는 인터페이스
interface SettingsStoreReturn {
  // State
  pageNavigationMode: Ref<PageNavigationMode>;
  shortcutEnabled: ShortcutEnabledState;
  shortcutKeys: ShortcutKeysState;
  altNumberEnabled: Ref<boolean>;
  numberLabelsEnabled: Ref<boolean>;
  numberNavigationEnabled: Ref<boolean>;
  showDateInListEnabled: Ref<boolean>;
  macroZEnabled: Ref<boolean>;
  macroXEnabled: Ref<boolean>;
  shortcutDRefreshCommentEnabled: Ref<boolean>;
  macroInterval: Ref<number>;
  favoritesPreviewEnabled: Ref<boolean>;
  favoritesPreviewOpacity: Ref<number>;
  autoRefreshEnabled: Ref<boolean>;
  autoRefreshInterval: Ref<number>;
  autoRefreshAllTabsEnabled: Ref<boolean>;
  autoRefreshHighlightColor: Ref<string>;
  autoRefreshHighlightDuration: Ref<number>;
  shortcutSubmitCommentKeyEnabled: Ref<boolean>;
  shortcutSubmitImagePostKeyEnabled: Ref<boolean>;
  shortcutToggleModalKeyEnabled: Ref<boolean>;
  pauseOnInactiveEnabled: Ref<boolean>;
  dcconAliasEnabled: Ref<boolean>;

  // Actions
  loadSettings: () => Promise<void>;
  savePageNavigationMode: (mode: PageNavigationMode) => Promise<void>;
  saveAltNumberEnabled: (enabled: boolean) => Promise<void>;
  saveNumberLabelsEnabled: (enabled: boolean) => Promise<void>;
  saveNumberNavigationEnabled: (enabled: boolean) => Promise<void>;
  saveShowDateInListEnabled: (enabled: boolean) => Promise<void>;
  saveShortcutEnabled: (storageKey: string, enabled: boolean) => Promise<void>;
  saveShortcutKey: (
    storageKey: string,
    newKey: string,
    isAltRequired?: boolean
  ) => Promise<SaveResult>;
  saveMacroInterval: (interval: number | string) => Promise<SaveResult>;
  saveShortcutDRefreshCommentEnabled: (enabled: boolean) => Promise<void>;
  saveFavoritesPreviewEnabled: (enabled: boolean) => Promise<void>;
  saveFavoritesPreviewOpacity: (opacity: number | string) => Promise<SaveResult>;
  saveAutoRefreshEnabled: (enabled: boolean) => Promise<void>;
  saveAutoRefreshInterval: (interval: number | string) => Promise<SaveResult>;
  saveAutoRefreshAllTabsEnabled: (enabled: boolean) => Promise<void>;
  saveAutoRefreshHighlightColor: (color: string) => Promise<SaveResult>;
  saveAutoRefreshHighlightDuration: (duration: number | string) => Promise<SaveResult>;
  savePauseOnInactiveEnabled: (enabled: boolean) => Promise<void>;
  saveDcconAliasEnabled: (enabled: boolean) => Promise<void>;

  // Constants
  customizableShortcutActions: ShortcutAction[];
  defaultShortcutKeys: Record<ShortcutAction, string>;
}

// =================================================================
// Constants (상수 정의)
// =================================================================

const defaultShortcutKeys: Record<ShortcutAction, string> = {
  W: 'W',
  C: 'C',
  D: 'D',
  R: 'R',
  Q: 'Q',
  E: 'E',
  F: 'F',
  G: 'G',
  A: 'A',
  S: 'S',
  GallerySearch: 'V',
  GlobalSearch: 'Alt+V',
  Z: 'Z',
  X: 'X',
  PrevProfile: '[',
  NextProfile: ']',
  SubmitComment: 'Alt+D',
  SubmitImagePost: 'Alt+W',
  ToggleModal: 'Alt+`',
};

const customizableShortcutActions: ShortcutAction[] = Object.keys(
  defaultShortcutKeys
) as ShortcutAction[];
const ALT_REQUIRED_ACTIONS = new Set<ShortcutAction>([
  'SubmitComment',
  'SubmitImagePost',
  'ToggleModal',
]);

// =================================================================
// Pinia Store Definition (Pinia 스토어 정의)
// =================================================================

export const useSettingsStore = defineStore('settings', (): SettingsStoreReturn => {
  // --- State (상태) ---
  const pageNavigationMode = ref<PageNavigationMode>('ajax');
  const shortcutEnabled = reactive<ShortcutEnabledState>({});
  const shortcutKeys = reactive<ShortcutKeysState>({});
  const altNumberEnabled = ref<boolean>(true);
  const numberLabelsEnabled = ref<boolean>(true);
  const numberNavigationEnabled = ref<boolean>(true);
  const showDateInListEnabled = ref<boolean>(true);
  const macroZEnabled = ref<boolean>(true);
  const macroXEnabled = ref<boolean>(true);
  const shortcutDRefreshCommentEnabled = ref<boolean>(true);
  const macroInterval = ref<number>(5000);
  const favoritesPreviewEnabled = ref<boolean>(true);
  const favoritesPreviewOpacity = ref<number>(0.85);
  const autoRefreshEnabled = ref<boolean>(false);
  const autoRefreshInterval = ref<number>(10);
  const autoRefreshAllTabsEnabled = ref<boolean>(false);
  const autoRefreshHighlightColor = ref<string>('#ffeb3b');
  const autoRefreshHighlightDuration = ref<number>(2.5);
  const shortcutSubmitCommentKeyEnabled = ref<boolean>(true);
  const shortcutSubmitImagePostKeyEnabled = ref<boolean>(true);
  const shortcutToggleModalKeyEnabled = ref<boolean>(true);
  const pauseOnInactiveEnabled = ref<boolean>(true);
  const dcconAliasEnabled = ref<boolean>(true);

  // --- Actions (액션) ---

  async function loadSettings(): Promise<void> {
    console.log('[Pinia] 스토리지에서 설정 로딩 중...');
    const promises: Promise<any>[] = [
      Storage.getPageNavigationMode().then((val) => (pageNavigationMode.value = val)),
      Storage.getAltNumberEnabled().then((val) => (altNumberEnabled.value = val)),
      Storage.getNumberLabelsEnabled().then((val) => (numberLabelsEnabled.value = val)),
      Storage.getNumberNavigationEnabled().then((val) => (numberNavigationEnabled.value = val)),
      Storage.getShowDateInListEnabled().then((val) => (showDateInListEnabled.value = val)),
      Storage.getMacroInterval().then((val) => (macroInterval.value = val)),
      Storage.getShortcutDRefreshCommentEnabled().then(
        (val) => (shortcutDRefreshCommentEnabled.value = val)
      ),
      Storage.getFavoritesPreviewEnabled().then((val) => (favoritesPreviewEnabled.value = val)),
      Storage.getFavoritesPreviewOpacity().then((val) => (favoritesPreviewOpacity.value = val)),
      Storage.getAutoRefreshEnabled().then((val) => (autoRefreshEnabled.value = val)),
      Storage.getAutoRefreshInterval().then((val) => (autoRefreshInterval.value = val)),
      Storage.getAutoRefreshAllTabsEnabled().then((val) => (autoRefreshAllTabsEnabled.value = val)),
      Storage.getAutoRefreshHighlightColor().then((val) => (autoRefreshHighlightColor.value = val)),
      Storage.getAutoRefreshHighlightDuration().then(
        (val) => (autoRefreshHighlightDuration.value = val)
      ),
      Storage.getShortcutEnabled('shortcutMacroZEnabled').then(
        (val) => (macroZEnabled.value = val)
      ),
      Storage.getShortcutEnabled('shortcutMacroXEnabled').then(
        (val) => (macroXEnabled.value = val)
      ),
      Storage.getShortcutEnabled('shortcutSubmitCommentKeyEnabled').then(
        (val) => (shortcutSubmitCommentKeyEnabled.value = val)
      ),
      Storage.getShortcutEnabled('shortcutSubmitImagePostKeyEnabled').then(
        (val) => (shortcutSubmitImagePostKeyEnabled.value = val)
      ),
      Storage.getShortcutEnabled('shortcutToggleModalKeyEnabled').then(
        (val) => (shortcutToggleModalKeyEnabled.value = val)
      ),
      Storage.getPauseOnInactiveEnabled().then((val) => (pauseOnInactiveEnabled.value = val)),
      Storage.getDcconAliasEnabled().then((val) => (dcconAliasEnabled.value = val)),
    ];

    customizableShortcutActions.forEach((action) => {
      const keyKey = `shortcut${action}Key`;
      promises.push(
        Storage.getShortcutKey(keyKey).then((val) => {
          shortcutKeys[keyKey] = normalizeShortcutWithFallback(
            val,
            defaultShortcutKeys[action],
            ALT_REQUIRED_ACTIONS.has(action)
          );
        })
      );

      const isAltShortcut = ALT_REQUIRED_ACTIONS.has(action);
      if (!isAltShortcut) {
        const enabledKey = `shortcut${action}Enabled`;
        promises.push(
          Storage.getShortcutEnabled(enabledKey).then(
            (val) => (shortcutEnabled[enabledKey] = val !== false)
          )
        );
      }
    });

    await Promise.all(promises);
    console.log('[Pinia] 설정 로딩 완료.');
  }

  async function savePageNavigationMode(mode: PageNavigationMode): Promise<void> {
    if (mode !== 'ajax' && mode !== 'full' && mode !== 'infinite') return;
    await Storage.savePageNavigationMode(mode);
    pageNavigationMode.value = mode;
  }

  async function saveAltNumberEnabled(enabled: boolean): Promise<void> {
    await Storage.saveAltNumberEnabled(enabled);
    altNumberEnabled.value = enabled;
  }

  async function saveNumberLabelsEnabled(enabled: boolean): Promise<void> {
    await Storage.saveNumberLabelsEnabled(enabled);
    numberLabelsEnabled.value = enabled;
  }

  async function saveNumberNavigationEnabled(enabled: boolean): Promise<void> {
    await Storage.saveNumberNavigationEnabled(enabled);
    numberNavigationEnabled.value = enabled;
  }

  async function saveShowDateInListEnabled(enabled: boolean): Promise<void> {
    await Storage.saveShowDateInListEnabled(enabled);
    showDateInListEnabled.value = enabled;
  }

  async function saveShortcutEnabled(storageKey: string, enabled: boolean): Promise<void> {
    await Storage.saveShortcutEnabled(storageKey, enabled);
    switch (storageKey) {
      case 'shortcutMacroZEnabled':
        macroZEnabled.value = enabled;
        break;
      case 'shortcutMacroXEnabled':
        macroXEnabled.value = enabled;
        break;
      case 'shortcutSubmitCommentKeyEnabled':
        shortcutSubmitCommentKeyEnabled.value = enabled;
        break;
      case 'shortcutSubmitImagePostKeyEnabled':
        shortcutSubmitImagePostKeyEnabled.value = enabled;
        break;
      case 'shortcutToggleModalKeyEnabled':
        shortcutToggleModalKeyEnabled.value = enabled;
        break;
      default:
        shortcutEnabled[storageKey] = enabled;
        break;
    }
  }

  async function saveShortcutKey(
    storageKey: string,
    newKey: string,
    isAltRequired: boolean = false
  ): Promise<SaveResult> {
    const normalizedShortcut = normalizeShortcutCombo(newKey);
    if (!normalizedShortcut) {
      return {
        success: false,
        message:
          '유효한 단축키 조합이 아닙니다. 영문/숫자/기호 키로 입력하세요. 예: Ctrl+Shift+K, Alt+1, F2',
      };
    }

    if (isAltRequired && !shortcutComboHasAlt(normalizedShortcut)) {
      return {
        success: false,
        message: '이 단축키는 Alt를 포함해야 합니다. 예: Alt+D, Alt+Shift+W',
      };
    }

    for (const action of customizableShortcutActions) {
      const otherStorageKey = `shortcut${action}Key`;
      if (otherStorageKey === storageKey) continue;

      const currentAssignedShortcut = normalizeShortcutWithFallback(
        shortcutKeys[otherStorageKey],
        defaultShortcutKeys[action],
        ALT_REQUIRED_ACTIONS.has(action)
      );

      if (currentAssignedShortcut === normalizedShortcut) {
        const conflictLabel = `${action} 키`;
        return {
          success: false,
          message: `'${normalizedShortcut}'는 이미 ${conflictLabel}에 할당되어 있습니다.`,
        };
      }
    }

    await Storage.saveShortcutKey(storageKey, normalizedShortcut);
    shortcutKeys[storageKey] = normalizedShortcut;
    return { success: true, message: `단축키가 '${normalizedShortcut}'(으)로 변경되었습니다.` };
  }

  async function saveMacroInterval(interval: number | string): Promise<SaveResult> {
    const numericInterval = Number(interval);
    if (isNaN(numericInterval) || numericInterval < 500) {
      return { success: false, message: '매크로 간격은 500ms 이상이어야 합니다.' };
    }
    await Storage.saveMacroInterval(numericInterval);
    macroInterval.value = numericInterval;
    return { success: true, message: `매크로 간격이 ${numericInterval}ms로 변경되었습니다.` };
  }

  async function saveShortcutDRefreshCommentEnabled(enabled: boolean): Promise<void> {
    await Storage.saveShortcutDRefreshCommentEnabled(enabled);
    shortcutDRefreshCommentEnabled.value = enabled;
  }

  async function saveFavoritesPreviewEnabled(enabled: boolean): Promise<void> {
    await Storage.saveFavoritesPreviewEnabled(enabled);
    favoritesPreviewEnabled.value = enabled;
  }

  async function saveFavoritesPreviewOpacity(opacity: number | string): Promise<SaveResult> {
    const numericOpacity = Number(opacity);
    if (isNaN(numericOpacity) || numericOpacity < 0.1 || numericOpacity > 1.0) {
      return { success: false, message: '투명도는 0.1에서 1.0 사이 값이어야 합니다.' };
    }
    await Storage.saveFavoritesPreviewOpacity(numericOpacity);
    favoritesPreviewOpacity.value = numericOpacity;
    return { success: true };
  }

  async function saveAutoRefreshEnabled(enabled: boolean): Promise<void> {
    await Storage.saveAutoRefreshEnabled(enabled);
    autoRefreshEnabled.value = enabled;
  }

  async function saveAutoRefreshInterval(interval: number | string): Promise<SaveResult> {
    const numericInterval = Number(interval);
    if (isNaN(numericInterval) || numericInterval < 1) {
      return { success: false, message: '확인 간격은 1초 이상이어야 합니다.' };
    }
    await Storage.saveAutoRefreshInterval(numericInterval);
    autoRefreshInterval.value = numericInterval;
    return { success: true };
  }

  async function saveAutoRefreshAllTabsEnabled(enabled: boolean): Promise<void> {
    await Storage.saveAutoRefreshAllTabsEnabled(enabled);
    autoRefreshAllTabsEnabled.value = enabled;
  }

  async function saveAutoRefreshHighlightColor(color: string): Promise<SaveResult> {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return { success: false, message: '하이라이트 색상은 #RRGGBB 형식이어야 합니다.' };
    }
    await Storage.saveAutoRefreshHighlightColor(color);
    autoRefreshHighlightColor.value = color;
    return { success: true };
  }

  async function saveAutoRefreshHighlightDuration(duration: number | string): Promise<SaveResult> {
    const numericDuration = Number(duration);
    if (isNaN(numericDuration) || numericDuration < -1) {
      return { success: false, message: '하이라이트 시간은 -1 이상이어야 합니다.' };
    }
    await Storage.saveAutoRefreshHighlightDuration(numericDuration);
    autoRefreshHighlightDuration.value = numericDuration;
    return { success: true };
  }

  async function savePauseOnInactiveEnabled(enabled: boolean): Promise<void> {
    await Storage.savePauseOnInactiveEnabled(enabled);
    pauseOnInactiveEnabled.value = enabled;
  }

  async function saveDcconAliasEnabled(enabled: boolean): Promise<void> {
    await Storage.saveDcconAliasEnabled(enabled);
    dcconAliasEnabled.value = enabled;
  }

  // --- Return (반환) ---
  return {
    pageNavigationMode,
    shortcutEnabled,
    shortcutKeys,
    altNumberEnabled,
    numberLabelsEnabled,
    numberNavigationEnabled,
    showDateInListEnabled,
    macroZEnabled,
    macroXEnabled,
    shortcutDRefreshCommentEnabled,
    macroInterval,
    favoritesPreviewEnabled,
    favoritesPreviewOpacity,
    autoRefreshEnabled,
    autoRefreshInterval,
    autoRefreshAllTabsEnabled,
    autoRefreshHighlightColor,
    autoRefreshHighlightDuration,
    shortcutSubmitCommentKeyEnabled,
    shortcutSubmitImagePostKeyEnabled,
    shortcutToggleModalKeyEnabled,
    pauseOnInactiveEnabled,
    dcconAliasEnabled,
    loadSettings,
    savePageNavigationMode,
    saveAltNumberEnabled,
    saveNumberLabelsEnabled,
    saveNumberNavigationEnabled,
    saveShowDateInListEnabled,
    saveShortcutEnabled,
    saveShortcutKey,
    saveMacroInterval,
    saveShortcutDRefreshCommentEnabled,
    saveFavoritesPreviewEnabled,
    saveFavoritesPreviewOpacity,
    saveAutoRefreshEnabled,
    saveAutoRefreshInterval,
    saveAutoRefreshAllTabsEnabled,
    saveAutoRefreshHighlightColor,
    saveAutoRefreshHighlightDuration,
    savePauseOnInactiveEnabled,
    saveDcconAliasEnabled,
    customizableShortcutActions,
    defaultShortcutKeys,
  };
});
