// Shortcut.ts

type ModifierName = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';

const MODIFIER_ORDER: ModifierName[] = ['Ctrl', 'Alt', 'Shift', 'Meta'];

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

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'AltGraph', 'Shift', 'Meta', 'OS']);
const DISALLOWED_KEY_TOKENS = new Set([
  'Process',
  'Dead',
  'Unidentified',
  'Compose',
  'HangulMode',
  'HanjaMode',
  'JunjaMode',
  'FinalMode',
]);

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

interface ModifierState {
  Ctrl: boolean;
  Alt: boolean;
  Shift: boolean;
  Meta: boolean;
}

function isAsciiPrintableChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 33 && code <= 126;
}

function normalizeKeyToken(rawKey: string): string {
  if (DISALLOWED_KEY_TOKENS.has(rawKey)) return '';
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(rawKey)) return '';

  const trimmed = rawKey.trim();
  if (!trimmed) return '';

  const mapped = KEY_NORMALIZATION_MAP[trimmed.toLowerCase()];
  if (mapped) return mapped;

  if (trimmed.length === 1) {
    if (trimmed === '+') return 'Plus';
    if (!isAsciiPrintableChar(trimmed)) return '';
    return trimmed.toUpperCase();
  }

  if (/^f\d{1,2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (!/^[A-Za-z0-9]+$/.test(trimmed)) return '';

  const normalizedToken = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (DISALLOWED_KEY_TOKENS.has(normalizedToken)) return '';

  return normalizedToken;
}

function formatShortcutCombo(modifiers: ModifierState, keyToken: string): string {
  const tokens: string[] = [];
  MODIFIER_ORDER.forEach((modifier) => {
    if (modifiers[modifier]) {
      tokens.push(modifier);
    }
  });
  tokens.push(keyToken);
  return tokens.join('+');
}

export function normalizeShortcutCombo(combo: string): string | null {
  const trimmed = combo.trim();
  if (!trimmed) return null;

  const tokens = trimmed
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const modifiers: ModifierState = {
    Ctrl: false,
    Alt: false,
    Shift: false,
    Meta: false,
  };

  let keyToken: string | null = null;

  for (const token of tokens) {
    const modifier = MODIFIER_ALIASES[token.toLowerCase()];
    if (modifier) {
      modifiers[modifier] = true;
      continue;
    }

    const normalizedKey = normalizeKeyToken(token);
    if (!normalizedKey) return null;

    if (keyToken !== null) {
      return null;
    }
    keyToken = normalizedKey;
  }

  if (!keyToken) return null;

  return formatShortcutCombo(modifiers, keyToken);
}

export function getShortcutComboFromEvent(event: KeyboardEvent): string | null {
  if (event.isComposing || MODIFIER_KEYS.has(event.key)) {
    return null;
  }

  const keyToken = normalizeKeyToken(event.key);
  if (!keyToken) return null;

  return formatShortcutCombo(
    {
      Ctrl: event.ctrlKey,
      Alt: event.altKey,
      Shift: event.shiftKey,
      Meta: event.metaKey,
    },
    keyToken
  );
}

export function shortcutComboHasAlt(combo: string): boolean {
  const normalized = normalizeShortcutCombo(combo);
  return normalized ? normalized.split('+').includes('Alt') : false;
}

export function normalizeShortcutWithFallback(
  combo: string | null | undefined,
  fallback: string,
  isAltRequired: boolean = false
): string {
  let normalized = normalizeShortcutCombo(combo ?? '') ?? normalizeShortcutCombo(fallback) ?? '';
  if (!normalized) return '';

  if (isAltRequired && !shortcutComboHasAlt(normalized)) {
    normalized = `Alt+${normalized}`;
  }

  return normalized;
}
