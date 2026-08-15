// 일반 웹사이트에는 즐겨찾기 창 토글 단축키 감지만 최소한으로 설치합니다.
// DC 전용 기능과 Vue UI는 단축키가 실제로 사용될 때 백그라운드가 지연 주입합니다.

export {};

(() => {

const TOGGLE_MODAL_KEY_STORAGE = 'shortcutToggleModalKey';
const TOGGLE_MODAL_ENABLED_STORAGE = 'shortcutToggleModalEnabled';
const DEFAULT_TOGGLE_MODAL_KEY = 'Alt+`';

type GlobalUiTarget = 'favorites' | 'shortcuts';
type GlobalUiMode = 'open' | 'toggle';
type ModifierName = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';

const MODIFIER_ORDER: ModifierName[] = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'AltGraph', 'Shift', 'Meta', 'OS']);
const MODIFIER_ALIASES: Record<string, ModifierName> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  win: 'Meta',
  windows: 'Meta',
};
const KEY_NORMALIZATION_MAP: Record<string, string> = {
  ' ': 'Space',
  space: 'Space',
  spacebar: 'Space',
  esc: 'Escape',
  escape: 'Escape',
  return: 'Enter',
  enter: 'Enter',
  del: 'Delete',
  delete: 'Delete',
  ins: 'Insert',
  insert: 'Insert',
  pgup: 'PageUp',
  pageup: 'PageUp',
  pgdn: 'PageDown',
  pagedown: 'PageDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  plus: 'Plus',
  dot: 'Period',
};

let toggleModalKey = DEFAULT_TOGGLE_MODAL_KEY;
let toggleModalEnabled = true;

const normalizeKeyToken = (rawKey: string): string => {
  const mapped = KEY_NORMALIZATION_MAP[rawKey.toLocaleLowerCase()];
  if (mapped) return mapped;
  if (rawKey.length === 1 && rawKey.charCodeAt(0) >= 33 && rawKey.charCodeAt(0) <= 126) {
    return rawKey === '+' ? 'Plus' : rawKey.toUpperCase();
  }
  if (/^f\d{1,2}$/i.test(rawKey)) return rawKey.toUpperCase();
  if (!/^[A-Za-z0-9]+$/.test(rawKey)) return '';
  return rawKey.charAt(0).toUpperCase() + rawKey.slice(1);
};

const normalizeShortcut = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const modifiers = new Set<ModifierName>();
  let keyToken = '';

  for (const rawToken of value.split('+').map((token) => token.trim()).filter(Boolean)) {
    const modifier = MODIFIER_ALIASES[rawToken.toLocaleLowerCase()];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    const normalizedKey = normalizeKeyToken(rawToken);
    if (!normalizedKey || keyToken) return '';
    keyToken = normalizedKey;
  }

  if (!keyToken) return '';
  const tokens: string[] = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  if (!modifiers.has('Alt')) tokens.push('Alt');
  tokens.push(keyToken);
  return tokens.join('+');
};

const shortcutFromEvent = (event: KeyboardEvent): string => {
  if (event.isComposing || MODIFIER_KEYS.has(event.key)) return '';
  const keyToken = normalizeKeyToken(event.key);
  if (!keyToken) return '';
  const modifiers: Record<ModifierName, boolean> = {
    Ctrl: event.ctrlKey,
    Alt: event.altKey,
    Shift: event.shiftKey,
    Meta: event.metaKey,
  };
  return [...MODIFIER_ORDER.filter((modifier) => modifiers[modifier]), keyToken].join('+');
};

const requestGlobalUi = async (target: GlobalUiTarget, mode: GlobalUiMode): Promise<boolean> => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ensureGlobalUi',
      target,
      mode,
    });
    return response?.success === true;
  } catch (error) {
    console.warn('[Global Shortcut] UI를 열지 못했습니다.', error);
    return false;
  }
};

const loadToggleShortcut = async (): Promise<void> => {
  const stored = await chrome.storage.local.get({
    [TOGGLE_MODAL_KEY_STORAGE]: DEFAULT_TOGGLE_MODAL_KEY,
    [TOGGLE_MODAL_ENABLED_STORAGE]: true,
  });
  toggleModalKey = normalizeShortcut(stored[TOGGLE_MODAL_KEY_STORAGE]) || DEFAULT_TOGGLE_MODAL_KEY;
  toggleModalEnabled = stored[TOGGLE_MODAL_ENABLED_STORAGE] !== false;
};

document.addEventListener('keydown', (event) => {
  if (event.repeat || !toggleModalEnabled) return;
  if (shortcutFromEvent(event) !== toggleModalKey) return;
  event.preventDefault();
  event.stopPropagation();
  void requestGlobalUi('favorites', 'toggle');
}, true);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[TOGGLE_MODAL_KEY_STORAGE]) {
    toggleModalKey = normalizeShortcut(changes[TOGGLE_MODAL_KEY_STORAGE].newValue) || DEFAULT_TOGGLE_MODAL_KEY;
  }
  if (changes[TOGGLE_MODAL_ENABLED_STORAGE]) {
    toggleModalEnabled = changes[TOGGLE_MODAL_ENABLED_STORAGE].newValue !== false;
  }
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  // UI가 이미 주입된 뒤에는 기존 콘텐츠 스크립트가 팝업 메시지를 처리합니다.
  if (document.getElementById('dc-ShortCut-app')) return false;
  if (!message || typeof message !== 'object') return false;
  const action = (message as { action?: unknown }).action;
  const target = action === 'openFavoritesModal'
    ? 'favorites'
    : action === 'openShortcutManagerModal'
      ? 'shortcuts'
      : null;
  if (!target) return false;

  void requestGlobalUi(target, 'open').then((success) => sendResponse({ success }));
  return true;
});

void loadToggleShortcut().catch((error) => {
  console.warn('[Global Shortcut] 설정을 불러오지 못해 기본 단축키를 사용합니다.', error);
});
})();
