export const SHORTCUT_DEFINITIONS = [
  { action: 'W', defaultKey: 'W', label: '글쓰기' },
  { action: 'C', defaultKey: 'C', label: '댓글 입력' },
  { action: 'D', defaultKey: 'D', label: '댓글 이동' },
  { action: 'R', defaultKey: 'R', label: '새로고침' },
  { action: 'Q', defaultKey: 'Q', label: '최상단 스크롤' },
  { action: 'E', defaultKey: 'E', label: '글 목록 스크롤' },
  { action: 'F', defaultKey: 'F', label: '전체글' },
  { action: 'G', defaultKey: 'G', label: '개념글' },
  { action: 'A', defaultKey: 'A', label: '다음 페이지' },
  { action: 'S', defaultKey: 'S', label: '이전 페이지' },
  { action: 'GallerySearch', defaultKey: 'V', label: '갤러리 내부 검색' },
  { action: 'GlobalSearch', defaultKey: 'Alt+V', label: '통합 검색' },
  { action: 'Z', defaultKey: 'Z', label: '다음 글' },
  { action: 'X', defaultKey: 'X', label: '이전 글' },
  { action: 'PrevProfile', defaultKey: '[', label: '이전 폴더' },
  { action: 'NextProfile', defaultKey: ']', label: '다음 폴더' },
  { action: 'SubmitComment', defaultKey: 'Alt+D', label: '댓글 등록', altRequired: true },
  { action: 'SubmitImagePost', defaultKey: 'Alt+W', label: '글 등록', altRequired: true },
  { action: 'MacroZ', defaultKey: 'Alt+Z', label: '다음 글 자동 넘김', altRequired: true },
  { action: 'MacroX', defaultKey: 'Alt+X', label: '이전 글 자동 넘김', altRequired: true },
] as const;

export type ShortcutAction = (typeof SHORTCUT_DEFINITIONS)[number]['action'];

export const SHORTCUT_ACTIONS = SHORTCUT_DEFINITIONS.map(
  ({ action }) => action
) as ShortcutAction[];

export const DEFAULT_SHORTCUT_KEYS = Object.fromEntries(
  SHORTCUT_DEFINITIONS.map(({ action, defaultKey }) => [action, defaultKey])
) as Record<ShortcutAction, string>;

const ALT_REQUIRED_SHORTCUT_ACTIONS = new Set<ShortcutAction>(
  SHORTCUT_DEFINITIONS.filter(
    (definition): definition is (typeof SHORTCUT_DEFINITIONS)[number] & { altRequired: true } =>
      'altRequired' in definition && definition.altRequired
  ).map(({ action }) => action)
);

export const LEGACY_SHORTCUT_ENABLED_KEYS: Partial<Record<ShortcutAction, string>> = {
  SubmitComment: 'shortcutSubmitCommentKeyEnabled',
  SubmitImagePost: 'shortcutSubmitImagePostKeyEnabled',
};

export const getShortcutKeyStorageKey = (action: ShortcutAction): string =>
  `shortcut${action}Key`;

export const getShortcutEnabledStorageKey = (action: ShortcutAction): string =>
  `shortcut${action}Enabled`;

export const isAltRequiredShortcut = (action: ShortcutAction): boolean =>
  ALT_REQUIRED_SHORTCUT_ACTIONS.has(action);

export const isShortcutAction = (value: string): value is ShortcutAction =>
  SHORTCUT_ACTIONS.includes(value as ShortcutAction);
