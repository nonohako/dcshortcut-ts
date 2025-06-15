import { defineStore } from 'pinia';
import { ref } from 'vue';

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

/**
 * @type ModalType
 * @description 활성화될 수 있는 모달의 종류를 정의하는 리터럴 타입.
 * - 'favorites': 즐겨찾기 관리 모달
 * - 'shortcuts': 단축키 설정 모달
 * - null: 현재 열려있는 모달이 없음
 */
type ModalType = 'favorites' | 'shortcuts' | null;


// =================================================================
// Pinia Store Definition (Pinia 스토어 정의)
// =================================================================

/**
 * @description UI 관련 상태(예: 모달 표시 여부)를 관리하는 Pinia 스토어.
 */
export const useUiStore = defineStore('ui', () => {
    // --- STATE (상태) ---

    /**
     * @description 현재 화면에 표시되고 있는 모달의 종류를 저장합니다.
     * `ModalType`으로 타입이 지정되어 정해진 값 외에는 할당할 수 없습니다.
     */
    const activeModal = ref<ModalType>(null);

    /**
     * @description 즐겨찾기 목록 미리보기(툴팁)의 표시 여부를 제어합니다.
     */
    const isFavoritesPreviewVisible = ref<boolean>(false);


    // --- ACTIONS (액션) ---

    /**
     * @description 즐겨찾기 관리 모달을 엽니다.
     */
    function openFavoritesModal(): void {
        activeModal.value = 'favorites';
        console.log('[Pinia UI] 활성 모달: favorites');
    }

    /**
     * @description 단축키 설정 모달을 엽니다.
     */
    function openShortcutManagerModal(): void {
        activeModal.value = 'shortcuts';
        console.log('[Pinia UI] 활성 모달: shortcuts');
    }

    /**
     * @description 현재 열려있는 모든 모달을 닫습니다.
     */
    function closeModal(): void {
        activeModal.value = null;
        console.log('[Pinia UI] 활성 모달: null (닫힘)');
    }

    /**
     * @description 즐겨찾기 모달의 상태를 토글합니다. (열려있으면 닫고, 닫혀있으면 엽니다)
     */
    function toggleFavorites(): void {
        activeModal.value = activeModal.value === 'favorites' ? null : 'favorites';
        console.log('[Pinia UI] 즐겨찾기 모달 토글:', activeModal.value);
    }

    /**
     * @description 단축키 설정 모달의 상태를 토글합니다.
     */
    function toggleShortcuts(): void {
        activeModal.value = activeModal.value === 'shortcuts' ? null : 'shortcuts';
        console.log('[Pinia UI] 단축키 모달 토글:', activeModal.value);
    }

    /**
     * @description 즐겨찾기 목록 미리보기를 표시합니다.
     */
    function showFavoritesPreview(): void {
        isFavoritesPreviewVisible.value = true;
    }

    /**
     * @description 즐겨찾기 목록 미리보기를 숨깁니다.
     */
    function hideFavoritesPreview(): void {
        isFavoritesPreviewVisible.value = false;
    }


    // --- Return (반환) ---
    // 컴포넌트에서 사용할 수 있도록 상태와 액션을 반환합니다.
    return {
        activeModal,
        isFavoritesPreviewVisible,
        openFavoritesModal,
        openShortcutManagerModal,
        closeModal,
        toggleFavorites,
        toggleShortcuts,
        showFavoritesPreview,
        hideFavoritesPreview,
    };
});