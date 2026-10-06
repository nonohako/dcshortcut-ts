import type { DcconAliasMap, DcconAliasTarget } from '@/types';
import { DCCON_ALIAS_ENABLED_KEY, DCCON_ALIAS_MAP_KEY } from './Global';
import Storage from './Storage';
import UI from './UI';

interface AliasTokenContext {
  query: string;
  start: number;
  end: number;
  range?: Range;
}

type AliasInputElement = HTMLTextAreaElement | HTMLDivElement;

interface AliasPopupTarget extends Omit<DcconAliasTarget, 'updatedAt'> {
  aliases: string[];
}

interface AliasSuggestionState {
  input: AliasInputElement;
  token: AliasTokenContext;
  matches: AliasPopupTarget[];
  selectedIndex: number;
}

interface AliasEditableTargetInfo {
  packageIdx: string;
  detailIdx: string;
  packageTitle?: string;
  title?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

interface DcconListPackage {
  packageIdx: string;
  title?: string;
  details: DcconListDetail[];
}

interface DcconListDetail {
  packageIdx: string;
  detailIdx: string;
  title?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  imageUrls: string[];
}

interface DcconListPage {
  packages: DcconListPackage[];
  maxPage: number;
}

interface RuntimeDcconIndex {
  byMediaIdentity: Map<string, AliasEditableTargetInfo>;
  byTargetId: Map<string, AliasEditableTargetInfo>;
  byPackageAndDetailTitle: Map<string, AliasEditableTargetInfo>;
  byPackageTitleAndDetailTitle: Map<string, AliasEditableTargetInfo>;
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
let runtimeDcconIndexPromise: Promise<RuntimeDcconIndex | null> | null = null;

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
    const activeInput = getAliasInput(document.activeElement);
    if (activeInput) updateSuggestionsForInput(activeInput);
  }
};

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDcconMediaUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl, window.location.href);
    url.hash = '';
    return url.href;
  } catch {
    return rawUrl.trim();
  }
}

function getDcconMediaIdentity(rawUrl: string | undefined): string {
  const normalizedUrl = normalizeDcconMediaUrl(rawUrl);
  if (!normalizedUrl) return '';

  try {
    const url = new URL(normalizedUrl);
    const mediaNo = url.pathname.endsWith('/dccon.php') ? url.searchParams.get('no') : '';
    return mediaNo ? `dccon:${mediaNo}` : normalizedUrl;
  } catch {
    return normalizedUrl;
  }
}

function getDcconTargetId(packageIdx: string, detailIdx: string): string {
  return `${packageIdx.trim()}:${detailIdx.trim()}`;
}

function getDcconTitleIdentity(value: string | undefined): string {
  return safeTrim(value).toLocaleLowerCase();
}

function getPackageAndDetailTitleIdentity(
  packageIdentity: string | undefined,
  detailTitle: string | undefined
): string {
  const normalizedPackage = getDcconTitleIdentity(packageIdentity);
  const normalizedDetail = getDcconTitleIdentity(detailTitle);
  return normalizedPackage && normalizedDetail ? `${normalizedPackage}\u0000${normalizedDetail}` : '';
}

function areDcconTargetsSame(
  left: AliasEditableTargetInfo,
  right: AliasEditableTargetInfo
): boolean {
  if (
    getDcconTargetId(left.packageIdx, left.detailIdx) ===
    getDcconTargetId(right.packageIdx, right.detailIdx)
  ) {
    return true;
  }

  const leftMediaIdentity = getDcconMediaIdentity(left.imageUrl);
  const rightMediaIdentity = getDcconMediaIdentity(right.imageUrl);
  return Boolean(leftMediaIdentity && leftMediaIdentity === rightMediaIdentity);
}

function normalizeDcconIndexValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function parseDcconListPage(value: unknown): DcconListPage | null {
  if (!value || typeof value !== 'object') return null;

  const payload = value as Record<string, unknown>;
  if (!Array.isArray(payload.list)) return null;

  const packages: DcconListPackage[] = [];
  payload.list.forEach((rawPackage) => {
    if (!rawPackage || typeof rawPackage !== 'object') return;

    const packagePayload = rawPackage as Record<string, unknown>;
    const packageIdx = normalizeDcconIndexValue(packagePayload.package_idx);
    if (!packageIdx || !Array.isArray(packagePayload.detail)) return;

    const details: DcconListDetail[] = [];
    packagePayload.detail.forEach((rawDetail) => {
      if (!rawDetail || typeof rawDetail !== 'object') return;

      const detailPayload = rawDetail as Record<string, unknown>;
      const detailIdx = normalizeDcconIndexValue(detailPayload.detail_idx);
      if (!detailIdx) return;

      const detailPackageIdx = normalizeDcconIndexValue(detailPayload.package_idx) || packageIdx;
      const imageUrl = normalizeDcconMediaUrl(
        safeTrim(detailPayload.video_src) || safeTrim(detailPayload.list_img)
      );
      const thumbnailUrl = normalizeDcconMediaUrl(
        safeTrim(detailPayload.list_img) || safeTrim(detailPayload.video_src)
      );
      const imageUrls = [imageUrl, thumbnailUrl]
        .map(normalizeDcconMediaUrl)
        .filter(Boolean);

      details.push({
        packageIdx: detailPackageIdx,
        detailIdx,
        title: safeTrim(detailPayload.title) || undefined,
        imageUrl: imageUrl || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        imageUrls: Array.from(new Set(imageUrls)),
      });
    });

    packages.push({
      packageIdx,
      title: safeTrim(packagePayload.title) || undefined,
      details,
    });
  });

  const rawMaxPage = Number(payload.max_page);
  return {
    packages,
    maxPage: Number.isInteger(rawMaxPage) && rawMaxPage >= 0 ? rawMaxPage : 0,
  };
}

async function fetchDcconListPage(page: number): Promise<DcconListPage | null> {
  const response = await fetch(new URL('/dccon/lists', window.location.origin), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: new URLSearchParams({
      target: 'icon',
      page: String(page),
    }).toString(),
  });
  if (!response.ok) return null;

  const responseText = await response.text();
  if (!responseText.trim().startsWith('{')) return null;

  try {
    return parseDcconListPage(JSON.parse(responseText));
  } catch {
    return null;
  }
}

async function loadRuntimeDcconIndex(): Promise<RuntimeDcconIndex | null> {
  const firstPage = await fetchDcconListPage(0);
  if (!firstPage) return null;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.maxPage }, (_, index) => fetchDcconListPage(index + 1))
  );
  const pages = [firstPage, ...remainingPages.filter((page): page is DcconListPage => Boolean(page))];
  const byMediaIdentity = new Map<string, AliasEditableTargetInfo>();
  const byTargetId = new Map<string, AliasEditableTargetInfo>();
  const byPackageAndDetailTitle = new Map<string, AliasEditableTargetInfo>();
  const byPackageTitleAndDetailTitle = new Map<string, AliasEditableTargetInfo>();

  pages.forEach((page) => {
    page.packages.forEach((dcconPackage) => {
      dcconPackage.details.forEach((detail) => {
        const target: AliasEditableTargetInfo = {
          packageIdx: detail.packageIdx,
          detailIdx: detail.detailIdx,
          packageTitle: dcconPackage.title,
          title: detail.title || dcconPackage.title,
          imageUrl: detail.imageUrl,
          thumbnailUrl: detail.thumbnailUrl,
        };
        byTargetId.set(getDcconTargetId(target.packageIdx, target.detailIdx), target);
        const packageIdAndTitle = getPackageAndDetailTitleIdentity(
          target.packageIdx,
          target.title
        );
        if (packageIdAndTitle && !byPackageAndDetailTitle.has(packageIdAndTitle)) {
          byPackageAndDetailTitle.set(packageIdAndTitle, target);
        }
        const packageTitleAndDetailTitle = getPackageAndDetailTitleIdentity(
          target.packageTitle,
          target.title
        );
        if (
          packageTitleAndDetailTitle &&
          !byPackageTitleAndDetailTitle.has(packageTitleAndDetailTitle)
        ) {
          byPackageTitleAndDetailTitle.set(packageTitleAndDetailTitle, target);
        }
        detail.imageUrls.forEach((imageUrl) => {
          const mediaIdentity = getDcconMediaIdentity(imageUrl);
          if (mediaIdentity && !byMediaIdentity.has(mediaIdentity)) {
            byMediaIdentity.set(mediaIdentity, target);
          }
        });
      });
    });
  });

  return {
    byMediaIdentity,
    byTargetId,
    byPackageAndDetailTitle,
    byPackageTitleAndDetailTitle,
  };
}

function getRuntimeDcconIndex(): Promise<RuntimeDcconIndex | null> {
  if (runtimeDcconIndexPromise) return runtimeDcconIndexPromise;

  runtimeDcconIndexPromise = loadRuntimeDcconIndex().catch((error) => {
    console.warn('[DcconAlias] 현재 계정 디시콘 목록 조회 실패:', error);
    runtimeDcconIndexPromise = null;
    return null;
  });
  return runtimeDcconIndexPromise;
}

async function resolveCurrentDcconTarget(
  selectedTarget: AliasPopupTarget
): Promise<AliasPopupTarget> {
  const mediaIdentity = getDcconMediaIdentity(selectedTarget.imageUrl);
  const runtimeIndex = await getRuntimeDcconIndex();
  const resolvedTarget =
    (mediaIdentity ? runtimeIndex?.byMediaIdentity.get(mediaIdentity) : undefined) ??
    runtimeIndex?.byTargetId.get(
      getDcconTargetId(selectedTarget.packageIdx, selectedTarget.detailIdx)
    ) ??
    runtimeIndex?.byPackageAndDetailTitle.get(
      getPackageAndDetailTitleIdentity(selectedTarget.packageIdx, selectedTarget.title)
    ) ??
    runtimeIndex?.byPackageTitleAndDetailTitle.get(
      getPackageAndDetailTitleIdentity(selectedTarget.packageTitle, selectedTarget.title)
    );
  if (!resolvedTarget) return selectedTarget;

  const currentTarget: AliasPopupTarget = {
    ...selectedTarget,
    packageIdx: resolvedTarget.packageIdx,
    detailIdx: resolvedTarget.detailIdx,
    packageTitle: resolvedTarget.packageTitle || selectedTarget.packageTitle,
    title: resolvedTarget.title || selectedTarget.title,
    imageUrl: resolvedTarget.imageUrl || selectedTarget.imageUrl,
    thumbnailUrl: resolvedTarget.thumbnailUrl || selectedTarget.thumbnailUrl,
  };
  if (
    selectedTarget.packageIdx !== currentTarget.packageIdx ||
    selectedTarget.detailIdx !== currentTarget.detailIdx ||
    selectedTarget.packageTitle !== currentTarget.packageTitle ||
    selectedTarget.imageUrl !== currentTarget.imageUrl ||
    selectedTarget.thumbnailUrl !== currentTarget.thumbnailUrl
  ) {
    void refreshStoredDcconTarget(selectedTarget, currentTarget);
  }
  return currentTarget;
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

function rebuildGroupedAliases(): void {
  interface AliasGroupDraft {
    packageIdx: string;
    detailIdx: string;
    packageTitle?: string;
    title?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    aliasEntries: Array<{ alias: string; updatedAt: number }>;
  }

  const groups: AliasGroupDraft[] = [];

  Object.values(aliasMap).forEach((targets) => {
    targets.forEach((target) => {
      const draft = groups.find((group) => areDcconTargetsSame(group, target)) ?? {
        packageIdx: target.packageIdx,
        detailIdx: target.detailIdx,
        packageTitle: target.packageTitle,
        title: target.title,
        imageUrl: target.imageUrl,
        thumbnailUrl: target.thumbnailUrl,
        aliasEntries: [],
      };

      draft.aliasEntries.push({
        alias: target.alias,
        updatedAt: Number.isFinite(target.updatedAt) ? target.updatedAt : Date.now(),
      });
      if (!draft.title && target.title) draft.title = target.title;
      if (!draft.packageTitle && target.packageTitle) draft.packageTitle = target.packageTitle;
      if (!draft.imageUrl && target.imageUrl) draft.imageUrl = target.imageUrl;
      if (!draft.thumbnailUrl && target.thumbnailUrl) draft.thumbnailUrl = target.thumbnailUrl;

      if (!groups.includes(draft)) groups.push(draft);
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
      packageTitle: draft.packageTitle,
      title: draft.title,
      imageUrl: draft.imageUrl,
      thumbnailUrl: draft.thumbnailUrl,
    });
  });

  groupedAliases = nextGroupedAliases.sort(comparePopupTargets);
}

async function reloadAliasMap(): Promise<void> {
  aliasMap = await Storage.getDcconAliasMap();
  rebuildGroupedAliases();
  if (!activeSuggestionState || !dcconAliasEnabled) return;
  updateSuggestionsForInput(activeSuggestionState.input);
}

async function reloadAliasEnabledState(): Promise<void> {
  dcconAliasEnabled = await Storage.getDcconAliasEnabled();
  if (!dcconAliasEnabled) {
    hideSuggestions();
    return;
  }
  const activeInput = getAliasInput(document.activeElement);
  if (activeInput) updateSuggestionsForInput(activeInput);
}

async function persistAliasMap(): Promise<void> {
  await Storage.saveDcconAliasMap(aliasMap);
  rebuildGroupedAliases();
}

async function refreshStoredDcconTarget(
  previousTarget: AliasEditableTargetInfo,
  currentTarget: AliasEditableTargetInfo
): Promise<void> {
  let changed = false;
  Object.keys(aliasMap).forEach((aliasKey) => {
    aliasMap[aliasKey] = aliasMap[aliasKey].map((target) => {
      if (!areDcconTargetsSame(target, previousTarget)) return target;

      changed = true;
      return {
        ...target,
        packageIdx: currentTarget.packageIdx,
        detailIdx: currentTarget.detailIdx,
        packageTitle: currentTarget.packageTitle || target.packageTitle,
        title: currentTarget.title || target.title,
        imageUrl: currentTarget.imageUrl || target.imageUrl,
        thumbnailUrl: currentTarget.thumbnailUrl || target.thumbnailUrl,
      };
    });
  });
  if (changed) await persistAliasMap();
}

function isCommentTextarea(element: Element | null): element is HTMLTextAreaElement {
  if (
    window.location.pathname.includes('/board/write/') &&
    element instanceof HTMLTextAreaElement &&
    element.id === 'memo'
  ) {
    return false;
  }
  return (
    element instanceof HTMLTextAreaElement &&
    element.matches('textarea[id^="memo_"], textarea[name="memo"], .cmt_write_box textarea')
  );
}

function isWriteEditor(element: Element | null): element is HTMLDivElement {
  return (
    element instanceof HTMLDivElement &&
    element.matches('.note-editable[contenteditable="true"]') &&
    window.location.pathname.includes('/board/write/')
  );
}

function getAliasInput(target: EventTarget | null): AliasInputElement | null {
  if (!(target instanceof Element)) return null;
  if (isCommentTextarea(target) || isWriteEditor(target)) return target;
  return null;
}

function getAliasesByTarget(
  packageIdx: string,
  detailIdx: string,
  imageUrl?: string
): string[] {
  const targetInfo = { packageIdx, detailIdx, imageUrl };
  const groupedMatch = groupedAliases.find(
    (target) => areDcconTargetsSame(target, targetInfo)
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

function extractAliasTokenContext(input: AliasInputElement): AliasTokenContext | null {
  if (isWriteEditor(input)) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;

    const caretRange = selection.getRangeAt(0);
    if (!input.contains(caretRange.endContainer) || !(caretRange.endContainer instanceof Text)) {
      return null;
    }

    const caretPosition = caretRange.endOffset;
    const textBeforeCaret = caretRange.endContainer.data.slice(0, caretPosition);
    const tokenMatch = textBeforeCaret.match(/(?:^|\s)@([^\s@]{0,40})$/);
    if (!tokenMatch) return null;

    const query = tokenMatch[1];
    const start = caretPosition - query.length - 1;
    const tokenRange = document.createRange();
    tokenRange.setStart(caretRange.endContainer, start);
    tokenRange.setEnd(caretRange.endContainer, caretPosition);
    return { query, start, end: caretPosition, range: tokenRange };
  }

  const caretPosition = input.selectionStart ?? input.value.length;
  const textBeforeCaret = input.value.slice(0, caretPosition);
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
          thumbnailUrl: matchedTarget.thumbnailUrl,
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

    const thumbnailUrl = target.thumbnailUrl || target.imageUrl;
    if (thumbnailUrl) {
      const img = document.createElement('img');
      img.src = thumbnailUrl;
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

  const inputRect = activeSuggestionState.input.getBoundingClientRect();
  if (inputRect.width === 0 && inputRect.height === 0) {
    hideSuggestions();
    return;
  }

  const popupWidth = Math.min(Math.max(inputRect.width, 390), 560);
  popupElement.style.width = `${popupWidth}px`;

  const popupHeight = popupElement.offsetHeight || 160;
  const spacing = 8;
  const tokenRect = activeSuggestionState.token.range?.getBoundingClientRect();
  const anchorRect = tokenRect && (tokenRect.width > 0 || tokenRect.height > 0) ? tokenRect : inputRect;
  let top = anchorRect.top - popupHeight - spacing;
  if (top < spacing) {
    top = anchorRect.bottom + spacing;
  }

  let left = inputRect.left;
  if (left + popupWidth > window.innerWidth - spacing) {
    left = window.innerWidth - popupWidth - spacing;
  }
  left = Math.max(spacing, left);

  popupElement.style.left = `${left}px`;
  popupElement.style.top = `${Math.max(spacing, top)}px`;
}

function updateSuggestionsForInput(input: AliasInputElement): void {
  if (!dcconAliasEnabled || groupedAliases.length === 0) {
    hideSuggestions();
    return;
  }

  const tokenContext = extractAliasTokenContext(input);
  if (!tokenContext) {
    hideSuggestions();
    return;
  }

  void getRuntimeDcconIndex();

  const matches = getMatchingAliases(tokenContext.query);
  if (matches.length === 0) {
    hideSuggestions();
    return;
  }

  const previousTarget = activeSuggestionState?.matches[activeSuggestionState.selectedIndex] ?? null;
  let selectedIndex = 0;
  if (previousTarget) {
    const foundIndex = matches.findIndex((target) => areDcconTargetsSame(target, previousTarget));
    if (foundIndex >= 0) selectedIndex = foundIndex;
  }

  activeSuggestionState = {
    input,
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

function getDcconPackagePageSignature(root: HTMLElement): string {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>('button.dccon_btn[package_idx]')
  )
    .map((button) => button.getAttribute('package_idx')?.trim() ?? '')
    .filter(Boolean)
    .join('|');
}

async function findDcconPackageButtonAcrossPages(
  root: HTMLElement,
  packageIdx: string
): Promise<HTMLButtonElement | null> {
  const packageSelector = `button.dccon_btn[package_idx="${CSS.escape(packageIdx)}"]`;
  const visitedPages = new Set<string>();

  while (true) {
    const packageButton = root.querySelector<HTMLButtonElement>(packageSelector);
    if (packageButton) return packageButton;

    const currentSignature = getDcconPackagePageSignature(root);
    if (!currentSignature || visitedPages.has(currentSignature)) return null;
    visitedPages.add(currentSignature);

    const nextButton = root.querySelector<HTMLButtonElement>('button.btn_dccon_next');
    if (!nextButton || nextButton.disabled) return null;

    nextButton.click();
    const changedPage = await waitForDcconElement(() => {
      const nextSignature = getDcconPackagePageSignature(root);
      if (!nextSignature || nextSignature === currentSignature) return null;
      return root.querySelector<HTMLElement>('.dccon_tab_btnbox') ?? nextButton;
    }, 4_000);
    if (!changedPage) return null;
  }
}

async function triggerNativeCommentDccon(
  textarea: HTMLTextAreaElement,
  selectedTarget: AliasPopupTarget
): Promise<boolean> {
  const writeBox = textarea.closest<HTMLElement>('.cmt_write_box');
  const guideBox = writeBox?.querySelector<HTMLElement>('.dccon_guidebox');
  const toggleButton = guideBox?.querySelector<HTMLButtonElement>('button.tx_dccon');
  if (!guideBox || !toggleButton) {
    UI.showAlert('댓글창의 디시콘 선택 영역을 찾지 못했습니다.');
    return false;
  }

  let panel = guideBox.querySelector<HTMLElement>('#div_con');
  if (!panel) {
    toggleButton.click();
    panel = await waitForDcconElement(() => guideBox.querySelector<HTMLElement>('#div_con'));
  }
  if (!panel) {
    UI.showAlert('댓글창의 디시콘 목록을 불러오지 못했습니다.');
    return false;
  }

  guideBox.querySelector('[data-dc-shortcut-alias-proxy]')?.remove();

  const targetButton = document.createElement('button');
  targetButton.type = 'button';
  targetButton.className = 'img_dccon';
  targetButton.hidden = true;
  targetButton.style.setProperty('display', 'none', 'important');
  targetButton.dataset.dcShortcutAliasProxy = 'true';
  targetButton.setAttribute('package_idx', selectedTarget.packageIdx);
  targetButton.setAttribute('detail_idx', selectedTarget.detailIdx);
  targetButton.title = selectedTarget.title?.trim() || selectedTarget.alias;
  const thumbnailUrl = selectedTarget.thumbnailUrl || selectedTarget.imageUrl;
  if (thumbnailUrl) {
    const image = document.createElement('img');
    image.src = thumbnailUrl;
    image.alt = targetButton.title;
    targetButton.appendChild(image);
  }
  panel.appendChild(targetButton);

  targetButton.click();
  window.setTimeout(() => targetButton.remove(), 0);
  return true;
}

function findWriteDcconDetailButton(
  root: HTMLElement,
  selectedTarget: AliasPopupTarget
): HTMLButtonElement | null {
  const packageIdx = CSS.escape(selectedTarget.packageIdx);
  const detailIdx = CSS.escape(selectedTarget.detailIdx);
  return root.querySelector<HTMLButtonElement>(
    `button.img_dccon[package_idx="${packageIdx}"][detail_idx="${detailIdx}"]`
  );
}

function waitForDcconElement<T extends Element>(
  findElement: () => T | null,
  timeoutMs: number = 4_000
): Promise<T | null> {
  const existingElement = findElement();
  if (existingElement) return Promise.resolve(existingElement);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (element: T | null): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve(element);
    };
    const observer = new MutationObserver(() => {
      const element = findElement();
      if (element) finish(element);
    });
    const timeoutId = window.setTimeout(() => finish(findElement()), timeoutMs);
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

async function resolveWriteDcconButton(
  editor: HTMLDivElement,
  selectedTarget: AliasPopupTarget
): Promise<HTMLButtonElement | null> {
  const editorFrame = editor.closest<HTMLElement>('.note-editor');
  if (!editorFrame) return null;

  const existingDetailButton = findWriteDcconDetailButton(editorFrame, selectedTarget);
  if (existingDetailButton) return existingDetailButton;

  const toolbarButton = editorFrame?.querySelector<HTMLButtonElement>(
    'button.note-btn[aria-label="디시콘"]'
  );

  if (!editorFrame.querySelector('.dccon_tab_btnbox') && toolbarButton) {
    toolbarButton.click();
    await waitForDcconElement(() =>
      editorFrame.querySelector<HTMLElement>('.dccon_tab_btnbox')
    );
  }

  const packageButton = await findDcconPackageButtonAcrossPages(
    editorFrame,
    selectedTarget.packageIdx
  );
  if (!packageButton) return null;

  packageButton.click();
  return waitForDcconElement(() =>
    findWriteDcconDetailButton(editorFrame, selectedTarget)
  );
}

function dispatchWriteEditorInput(
  editor: HTMLDivElement,
  inputType: 'deleteContentBackward' | 'insertImage' = 'deleteContentBackward'
): void {
  editor.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType,
    })
  );
}

interface WriteEditorTokenRemoval {
  range: Range;
  removedToken: string;
  selection: Selection;
}

function removeWriteEditorAliasToken(
  editor: HTMLDivElement,
  token: AliasTokenContext
): WriteEditorTokenRemoval | null {
  const tokenRange = token.range;
  if (
    !tokenRange ||
    !editor.contains(tokenRange.startContainer) ||
    !editor.contains(tokenRange.endContainer)
  ) {
    return null;
  }

  editor.focus();
  const selection = window.getSelection();
  if (!selection) return null;

  const removedToken = tokenRange.toString();
  tokenRange.deleteContents();
  tokenRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(tokenRange);
  return { range: tokenRange, removedToken, selection };
}

function restoreWriteEditorAliasToken(
  editor: HTMLDivElement,
  removal: WriteEditorTokenRemoval
): void {
  const recoveryText = document.createTextNode(removal.removedToken);
  removal.range.insertNode(recoveryText);
  removal.range.setStartAfter(recoveryText);
  removal.range.collapse(true);
  removal.selection.removeAllRanges();
  removal.selection.addRange(removal.range);
  dispatchWriteEditorInput(editor);
}

async function insertDcconIntoWriteEditor(
  editor: HTMLDivElement,
  token: AliasTokenContext,
  selectedTarget: AliasPopupTarget
): Promise<boolean> {
  if (!token.range || !editor.contains(token.range.startContainer)) {
    UI.showAlert('글쓰기 입력 위치를 찾지 못했습니다. @별칭을 다시 입력해주세요.');
    return false;
  }

  const editorFrame = editor.closest<HTMLElement>('.note-editor');
  const existingDetailButton = editorFrame
    ? findWriteDcconDetailButton(editorFrame, selectedTarget)
    : null;
  const detailButton = existingDetailButton ?? (await resolveWriteDcconButton(editor, selectedTarget));
  if (!detailButton) {
    UI.showAlert('글쓰기 페이지에서 해당 디시콘을 찾지 못했습니다.');
    return false;
  }

  const removal = removeWriteEditorAliasToken(editor, token);
  if (!removal) {
    UI.showAlert('글쓰기 입력 위치를 찾지 못했습니다. @별칭을 다시 입력해주세요.');
    return false;
  }
  dispatchWriteEditorInput(editor);

  // 원본 처리기가 /dccon/insert_icon 응답의 img_src로 삽입합니다.
  // 목록의 video_src를 img에 직접 넣으면 게시 후에도 깨진 이미지가 남습니다.
  const previousMedia = new Set(Array.from(editor.querySelectorAll('img.written_dccon, video.written_dccon')));
  detailButton.click();

  const insertedMedia = await waitForDcconElement(
    () => Array.from(editor.querySelectorAll('img.written_dccon, video.written_dccon'))
      .find((element) => !previousMedia.has(element)) ?? null,
    10_000
  );
  if (insertedMedia) return true;

  restoreWriteEditorAliasToken(editor, removal);
  UI.showAlert('글쓰기 본문에 디시콘을 삽입하지 못했습니다.');
  return false;
}

async function confirmSuggestionSelection(index: number): Promise<void> {
  const stateSnapshot = activeSuggestionState;
  if (!stateSnapshot) return;

  const selectedTarget = stateSnapshot.matches[index];
  if (!selectedTarget) return;

  hideSuggestions();
  const currentTarget = await resolveCurrentDcconTarget(selectedTarget);

  if (isWriteEditor(stateSnapshot.input)) {
    await insertDcconIntoWriteEditor(stateSnapshot.input, stateSnapshot.token, currentTarget);
    return;
  }

  const triggered = await triggerNativeCommentDccon(stateSnapshot.input, currentTarget);
  if (!triggered) return;

  if (stateSnapshot.input.value.trim().length > 0) {
    stateSnapshot.input.value = '';
    stateSnapshot.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

}

function removeTargetFromAliasMap(targetInfo: AliasEditableTargetInfo): void {
  for (const key of Object.keys(aliasMap)) {
    const filteredTargets = aliasMap[key].filter(
      (target) => !areDcconTargetsSame(target, targetInfo)
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
  removeTargetFromAliasMap(targetInfo);

  const baseTime = Date.now();
  aliases.forEach((alias, index) => {
    const normalizedAlias = normalizeAliasKey(alias);
    if (!normalizedAlias) return;

    const nextTarget: DcconAliasTarget = {
      alias,
      packageIdx: targetInfo.packageIdx,
      detailIdx: targetInfo.detailIdx,
      packageTitle: targetInfo.packageTitle,
      title: targetInfo.title,
      imageUrl: targetInfo.imageUrl,
      thumbnailUrl: targetInfo.thumbnailUrl,
      updatedAt: baseTime + index,
    };

    const targets = aliasMap[normalizedAlias] ?? [];
    const existingIndex = targets.findIndex(
      (target) => areDcconTargetsSame(target, targetInfo)
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
      : getAliasesByTarget(targetInfo.packageIdx, targetInfo.detailIdx, targetInfo.imageUrl);

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

  const previewImage = dcconButton.querySelector<HTMLImageElement>('img');
  const previewVideo = dcconButton.querySelector<HTMLVideoElement>('video');
  const imageUrl =
    previewVideo?.currentSrc ||
    previewVideo?.src ||
    previewVideo?.getAttribute('data-src') ||
    previewImage?.currentSrc ||
    previewImage?.src ||
    previewImage?.getAttribute('data-src') ||
    undefined;
  const thumbnailUrl =
    previewImage?.currentSrc ||
    previewImage?.src ||
    previewImage?.getAttribute('data-src') ||
    previewVideo?.poster ||
    imageUrl ||
    undefined;
  const title = dcconButton.getAttribute('title')?.trim() || undefined;
  const packageTitle = document
    .querySelector<HTMLButtonElement>(
      `button.dccon_btn[package_idx="${CSS.escape(packageIdx)}"]`
    )
    ?.getAttribute('title')
    ?.trim();

  openAliasEditPrompt({
    packageIdx,
    detailIdx,
    packageTitle: packageTitle || undefined,
    title,
    imageUrl,
    thumbnailUrl,
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
  const input = getAliasInput(event.target);
  if (!input || input !== activeSuggestionState.input) return;

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
  const input = getAliasInput(target);
  if (!input) return;
  updateSuggestionsForInput(input);
}

function handleFocusIn(event: FocusEvent): void {
  if (!dcconAliasEnabled) {
    hideSuggestions();
    return;
  }

  const target = event.target;
  const input = getAliasInput(target);
  if (input) {
    void getRuntimeDcconIndex();
    updateSuggestionsForInput(input);
    return;
  }
  hideSuggestions();
}

function handleDocumentMouseDown(event: MouseEvent): void {
  const target = event.target as Node | null;
  if (!target) return;
  if (popupElement?.contains(target)) return;
  if (activeSuggestionState?.input.contains(target)) return;
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
