// src/stores/settingsStore.ts

import { defineStore } from 'pinia';
import { ref, reactive, type Ref } from 'vue';
import Storage from '@/services/Storage';
																				 
import type { PageNavigationMode } from '@/types'; // [수정] 중앙 타입 파일에서 가져오기

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

   
						
																			   
							 
																							 
   
interface SaveResult {
    success: boolean;
    message?: string;
}

   
					   
																	  
   
type ShortcutAction =
    | 'W' | 'C' | 'D' | 'R' | 'Q' | 'E'
    | 'F' | 'G' | 'A' | 'S' | 'Z' | 'X'
    | 'PrevProfile' | 'NextProfile' | 'SubmitComment'
    | 'SubmitImagePost' | 'ToggleModal';
type ShortcutKeysState = { [key: string]: string };
type ShortcutEnabledState = { [key: string]: boolean };

// [수정] 스토어가 반환하는 모든 값의 타입을 명시하는 인터페이스 추가
interface SettingsStoreReturn {
  // State
  pageNavigationMode: Ref<PageNavigationMode>;
  shortcutEnabled: ShortcutEnabledState;
  shortcutKeys: ShortcutKeysState;
  altNumberEnabled: Ref<boolean>;
  macroZEnabled: Ref<boolean>;
  macroXEnabled: Ref<boolean>;
  shortcutDRefreshCommentEnabled: Ref<boolean>;
  macroInterval: Ref<number>;
  favoritesPreviewEnabled: Ref<boolean>;
  favoritesPreviewOpacity: Ref<number>;
  autoRefreshEnabled: Ref<boolean>;
  autoRefreshInterval: Ref<number>;
  shortcutSubmitCommentKeyEnabled: Ref<boolean>;
  shortcutSubmitImagePostKeyEnabled: Ref<boolean>;
  shortcutToggleModalKeyEnabled: Ref<boolean>;
  pauseOnInactiveEnabled: Ref<boolean>;

  // Actions
  loadSettings: () => Promise<void>;
  savePageNavigationMode: (mode: PageNavigationMode) => Promise<void>;
  saveAltNumberEnabled: (enabled: boolean) => Promise<void>;
  saveShortcutEnabled: (storageKey: string, enabled: boolean) => Promise<void>;
  saveShortcutKey: (storageKey: string, newKey: string, isAltRequired?: boolean) => Promise<SaveResult>;
  saveMacroInterval: (interval: number | string) => Promise<SaveResult>;
  saveShortcutDRefreshCommentEnabled: (enabled: boolean) => Promise<void>;
  saveFavoritesPreviewEnabled: (enabled: boolean) => Promise<void>;
  saveFavoritesPreviewOpacity: (opacity: number | string) => Promise<SaveResult>;
  saveAutoRefreshEnabled: (enabled: boolean) => Promise<void>;
  saveAutoRefreshInterval: (interval: number | string) => Promise<SaveResult>;
  savePauseOnInactiveEnabled: (enabled: boolean) => Promise<void>;

  // Constants
  customizableShortcutActions: ShortcutAction[];
  defaultShortcutKeys: Record<ShortcutAction, string>;
}

// =================================================================
// Constants (상수 정의)
// =================================================================

   
								  
																																			  
   
const defaultShortcutKeys: Record<ShortcutAction, string> = {
    W: 'W', C: 'C', D: 'D', R: 'R', Q: 'Q', E: 'E',
    F: 'F', G: 'G', A: 'A', S: 'S', Z: 'Z', X: 'X',
    PrevProfile: '[', NextProfile: ']',
    SubmitComment: 'D', SubmitImagePost: 'W', ToggleModal: '`',
					   
						 
					 
};

   
								   
																														  
   
const customizableShortcutActions: ShortcutAction[] = Object.keys(defaultShortcutKeys) as ShortcutAction[];


// =================================================================
// Pinia Store Definition (Pinia 스토어 정의)
// =================================================================

export const useSettingsStore = defineStore('settings', (): SettingsStoreReturn => {
    // --- State (상태) ---
																	   

						   
    const pageNavigationMode = ref<PageNavigationMode>('ajax');
										
    const shortcutEnabled = reactive<ShortcutEnabledState>({});
						
    const shortcutKeys = reactive<ShortcutKeysState>({});
											
    const altNumberEnabled = ref<boolean>(true);
						  
    const macroZEnabled = ref<boolean>(true);
							
    const macroXEnabled = ref<boolean>(true);
							
    const shortcutDRefreshCommentEnabled = ref<boolean>(true);
								   
    const macroInterval = ref<number>(5000);
						 
    const favoritesPreviewEnabled = ref<boolean>(true);
						   
    const favoritesPreviewOpacity = ref<number>(0.85);
										   
    const autoRefreshEnabled = ref<boolean>(false);
									   
    const autoRefreshInterval = ref<number>(10);
						   
    const shortcutSubmitCommentKeyEnabled = ref<boolean>(true);
							  
    const shortcutSubmitImagePostKeyEnabled = ref<boolean>(true);
						   
    const shortcutToggleModalKeyEnabled = ref<boolean>(true);
									  
    const pauseOnInactiveEnabled = ref<boolean>(true);


    // --- Actions (액션) ---

    /**
     * chrome.storage에서 모든 설정을 비동기적으로 불러와 스토어 상태를 초기화합니다.
     */
    async function loadSettings(): Promise<void> {
        console.log('[Pinia] 스토리지에서 설정 로딩 중...');

        // 여러 설정을 병렬로 로드하기 위한 프로미스 배열
        const promises: Promise<any>[] = [
            Storage.getPageNavigationMode().then(val => pageNavigationMode.value = val),
            Storage.getAltNumberEnabled().then(val => altNumberEnabled.value = val),
            Storage.getMacroInterval().then(val => macroInterval.value = val),
            Storage.getShortcutDRefreshCommentEnabled().then(val => shortcutDRefreshCommentEnabled.value = val),
            Storage.getFavoritesPreviewEnabled().then(val => favoritesPreviewEnabled.value = val),
            Storage.getFavoritesPreviewOpacity().then(val => favoritesPreviewOpacity.value = val),
            Storage.getAutoRefreshEnabled().then(val => autoRefreshEnabled.value = val),
            Storage.getAutoRefreshInterval().then(val => autoRefreshInterval.value = val),
            Storage.getShortcutEnabled('shortcutMacroZEnabled').then(val => macroZEnabled.value = val),
            Storage.getShortcutEnabled('shortcutMacroXEnabled').then(val => macroXEnabled.value = val),
            Storage.getShortcutEnabled('shortcutSubmitCommentKeyEnabled').then(val => shortcutSubmitCommentKeyEnabled.value = val),
            Storage.getShortcutEnabled('shortcutSubmitImagePostKeyEnabled').then(val => shortcutSubmitImagePostKeyEnabled.value = val),
            Storage.getShortcutEnabled('shortcutToggleModalKeyEnabled').then(val => shortcutToggleModalKeyEnabled.value = val),
            Storage.getPauseOnInactiveEnabled().then(val => pauseOnInactiveEnabled.value = val),
        ];

        // 커스터마이징 가능한 모든 단축키에 대해 설정 로드 프로미스를 추가합니다.
        customizableShortcutActions.forEach(action => {
            // 단축키의 키 값 로드
            const keyKey = `shortcut${action}Key`;
            promises.push(Storage.getShortcutKey(keyKey).then(val => shortcutKeys[keyKey] = val ?? defaultShortcutKeys[action]));

            // 활성화 상태 로드 (Alt 조합 단축키는 별도 관리되므로 제외)
            const isAltShortcut = ['SubmitComment', 'SubmitImagePost', 'ToggleModal'].includes(action);
            if (!isAltShortcut) {
                const enabledKey = `shortcut${action}Enabled`;
                // 저장된 값이 false가 아닌 이상 기본값은 true
                promises.push(Storage.getShortcutEnabled(enabledKey).then(val => shortcutEnabled[enabledKey] = (val !== false)));
            }
        });

        await Promise.all(promises);
        console.log('[Pinia] 설정 로딩 완료.');
    }

    // --- 각 설정 항목을 저장하는 액션 함수들 ---

    async function savePageNavigationMode(mode: PageNavigationMode): Promise<void> {
        // 타입 가드를 통해 유효한 값만 저장하도록 보장
        if (mode !== 'ajax' && mode !== 'full') return;
        await Storage.savePageNavigationMode(mode);
        pageNavigationMode.value = mode;
    }

    async function saveAltNumberEnabled(enabled: boolean): Promise<void> {
        await Storage.saveAltNumberEnabled(enabled);
        altNumberEnabled.value = enabled;
    }

    async function saveShortcutEnabled(storageKey: string, enabled: boolean): Promise<void> {
        await Storage.saveShortcutEnabled(storageKey, enabled);
        // storageKey에 따라 적절한 상태(ref)를 업데이트합니다.
        // `shortcutEnabled` 객체에 속하지 않는 특정 단축키들을 처리합니다.
        switch (storageKey) {
            case 'shortcutMacroZEnabled': macroZEnabled.value = enabled; break;
            case 'shortcutMacroXEnabled': macroXEnabled.value = enabled; break;
            case 'shortcutSubmitCommentKeyEnabled': shortcutSubmitCommentKeyEnabled.value = enabled; break;
            case 'shortcutSubmitImagePostKeyEnabled': shortcutSubmitImagePostKeyEnabled.value = enabled; break;
            case 'shortcutToggleModalKeyEnabled': shortcutToggleModalKeyEnabled.value = enabled; break;
            default: shortcutEnabled[storageKey] = enabled; break;
        }
    }

    async function saveShortcutKey(storageKey: string, newKey: string, isAltRequired: boolean = false): Promise<SaveResult> {
        newKey = newKey.toUpperCase();

        // 유효성 검사: 한 글자이며, 허용된 문자(영문 대문자, 숫자, [, ], `)인지 확인
        if (newKey.length !== 1 || !/^[A-Z0-9\[\]`]$/.test(newKey)) {
            return { success: false, message: "단축키는 영문(A-Z), 숫자(0-9), 특수문자([, ], `)만 가능합니다." };
        }

        // 다른 단축키와 중복되는지 확인
        for (const action of customizableShortcutActions) {
            const otherStorageKey = `shortcut${action}Key`;
            if (otherStorageKey === storageKey) continue;

            const currentAssignedKey = (shortcutKeys[otherStorageKey] ?? defaultShortcutKeys[action]).toUpperCase();
            if (currentAssignedKey === newKey) {
                // Alt 조합 여부가 같은 경우에만 중복으로 간주
                const otherActionIsAlt = ['SubmitComment', 'SubmitImagePost', 'ToggleModal'].includes(action);
                if (isAltRequired === otherActionIsAlt) {
                    const conflictLabel = `${action} 키`;
                    return { success: false, message: `'${newKey}'는 이미 ${conflictLabel}에 할당되어 있습니다.` };
                }
            }
        }

        await Storage.saveShortcutKey(storageKey, newKey);
        shortcutKeys[storageKey] = newKey;
        return { success: true, message: `단축키가 '${newKey}'(으)로 변경되었습니다.` };
    }

    async function saveMacroInterval(interval: number | string): Promise<SaveResult> {
        const numericInterval = Number(interval);
        if (isNaN(numericInterval) || numericInterval < 500) {
            return { success: false, message: "매크로 간격은 500ms 이상이어야 합니다." };
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
            return { success: false, message: "투명도는 0.1에서 1.0 사이 값이어야 합니다." };
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
            return { success: false, message: "확인 간격은 1초 이상이어야 합니다." };
        }
        await Storage.saveAutoRefreshInterval(numericInterval);
        autoRefreshInterval.value = numericInterval;
        return { success: true };
    }

    async function savePauseOnInactiveEnabled(enabled: boolean): Promise<void> {
        await Storage.savePauseOnInactiveEnabled(enabled);
        pauseOnInactiveEnabled.value = enabled;
    }


    // --- Return (반환) ---
    // 반환되는 객체는 위에서 정의한 SettingsStoreReturn 인터페이스를 따릅니다.
    return {
        // State
        pageNavigationMode,
        shortcutEnabled,
        shortcutKeys,
        altNumberEnabled,
        macroZEnabled,
        macroXEnabled,
        shortcutDRefreshCommentEnabled,
        macroInterval,
        favoritesPreviewEnabled,
        favoritesPreviewOpacity,
        autoRefreshEnabled,
        autoRefreshInterval,
        shortcutSubmitCommentKeyEnabled,
        shortcutSubmitImagePostKeyEnabled,
        shortcutToggleModalKeyEnabled,
        pauseOnInactiveEnabled,

        // Actions
        loadSettings,
        savePageNavigationMode,
        saveAltNumberEnabled,
        saveShortcutEnabled,
        saveShortcutKey,
        saveMacroInterval,
        saveShortcutDRefreshCommentEnabled,
        saveFavoritesPreviewEnabled,
        saveFavoritesPreviewOpacity,
        saveAutoRefreshEnabled,
        saveAutoRefreshInterval,
        savePauseOnInactiveEnabled,

        // Constants
        customizableShortcutActions,
        defaultShortcutKeys,
    };
});