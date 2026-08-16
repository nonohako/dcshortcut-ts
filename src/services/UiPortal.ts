import type { InjectionKey } from 'vue';

/** Shadow DOM 안에서 툴팁처럼 Teleport되는 UI가 사용할 전용 포털입니다. */
export const UI_PORTAL_TARGET_KEY: InjectionKey<HTMLElement> = Symbol('dc-shortcut-ui-portal');
