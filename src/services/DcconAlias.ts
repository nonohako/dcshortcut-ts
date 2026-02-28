import type { DcconAliasMap, DcconAliasTarget } from '@/types';
import { DCCON_ALIAS_ENABLED_KEY, DCCON_ALIAS_MAP_KEY } from './Global';
import Storage from './Storage';
import UI from './UI';

interface AliasTokenContext {
  query: string;
  start: number;
  end: number;
}

interface AliasPopupTarget extends Omit<DcconAliasTarget, 'updatedAt'> {
  aliases: string[];
}

interface AliasSuggestionState {
  textarea: HTMLTextAreaElement;
  token: AliasTokenContext;
  matches: AliasPopupTarget[];
  selectedIndex: number;
}

interface AliasEditableTargetInfo {
  packageIdx: string;
  detailIdx: string;
  title?: string;
  imageUrl?: string;
}

const SUGGESTION_LIMIT = 120;
const MAX_ALIAS_LENGTH = 5;
const HANGUL_SYLLABLE_BASE = 0xac00;
const HANGUL_SYLLABLE_LAST = 0xd7a3;
const HANGUL_INITIAL_CYCLE = 588;
const HANGUL_INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;
const HANGUL_CONSONANT_QUERY_REGEX = /^[ㄱ-ㅎ]+$/;
const POPUP_CLASS_NAME = 'dc-shortcut-dccon-popup';
const POPUP_LIST_CLASS_NAME = 'dc-shortcut-dccon-popup-list';
const POPUP_CELL_CLASS_NAME = 'dc-shortcut-dccon-popup-cell';
const POPUP_BUTTON_CLASS_NAME = 'dc-shortcut-dccon-popup-button';
const POPUP_BUTTON_SELECTED_CLASS_NAME = 'is-selected';
const POPUP_PREVIEW_CLASS_NAME = 'dc-shortcut-dccon-popup-preview';
// Keep this in sync with .dc-shortcut-dccon-popup-list grid columns in style.css.
const POPUP_GRID_COLUMN_COUNT = 6;

let isInitialized = false;
let aliasMap: DcconAliasMap = {};
let groupedAliases: AliasPopupTarget[] = [];
let popupElement: HTMLDivElement | null = null;
let popupListElement: HTMLUListElement | null = null;
let popupPreviewElement: HTMLDivElement | null = null;
let activeSuggestionState: AliasSuggestionState | null = null;
let repositionRafId: number | null = null;
let dcconAliasEnabled = true;

const scrollRepositionHandler = (): void => {
  if (!activeSuggestionState) return;
  schedulePopupReposition();
};

const storageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void => {
  if (areaName !== 'local') return;

  if (changes[DCCON_ALIAS_MAP_KEY]) {
    void reloadAliasMap();
  }

  if (changes[DCCON_ALIAS_ENABLED_KEY]) {
    dcconAliasEnabled = changes[DCCON_ALIAS_ENABLED_KEY].newValue !== false;
    if (!dcconAliasEnabled) {
      hideSuggestions();
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement && isCommentTextarea(activeElement)) {
      updateSuggestionsForTextarea(activeElement);
    }
  }
};

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAliasKey(alias: string): string {
  return safeTrim(alias).toLocaleLowerCase();
}

function sanitizeSingleAlias(rawAlias: string): string {
  if (typeof rawAlias !== 'string') return '';
  const alias = rawAlias.replace(/^@+/, '').trim();
  if (!alias || /\s/.test(alias)) return '';
  return alias.slice(0, MAX_ALIAS_LENGTH);
}

function parseAliasListInput(rawInput: string): string[] {
  const dedupedAliases: string[] = [];
  const seen = new Set<string>();

  safeTrim(rawInput)
    .split(',')
    .forEach((token) => {
      const alias = sanitizeSingleAlias(token);
      if (!alias) return;

      const normalized = normalizeAliasKey(alias);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      dedupedAliases.push(alias);
    });

  return dedupedAliases;
}

function getAliasSortBucket(alias: string): number {
  const firstChar = safeTrim(alias).charAt(0);
  if (!firstChar) return 9;
  if (/^[0-9]$/.test(firstChar)) return 0;
  if (/^[A-Za-z]$/.test(firstChar)) return 1;
  if (/^[ㄱ-ㅎㅏ-ㅣ가-힣]$/.test(firstChar)) return 2;
  return 3;
}

function compareAliasStrings(a: string, b: string): number {
  const bucketDiff = getAliasSortBucket(a) - getAliasSortBucket(b);
  if (bucketDiff !== 0) return bucketDiff;

  const aliasCompare = a.localeCompare(b, 'ko', {
    sensitivity: 'base',
    numeric: true,
  });
  if (aliasCompare !== 0) return aliasCompare;
  return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });
}

function comparePopupTargets(a: AliasPopupTarget, b: AliasPopupTarget): number {
  const aliasCompare = compareAliasStrings(a.alias, b.alias);
  if (aliasCompare !== 0) return aliasCompare;

  const packageCompare = a.packageIdx.localeCompare(b.packageIdx, 'en', { numeric: true });
  if (packageCompare !== 0) return packageCompare;
  return a.detailIdx.localeCompare(b.detailIdx, 'en', { numeric: true });
}

function aliasIdentity(target: AliasPopupTarget): string {
  return `${target.packageIdx}:${target.detailIdx}`;
}

function rebuildGroupedAliases(): void {
  interface AliasGroupDraft {
    packageIdx: string;
    detailIdx: string;
    title?: string;
    imageUrl?: string;
    aliasEntries: Array<{ alias: string; updatedAt: number }>;
  }

  const groups = new Map<string, AliasGroupDraft>();

  Object.values(aliasMap).forEach((targets) => {
    targets.forEach((target) => {
      const groupKey = `${target.packageIdx}:${target.detailIdx}`;
      const draft = groups.get(groupKey) ?? {
        packageIdx: target.packageIdx,
        detailIdx: target.detailIdx,
        title: target.title,
        imageUrl: target.imageUrl,
        aliasEntries: [],
      };

      draft.aliasEntries.push({
        alias: target.alias,
        updatedAt: Number.isFinite(target.updatedAt) ? target.updatedAt : Date.now(),
      });
      if (!draft.title && target.title) draft.title = target.title;
      if (!draft.imageUrl && target.imageUrl) draft.imageUrl = target.imageUrl;

      groups.set(groupKey, draft);
    });
  });

  const nextGroupedAliases: AliasPopupTarget[] = [];
  groups.forEach((draft) => {
    const dedupedAliasMap = new Map<string, { alias: string; updatedAt: number }>();
    draft.aliasEntries.forEach((entry) => {
      const normalized = normalizeAliasKey(entry.alias);
      if (!normalized) return;

      const prev = dedupedAliasMap.get(normalized);
      if (!prev || entry.updatedAt < prev.updatedAt) {
        dedupedAliasMap.set(normalized, entry);
      }
    });

    const aliases = Array.from(dedupedAliasMap.values())
      .sort((a, b) => a.updatedAt - b.updatedAt || compareAliasStrings(a.alias, b.alias))
      .map((entry) => entry.alias);
    if (aliases.length === 0) return;

    nextGroupedAliases.push({
      alias: aliases[0],
      aliases,
      packageIdx: draft.packageIdx,
      detailIdx: draft.detailIdx,
      title: draft.title,
      imageUrl: draft.imageUrl,
    });
  });

  groupedAliases = nextGroupedAliases.sort(comparePopupTargets);
}

async function reloadAliasMap(): Promise<void> {
  aliasMap = await Storage.getDcconAliasMap();
  rebuildGroupedAliases();
  if (!activeSuggestionState || !dcconAliasEnabled) return;
  updateSuggestionsForTextarea(activeSuggestionState.textarea);
}

async function reloadAliasEnabledState(): Promise<void> {
  dcconAliasEnabled = await Storage.getDcconAliasEnabled();
  if (!dcconAliasEnabled) {
    hideSuggestions();
    return;
  }
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLTextAreaElement && isCommentTextarea(activeElement)) {
    updateSuggestionsForTextarea(activeElement);
  }
}

async function persistAliasMap(): Promise<void> {
  await Storage.saveDcconAliasMap(aliasMap);
  rebuildGroupedAliases();
}

function isCommentTextarea(element: Element | null): element is HTMLTextAreaElement {
  return (
    element instanceof HTMLTextAreaElement &&
    element.matches('textarea[id^="memo_"], textarea[name="memo"], .cmt_write_box textarea')
  );
}

function getAliasesByTarget(packageIdx: string, detailIdx: string): string[] {
  const groupedMatch = groupedAliases.find(
    (target) => target.packageIdx === packageIdx && target.detailIdx === detailIdx
  );
  if (groupedMatch) return [...groupedMatch.aliases];

  const fallback = new Map<string, string>();
  Object.values(aliasMap).forEach((targets) => {
    targets.forEach((target) => {
      if (target.packageIdx !== packageIdx || target.detailIdx !== detailIdx) return;
      const normalized = normalizeAliasKey(target.alias);
      if (!normalized || fallback.has(normalized)) return;
      fallback.set(normalized, target.alias);
    });
  });

  return Array.from(fallback.values()).sort(compareAliasStrings);
}

function extractHangulInitials(value: string): string {
  let initials = '';

  for (const char of value) {
    const codePoint = char.charCodeAt(0);
    if (codePoint >= HANGUL_SYLLABLE_BASE && codePoint <= HANGUL_SYLLABLE_LAST) {
      const initialIndex = Math.floor((codePoint - HANGUL_SYLLABLE_BASE) / HANGUL_INITIAL_CYCLE);
      initials += HANGUL_INITIALS[initialIndex] ?? '';
      continue;
    }
    if (HANGUL_CONSONANT_QUERY_REGEX.test(char)) {
      initials += char;
    }
  }

  return initials;
}

function isHangulConsonantQuery(query: string): boolean {
  return query.length > 0 && HANGUL_CONSONANT_QUERY_REGEX.test(query);
}

function matchesAliasSearchQuery(source: string, normalizedQuery: string, consonantQuery: string): boolean {
  const normalizedSource = normalizeAliasKey(source);
  if (normalizedSource.includes(normalizedQuery)) return true;
  if (!isHangulConsonantQuery(consonantQuery)) return false;
  return extractHangulInitials(source).includes(consonantQuery);
}

function getMatchingAliases(query: string): AliasPopupTarget[] {
  const normalizedQuery = normalizeAliasKey(query);
  if (!normalizedQuery) {
    return groupedAliases.slice(0, SUGGESTION_LIMIT);
  }
  const consonantQuery = normalizedQuery.replace(/\s+/g, '');
  return groupedAliases
    .filter((target) =>
      target.aliases.some((alias) => matchesAliasSearchQuery(alias, normalizedQuery, consonantQuery))
    )
    .slice(0, SUGGESTION_LIMIT);
}

function extractAliasTokenContext(textarea: HTMLTextAreaElement): AliasTokenContext | null {
  const caretPosition = textarea.selectionStart ?? textarea.value.length;
  const textBeforeCaret = textarea.value.slice(0, caretPosition);
  const tokenMatch = textBeforeCaret.match(/(?:^|\s)@([^\s@]{0,40})$/);
  if (!tokenMatch) return null;

  const query = tokenMatch[1];
  const start = caretPosition - query.length - 1;
  return { query, start, end: caretPosition };
}

function ensurePopup(): void {
  if (popupElement && popupListElement && popupPreviewElement) return;

  popupElement = document.createElement('div');
  popupElement.className = POPUP_CLASS_NAME;
  popupElement.style.display = 'none';
  popupElement.setAttribute('role', 'listbox');
  popupElement.setAttribute('aria-label', '디시콘 별칭 추천');

  popupListElement = document.createElement('ul');
  popupListElement.className = POPUP_LIST_CLASS_NAME;
  popupElement.appendChild(popupListElement);

  popupPreviewElement = document.createElement('div');
  popupPreviewElement.className = POPUP_PREVIEW_CLASS_NAME;
  popupPreviewElement.style.display = 'none';
  popupPreviewElement.setAttribute('aria-live', 'polite');
  popupElement.appendChild(popupPreviewElement);

  popupElement.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  popupElement.addEventListener('click', (event) => {
    if (!activeSuggestionState) return;
    const target = event.target as HTMLElement;
    const itemButton = target.closest<HTMLButtonElement>('button[data-index]');
    if (!itemButton) return;

    const index = Number(itemButton.dataset.index);
    if (!Number.isFinite(index)) return;
    void confirmSuggestionSelection(index);
  });

  popupElement.addEventListener('contextmenu', (event) => {
    if (!dcconAliasEnabled || event.shiftKey || !activeSuggestionState) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const itemButton = target.closest<HTMLButtonElement>('button[data-index]');
    if (!itemButton) return;

    const index = Number(itemButton.dataset.index);
    if (!Number.isFinite(index)) return;

    const matchedTarget = activeSuggestionState.matches[index];
    if (!matchedTarget) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openAliasEditPrompt(
      {
        packageIdx: matchedTarget.packageIdx,
        detailIdx: matchedTarget.detailIdx,
        title: matchedTarget.title,
        imageUrl: matchedTarget.imageUrl,
      },
      matchedTarget.aliases
    );
  });

  document.body.appendChild(popupElement);
}

function updatePopupAliasPreview(index: number | null): void {
  if (!popupPreviewElement) return;

  if (!activeSuggestionState || index === null) {
    popupPreviewElement.style.display = 'none';
    popupPreviewElement.textContent = '';
    return;
  }

  const matchedTarget = activeSuggestionState.matches[index];
  if (!matchedTarget) {
    popupPreviewElement.style.display = 'none';
    popupPreviewElement.textContent = '';
    return;
  }

  popupPreviewElement.textContent = `별칭: ${matchedTarget.aliases.map((alias) => `@${alias}`).join(', ')}`;
  popupPreviewElement.style.display = 'block';
}

function hideSuggestions(): void {
  activeSuggestionState = null;
  updatePopupAliasPreview(null);
  if (popupElement) {
    popupElement.style.display = 'none';
  }
}

function renderSuggestions(): void {
  if (!popupElement || !popupListElement || !activeSuggestionState) {
    hideSuggestions();
    return;
  }

  const state = activeSuggestionState;
  const listElement = popupListElement;
  listElement.innerHTML = '';

  state.matches.forEach((target, index) => {
    const li = document.createElement('li');
    li.className = POPUP_CELL_CLASS_NAME;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.index = String(index);
    button.className =
      index === state.selectedIndex
        ? `${POPUP_BUTTON_CLASS_NAME} ${POPUP_BUTTON_SELECTED_CLASS_NAME}`
        : POPUP_BUTTON_CLASS_NAME;

    const aliasTooltip = target.aliases.map((alias) => `@${alias}`).join(', ');
    button.setAttribute('aria-label', aliasTooltip);

    if (target.imageUrl) {
      const img = document.createElement('img');
      img.src = target.imageUrl;
      img.alt = target.alias;
      img.loading = 'lazy';
      button.appendChild(img);
    }

    const aliasText = document.createElement('span');
    aliasText.className = 'dc-shortcut-dccon-popup-alias';
    aliasText.textContent = `@${target.alias}`;
    button.appendChild(aliasText);
    li.appendChild(button);
    listElement.appendChild(li);
  });

  listElement.onmouseover = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const itemButton = target.closest<HTMLButtonElement>('button[data-index]');
    if (!itemButton) return;
    const index = Number(itemButton.dataset.index);
    if (!Number.isFinite(index)) return;
    updatePopupAliasPreview(index);
  };

  listElement.onmouseleave = (): void => {
    if (!activeSuggestionState) return;
    updatePopupAliasPreview(activeSuggestionState.selectedIndex);
  };

  popupElement.style.display = 'block';
  updatePopupAliasPreview(state.selectedIndex);
  schedulePopupReposition();
  ensureSelectedSuggestionVisible();
}

function ensureSelectedSuggestionVisible(): void {
  if (!popupListElement || !activeSuggestionState) return;

  const selectedButton = popupListElement.querySelector<HTMLButtonElement>(
    `button[data-index="${activeSuggestionState.selectedIndex}"]`
  );
  if (!selectedButton) return;
  selectedButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function schedulePopupReposition(): void {
  if (repositionRafId !== null) return;
  repositionRafId = window.requestAnimationFrame(() => {
    repositionRafId = null;
    repositionPopup();
  });
}

function repositionPopup(): void {
  if (!popupElement || !activeSuggestionState) return;

  const textareaRect = activeSuggestionState.textarea.getBoundingClientRect();
  if (textareaRect.width === 0 && textareaRect.height === 0) {
    hideSuggestions();
    return;
  }

  const popupWidth = Math.min(Math.max(textareaRect.width, 390), 560);
  popupElement.style.width = `${popupWidth}px`;

  const popupHeight = popupElement.offsetHeight || 160;
  const spacing = 8;
  let top = textareaRect.top - popupHeight - spacing;
  if (top < spacing) {
    top = textareaRect.bottom + spacing;
  }

  let left = textareaRect.left;
  if (left + popupWidth > window.innerWidth - spacing) {
    left = window.innerWidth - popupWidth - spacing;
  }
  left = Math.max(spacing, left);

  popupElement.style.left = `${left}px`;
  popupElement.style.top = `${Math.max(spacing, top)}px`;
}

function updateSuggestionsForTextarea(textarea: HTMLTextAreaElement): void {
  if (!dcconAliasEnabled || groupedAliases.length === 0) {
    hideSuggestions();
    return;
  }

  const tokenContext = extractAliasTokenContext(textarea);
  if (!tokenContext) {
    hideSuggestions();
    return;
  }

  const matches = getMatchingAliases(tokenContext.query);
  if (matches.length === 0) {
    hideSuggestions();
    return;
  }

  const previousTarget = activeSuggestionState?.matches[activeSuggestionState.selectedIndex] ?? null;
  let selectedIndex = 0;
  if (previousTarget) {
    const foundIndex = matches.findIndex((target) => aliasIdentity(target) === aliasIdentity(previousTarget));
    if (foundIndex >= 0) selectedIndex = foundIndex;
  }

  activeSuggestionState = {
    textarea,
    token: tokenContext,
    matches,
    selectedIndex,
  };
  renderSuggestions();
}

function moveSuggestionSelection(step: number): void {
  if (!activeSuggestionState || activeSuggestionState.matches.length === 0) return;
  const size = activeSuggestionState.matches.length;
  const nextIndex = (activeSuggestionState.selectedIndex + step + size) % size;
  activeSuggestionState.selectedIndex = nextIndex;
  renderSuggestions();
}

function moveSuggestionSelectionByRow(stepRows: number): void {
  if (!activeSuggestionState || activeSuggestionState.matches.length === 0) return;

  const size = activeSuggestionState.matches.length;
  const columnCount = Math.max(1, POPUP_GRID_COLUMN_COUNT);
  const rowCount = Math.ceil(size / columnCount);
  const currentIndex = activeSuggestionState.selectedIndex;
  const currentColumn = currentIndex % columnCount;
  const currentRow = Math.floor(currentIndex / columnCount);

  let nextRow = (currentRow + stepRows) % rowCount;
  if (nextRow < 0) nextRow += rowCount;

  const nextIndex = Math.min(size - 1, nextRow * columnCount + currentColumn);
  activeSuggestionState.selectedIndex = nextIndex;
  renderSuggestions();
}

function refreshCommentList(textarea: HTMLTextAreaElement): void {
  const nearestCommentWrap = textarea.closest(
    '.view_comment, .comment_wrap, .cmt_write_box, .cmt_write, .comment_box'
  );
  const refreshButton =
    nearestCommentWrap?.querySelector<HTMLButtonElement>('button.btn_cmt_refresh') ??
    document.querySelector<HTMLButtonElement>('button.btn_cmt_refresh');

  if (refreshButton) {
    refreshButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return;
  }

  const globalWindow = window as unknown as Record<string, unknown>;
  const fallbackFunctions = ['comment_list', 'comment_reple', 'get_comment'];
  for (const functionName of fallbackFunctions) {
    const candidate = globalWindow[functionName];
    if (typeof candidate !== 'function') continue;
    try {
      (candidate as () => void)();
      return;
    } catch (error) {
      console.error(`[DcconAlias] fallback comment refresh 함수 호출 실패: ${functionName}`, error);
    }
  }
}

function readNamedValue(name: string, form: HTMLFormElement | null): string {
  const readFromNamedItem = (
    item: Element | RadioNodeList | null | undefined
  ): string => {
    if (!item) return '';
    if (item instanceof RadioNodeList) {
      return item.value ?? '';
    }
    if (item instanceof HTMLInputElement) {
      if (item.type === 'checkbox') {
        return item.checked ? item.value || 'on' : '';
      }
      return item.value ?? '';
    }
    if (item instanceof HTMLTextAreaElement || item instanceof HTMLSelectElement) {
      return item.value ?? '';
    }
    return '';
  };

  const fromForm = readFromNamedItem(form?.elements.namedItem(name));
  if (fromForm) return fromForm;

  const fromDocument = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[name="${name}"]`
  );
  if (!fromDocument) return '';
  if (fromDocument instanceof HTMLInputElement && fromDocument.type === 'checkbox') {
    return fromDocument.checked ? fromDocument.value || 'on' : '';
  }
  return fromDocument.value ?? '';
}

function readArticleNoFallback(textarea: HTMLTextAreaElement): string {
  const fromButton = textarea
    .closest('.cmt_write, .cmt_write_box, .comment_box')
    ?.querySelector<HTMLButtonElement>('button.repley_add[data-no]')
    ?.getAttribute('data-no');
  if (fromButton) return fromButton;

  const fromGlobalButton = document
    .querySelector<HTMLButtonElement>('button.repley_add[data-no]')
    ?.getAttribute('data-no');
  if (fromGlobalButton) return fromGlobalButton;

  return '';
}

function firstNonEmptyValue(values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = safeTrim(value);
    if (trimmed) return trimmed;
  }
  return '';
}

function readAttributeValue(element: Element | null, attributeName: string): string {
  return safeTrim(element?.getAttribute(attributeName));
}

function readReplyContext(
  textarea: HTMLTextAreaElement
): {
  cNo: string;
  replyNo: string;
} {
  const writeBox = textarea.closest<HTMLElement>('.cmt_write_box');
  const submitButton = writeBox?.querySelector<HTMLButtonElement>('button.repley_add') ?? null;
  const dcconButton = writeBox?.querySelector<HTMLButtonElement>('button.tx_dccon') ?? null;
  const replyList = textarea.closest<HTMLElement>('ul.reply_list[p-no], ul.reply_list[id^="reply_list_"]');
  const memoNo = textarea.id.match(/^memo_(\d+)$/)?.[1] ?? '';

  const explicitReplyMarker = firstNonEmptyValue([
    readAttributeValue(writeBox, 'reply_no'),
    readAttributeValue(submitButton, 'reply_no'),
    readAttributeValue(dcconButton, 'reply_no'),
    readAttributeValue(submitButton, 'r_idx'),
    readAttributeValue(dcconButton, 'r_idx'),
    readAttributeValue(replyList, 'p-no'),
  ]);

  if (!explicitReplyMarker) {
    return { cNo: '', replyNo: '' };
  }

  const replyNo = firstNonEmptyValue([
    readAttributeValue(writeBox, 'reply_no'),
    readAttributeValue(submitButton, 'reply_no'),
    readAttributeValue(dcconButton, 'reply_no'),
    readAttributeValue(submitButton, 'r_idx'),
    readAttributeValue(dcconButton, 'r_idx'),
    readAttributeValue(replyList, 'p-no'),
    memoNo,
    readAttributeValue(writeBox, 'data-no'),
  ]);

  const cNo = firstNonEmptyValue([
    readAttributeValue(writeBox, 'c_no'),
    readAttributeValue(submitButton, 'c_no'),
    readAttributeValue(dcconButton, 'c_no'),
    readAttributeValue(writeBox, 'data-no'),
    readAttributeValue(replyList, 'p-no'),
    replyNo,
  ]);

  return { cNo, replyNo };
}

async function requestInsertIcon(
  textarea: HTMLTextAreaElement,
  selectedTarget: AliasPopupTarget
): Promise<boolean> {
  const form = textarea.closest('form');
  const currentUrl = new URL(window.location.href);

  const id = readNamedValue('id', form) || currentUrl.searchParams.get('id') || '';
  const no =
    readNamedValue('no', form) ||
    currentUrl.searchParams.get('no') ||
    readArticleNoFallback(textarea);

  if (!id || !no) {
    UI.showAlert('댓글 대상 게시글 정보를 찾지 못했습니다.');
    return false;
  }

  const doubleConCheckbox = document.querySelector<HTMLInputElement>('#double_dcon');
  const doubleConFallback = doubleConCheckbox?.checked ? doubleConCheckbox.value || 'on' : '';

  const payload: Record<string, string> = {
    id,
    no,
    package_idx: selectedTarget.packageIdx,
    detail_idx: selectedTarget.detailIdx,
    double_con_chk: readNamedValue('double_con_chk', form) || doubleConFallback,
    name: readNamedValue('name', form),
    password: readNamedValue('password', form),
    ci_t: readNamedValue('ci_t', form),
    input_type: readNamedValue('input_type', form) || 'comment',
    t_vch2: readNamedValue('t_vch2', form),
    t_vch2_chk: readNamedValue('t_vch2_chk', form),
    c_gall_id: readNamedValue('c_gall_id', form) || id,
    c_gall_no: readNamedValue('c_gall_no', form) || no,
    'g-recaptcha-response': readNamedValue('g-recaptcha-response', form),
    check_6: readNamedValue('check_6', form),
    check_7: readNamedValue('check_7', form),
    check_8: readNamedValue('check_8', form),
    _GALLTYPE_: readNamedValue('_GALLTYPE_', form),
    gall_nick_name: readNamedValue('gall_nick_name', form),
    use_gall_nick: readNamedValue('use_gall_nick', form),
  };

  const { cNo, replyNo } = readReplyContext(textarea);
  if (cNo) {
    payload.c_no = cNo;
  }
  if (replyNo) {
    payload.reply_no = replyNo;
  }

  try {
    const response = await fetch('/dccon/insert_icon', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams(payload).toString(),
    });

    const responseText = (await response.text()).trim().toLowerCase();
    if (!response.ok || !responseText.includes('ok')) {
      UI.showAlert('디시콘 등록 요청이 실패했습니다.');
      return false;
    }
    return true;
  } catch (error) {
    console.error('[DcconAlias] insert_icon 요청 실패:', error);
    UI.showAlert('디시콘 등록 요청 중 오류가 발생했습니다.');
    return false;
  }
}

async function confirmSuggestionSelection(index: number): Promise<void> {
  const stateSnapshot = activeSuggestionState;
  if (!stateSnapshot) return;

  const selectedTarget = stateSnapshot.matches[index];
  if (!selectedTarget) return;

  hideSuggestions();

  const inserted = await requestInsertIcon(stateSnapshot.textarea, selectedTarget);
  if (!inserted) return;

  if (stateSnapshot.textarea.value.trim().length > 0) {
    stateSnapshot.textarea.value = '';
    stateSnapshot.textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  refreshCommentList(stateSnapshot.textarea);
}

function removeTargetFromAliasMap(packageIdx: string, detailIdx: string): void {
  for (const key of Object.keys(aliasMap)) {
    const filteredTargets = aliasMap[key].filter(
      (target) => !(target.packageIdx === packageIdx && target.detailIdx === detailIdx)
    );
    if (filteredTargets.length > 0) {
      aliasMap[key] = filteredTargets;
    } else {
      delete aliasMap[key];
    }
  }
}

async function setAliasesForTarget(
  aliases: string[],
  targetInfo: AliasEditableTargetInfo
): Promise<void> {
  removeTargetFromAliasMap(targetInfo.packageIdx, targetInfo.detailIdx);

  const baseTime = Date.now();
  aliases.forEach((alias, index) => {
    const normalizedAlias = normalizeAliasKey(alias);
    if (!normalizedAlias) return;

    const nextTarget: DcconAliasTarget = {
      alias,
      packageIdx: targetInfo.packageIdx,
      detailIdx: targetInfo.detailIdx,
      title: targetInfo.title,
      imageUrl: targetInfo.imageUrl,
      updatedAt: baseTime + index,
    };

    const targets = aliasMap[normalizedAlias] ?? [];
    const existingIndex = targets.findIndex(
      (target) =>
        target.packageIdx === targetInfo.packageIdx && target.detailIdx === targetInfo.detailIdx
    );
    if (existingIndex >= 0) {
      targets[existingIndex] = nextTarget;
    } else {
      targets.unshift(nextTarget);
    }
    aliasMap[normalizedAlias] = targets;
  });

  await persistAliasMap();
}

function openAliasEditPrompt(
  targetInfo: AliasEditableTargetInfo,
  existingAliasesFromPopup?: string[]
): void {
  const existingAliases =
    existingAliasesFromPopup && existingAliasesFromPopup.length > 0
      ? [...existingAliasesFromPopup]
      : getAliasesByTarget(targetInfo.packageIdx, targetInfo.detailIdx);

  const suggestedAliasInput =
    existingAliases.length > 0 ? existingAliases.join(', ') : targetInfo.title?.trim() || '';

  const promptMessage =
    '디시콘 별칭을 입력하세요. 쉼표(,)로 여러 개 등록 가능\n(@ 없이, 공백 불가, 별칭당 최대 5자)\nShift+우클릭은 기본 컨텍스트 메뉴를 엽니다.';
  const userInput = window.prompt(promptMessage, suggestedAliasInput);
  if (userInput === null) return;

  const aliases = parseAliasListInput(userInput);
  if (aliases.length === 0) {
    UI.showAlert('별칭은 공백 없이 별칭당 최대 5자로 입력해주세요. 예: 안녕, ㅎㅇ');
    return;
  }

  void (async () => {
    await setAliasesForTarget(aliases, targetInfo);
    UI.showAlert(`디시콘 별칭 저장 완료: ${aliases.map((alias) => `@${alias}`).join(', ')}`);
  })();
}

function handleContextMenu(event: MouseEvent): void {
  if (!dcconAliasEnabled || event.shiftKey) return;

  const target = event.target as HTMLElement | null;
  const dcconButton = target?.closest<HTMLButtonElement>('button.img_dccon[detail_idx][package_idx]');
  if (!dcconButton) return;

  const packageIdx = dcconButton.getAttribute('package_idx')?.trim() ?? '';
  const detailIdx = dcconButton.getAttribute('detail_idx')?.trim() ?? '';
  if (!packageIdx || !detailIdx) return;

  event.preventDefault();
  event.stopPropagation();

  const imageUrl = dcconButton.querySelector<HTMLImageElement>('img')?.src;
  const title = dcconButton.getAttribute('title')?.trim() || undefined;

  openAliasEditPrompt({
    packageIdx,
    detailIdx,
    title,
    imageUrl,
  });
}

function preventEventPropagation(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function handleKeydown(event: KeyboardEvent): void {
  if (!dcconAliasEnabled || !activeSuggestionState) return;
  if (event.isComposing) return;
  if (!isCommentTextarea(event.target as Element)) return;
  if (event.target !== activeSuggestionState.textarea) return;

  if (event.key === 'Tab') {
    preventEventPropagation(event);
    moveSuggestionSelection(event.shiftKey ? -1 : 1);
    return;
  }

  if (event.key === 'ArrowDown') {
    preventEventPropagation(event);
    moveSuggestionSelectionByRow(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    preventEventPropagation(event);
    moveSuggestionSelectionByRow(-1);
    return;
  }

  if (event.key === 'ArrowRight') {
    preventEventPropagation(event);
    moveSuggestionSelection(1);
    return;
  }

  if (event.key === 'ArrowLeft') {
    preventEventPropagation(event);
    moveSuggestionSelection(-1);
    return;
  }

  if (event.key === 'Enter') {
    preventEventPropagation(event);
    void confirmSuggestionSelection(activeSuggestionState.selectedIndex);
    return;
  }

  if (event.key === 'Escape') {
    preventEventPropagation(event);
    hideSuggestions();
  }
}

function handleInput(event: Event): void {
  if (!dcconAliasEnabled) {
    hideSuggestions();
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || !isCommentTextarea(target)) return;
  updateSuggestionsForTextarea(target);
}

function handleFocusIn(event: FocusEvent): void {
  if (!dcconAliasEnabled) {
    hideSuggestions();
    return;
  }

  const target = event.target;
  if (target instanceof HTMLTextAreaElement && isCommentTextarea(target)) {
    updateSuggestionsForTextarea(target);
    return;
  }
  hideSuggestions();
}

function handleDocumentMouseDown(event: MouseEvent): void {
  const target = event.target as Node | null;
  if (!target) return;
  if (popupElement?.contains(target)) return;
  if (activeSuggestionState?.textarea.contains(target)) return;
  hideSuggestions();
}

const DcconAlias = {
  init(): void {
    if (isInitialized) return;
    isInitialized = true;

    ensurePopup();
    void reloadAliasMap();
    void reloadAliasEnabledState();

    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('mousedown', handleDocumentMouseDown, true);
    window.addEventListener('scroll', scrollRepositionHandler, true);
    window.addEventListener('resize', scrollRepositionHandler);
    chrome.storage.onChanged.addListener(storageChangeListener);
  },
};

export default DcconAlias;
