// Posts 모듈 import. Posts.ts로 변환된 후 .js 확장자는 제거됩니다.
import Posts from './Posts';

// =================================================================
// Constants (상수 정의)
// =================================================================

/**
 * @description 즐겨찾기 갤러리 목록을 저장하는 storage 키
 */
export const FAVORITE_GALLERIES_KEY = 'dcinside_favorite_galleries';

/**
 * @description 현재 활성화된 즐겨찾기 프로필을 저장하는 storage 키
 */
export const ACTIVE_FAVORITES_PROFILE_KEY = 'dcinside_active_favorites_profile';

/**
 * @description 페이지 이동 방식을 저장하는 storage 키 ('ajax', 'full', 'infinite')
 */
export const PAGE_NAVIGATION_MODE_KEY = 'dcinside_page_navigation_mode';

/**
 * @description Z 추천 매크로 실행 상태를 나타내는 storage 키
 */
export const MACRO_Z_RUNNING_KEY = 'dcinside_macro_z_running';

/**
 * @description X 비추천 매크로 실행 상태를 나타내는 storage 키
 */
export const MACRO_X_RUNNING_KEY = 'dcinside_macro_x_running';

/**
 * @description 매크로 실행 간격을 저장하는 storage 키
 */
export const MACRO_INTERVAL_KEY = 'dcinside_macro_interval';

/**
 * @description 디시콘 별칭 맵을 저장하는 storage 키
 */
export const DCCON_ALIAS_MAP_KEY = 'dcinside_dccon_alias_map';

/**
 * @description 디시콘 별칭 기능 활성화 여부를 저장하는 storage 키
 */
export const DCCON_ALIAS_ENABLED_KEY = 'dcinside_dccon_alias_enabled';

/**
 * @description 'A/S' 단축키로 전체 페이지 로드 시 스크롤 위치 조정을 위한 sessionStorage 키
 */
export const AS_FULL_LOAD_SCROLL_KEY = 'dcinside_navigated_by_as_full_load';

// =================================================================
// Module-level State (모듈 수준 상태)
// =================================================================

/**
 * @description prefetch 링크가 이미 추가되었는지 여부를 추적하는 플래그
 */
let prefetchHintsAdded: boolean = false;

// =================================================================
// Functions (함수)
// =================================================================

/**
 * 이전/다음 페이지, 이전/다음 게시글에 대한 prefetch 링크를 <head>에 추가합니다.
 * 이를 통해 사용자가 해당 링크를 클릭할 때 더 빠른 페이지 로딩을 경험할 수 있습니다.
 * 함수는 한 페이지에서 한 번만 실행됩니다.
 * @returns {void}
 */
export function addPrefetchHints(): void {
  // 이미 실행되었다면 중복 실행 방지
  if (prefetchHintsAdded) return;

  // 브라우저가 prefetch를 지원하는지 확인 (IIFE - 즉시 실행 함수 표현)
  const isPrefetchSupported = ((): boolean => {
    const link = document.createElement('link');
    return !!(link.relList && link.relList.supports && link.relList.supports('prefetch'));
  })();

  if (!isPrefetchSupported) return;

  // 기존에 추가된 prefetch 링크가 있다면 제거
  document
    .querySelectorAll<HTMLLinkElement>('link[data-dc-prefetch="true"]')
    .forEach((link) => link.remove());

  /**
   * prefetch 링크를 생성하고 <head>에 추가하는 내부 헬퍼 함수
   * @param {string | null | undefined} href - prefetch할 URL
   */
  const addHint = (href: string | null | undefined): void => {
    // href가 유효하지 않으면 아무 작업도 하지 않음
    if (!href) return;

    try {
      // 상대 경로를 절대 경로로 변환
      const fullHref = new URL(href, window.location.origin).toString();
      // 이미 동일한 prefetch 링크가 있는지 확인
      if (document.querySelector(`link[rel="prefetch"][href="${fullHref}"]`)) return;

      const link: HTMLLinkElement = document.createElement('link');
      link.rel = 'prefetch';
      link.href = fullHref;
      link.as = 'document'; // prefetch할 리소스의 타입 명시
      link.setAttribute('data-dc-prefetch', 'true'); // 이 스크립트에 의해 추가되었음을 표시
      document.head.appendChild(link);
    } catch (e) {
      console.error('Prefetch hint 추가 실패:', href, e);
    }
  };

  // --- 페이지네이션 prefetch ---
  let targetPagingBox: Element | null = null;
  // 댓글 페이지 등 예외적인 구조의 페이징 박스를 먼저 찾음
  const exceptionPagingWrap: Element | null = document.querySelector(
    '.bottom_paging_wrap.re, .bottom_paging_wrapre'
  );

  if (exceptionPagingWrap) {
    targetPagingBox = exceptionPagingWrap.querySelector('.bottom_paging_box');
  } else {
    // 일반적인 페이징 박스를 찾음
    const normalPagingWraps: NodeListOf<Element> = document.querySelectorAll('.bottom_paging_wrap');
    if (normalPagingWraps.length > 1) {
      // 페이징 래퍼가 2개 이상일 경우, 두 번째 것을 사용 (보통 본문 하단)
      targetPagingBox = normalPagingWraps[1]?.querySelector('.bottom_paging_box');
    } else if (normalPagingWraps.length === 1) {
      targetPagingBox = normalPagingWraps[0]?.querySelector('.bottom_paging_box');
    }
  }

  if (targetPagingBox) {
    const currentPageElement: HTMLElement | null = targetPagingBox.querySelector('em'); // 현재 페이지는 'em' 태그로 표시됨
    let prevPageLinkHref: string | null = null;
    let nextPageLinkHref: string | null = null;

    if (currentPageElement) {
      // 현재 페이지(em)의 이전/다음 형제 요소(a)에서 링크를 찾음
      const prevPageSibling = currentPageElement.previousElementSibling;
      if (prevPageSibling?.tagName === 'A') {
        prevPageLinkHref = (prevPageSibling as HTMLAnchorElement).href;
      }
      const nextPageSibling = currentPageElement.nextElementSibling;
      if (nextPageSibling?.tagName === 'A') {
        nextPageLinkHref = (nextPageSibling as HTMLAnchorElement).href;
      }
    } else {
      // 'em' 태그가 없는 경우 (예: 검색 결과 페이지), 이전/다음 화살표 버튼에서 링크를 찾음
      prevPageLinkHref =
        targetPagingBox.querySelector<HTMLAnchorElement>('a.search_prev[href]')?.href ?? null;
      nextPageLinkHref =
        targetPagingBox.querySelector<HTMLAnchorElement>('a.search_next[href]')?.href ?? null;
    }

    addHint(prevPageLinkHref);
    addHint(nextPageLinkHref);
  }

  // --- 게시글 prefetch ---
  // 현재 보고 있는 게시글 아이콘을 찾음
  const currentPostIcon: Element | null = document.querySelector('td.gall_num .sp_img.crt_icon');
  if (currentPostIcon) {
    const currentRow: HTMLTableRowElement | null = currentPostIcon.closest('tr');
    let prevPostLinkHref: string | null = null;
    let nextPostLinkHref: string | null = null;

    // 이전 게시글 찾기
    let prevRow: Element | null = currentRow?.previousElementSibling ?? null;
    while (prevRow) {
      // 공지나 기타 유효하지 않은 행을 건너뛰고 유효한 게시글 행을 찾음
      if (
        Posts.isValidPost(
          prevRow.querySelector('td.gall_num'),
          prevRow.querySelector('td.gall_tit'),
          prevRow.querySelector('td.gall_subject')
        )
      ) {
        prevPostLinkHref =
          prevRow.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child')?.href ?? null;
        break; // 찾았으면 반복 중단
      }
      prevRow = prevRow.previousElementSibling;
    }

    // 다음 게시글 찾기
    let nextRow: Element | null = currentRow?.nextElementSibling ?? null;
    while (nextRow) {
      // 유효한 게시글 행을 찾음
      if (
        Posts.isValidPost(
          nextRow.querySelector('td.gall_num'),
          nextRow.querySelector('td.gall_tit'),
          nextRow.querySelector('td.gall_subject')
        )
      ) {
        nextPostLinkHref =
          nextRow.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child')?.href ?? null;
        break; // 찾았으면 반복 중단
      }
      nextRow = nextRow.nextElementSibling;
    }

    addHint(prevPostLinkHref);
    addHint(nextPostLinkHref);
  }

  // 함수가 성공적으로 실행되었음을 표시
  prefetchHintsAdded = true;
}

/**
 * 'A/S' 단축키를 통해 전체 페이지 로드로 이동했을 때,
 * sessionStorage에 저장된 플래그를 확인하여 게시글 목록 상단으로 스크롤합니다.
 * @returns {void}
 */
export function handlePageLoadScroll(): void {
  const scrollToTopFlag = sessionStorage.getItem(AS_FULL_LOAD_SCROLL_KEY);

  if (scrollToTopFlag === 'true') {
    console.log('A/S (전체 로드) 네비게이션 감지. 목록 상단으로 스크롤합니다.');
    // 플래그를 사용한 후 즉시 제거하여 다음 페이지 로드에 영향을 주지 않도록 함
    sessionStorage.removeItem(AS_FULL_LOAD_SCROLL_KEY);

    // 다음 렌더링 프레임에서 스크롤을 실행하여 DOM이 준비되도록 함
    requestAnimationFrame(() => {
      // 게시글 목록을 나타내는 요소를 찾음
      const listElement: Element | null = document.querySelector('table.gall_list, .gall_listwrap');
      if (listElement) {
        listElement.scrollIntoView({ behavior: 'auto', block: 'start' });
        console.log('목록 상단으로 스크롤 완료.');
      } else {
        console.warn('스크롤할 목록 요소를 찾지 못했습니다.');
      }
    });
  }
}

/**
 * 글쓰기 페이지에서 제목 입력란(#subject)에서 Tab 키를 누르면
 * 내용 입력란(.note-editable)으로 포커스를 이동시킵니다.
 * 이벤트 리스너가 중복으로 추가되는 것을 방지합니다.
 * @returns {void}
 */
export function setupTabFocus(): void {
  const subjectInput = document.getElementById('subject') as HTMLInputElement | null;
  const contentEditable = document.querySelector('.note-editable') as HTMLElement | null;

  // 제목과 내용 입력란이 모두 존재하고, 아직 이벤트 리스너가 추가되지 않았을 때만 실행
  if (subjectInput && contentEditable && !subjectInput.hasAttribute('data-tab-listener-added')) {
    subjectInput.addEventListener('keydown', (event: KeyboardEvent) => {
      // Tab 키를 누르고 Shift 키는 누르지 않았을 때
      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault(); // 기본 Tab 동작(다음 요소로 포커스 이동)을 막음
        contentEditable.focus(); // 내용 입력란으로 포커스 이동
      }
    });
    // 이벤트 리스너가 추가되었음을 속성으로 표시
    subjectInput.setAttribute('data-tab-listener-added', 'true');
  }
}

/**
 * 글쓰기 페이지(/board/write/)에 진입했을 때,
 * 자동으로 제목 입력란에 포커스를 맞추고 플레이스홀더를 숨깁니다.
 * @returns {void}
 */
export function focusSubjectInputOnWritePage(): void {
  // 현재 URL이 글쓰기 페이지인지 확인
  if (window.location.pathname.includes('/board/write/')) {
    console.log('[Global] 글쓰기 페이지 감지. 제목 입력란에 포커스를 시도합니다.');
    const subjectInput = document.getElementById('subject') as HTMLInputElement | null;
    const placeholderLabel = document.querySelector('.txt_placeholder') as HTMLElement | null;

    if (subjectInput && placeholderLabel) {
      subjectInput.focus();
      placeholderLabel.style.display = 'none'; // 포커스가 가면 플레이스홀더가 자동으로 사라지지 않는 경우가 있어 강제로 숨김
      console.log('[Global] 성공적으로 포커스하고 플레이스홀더를 숨겼습니다.');
    } else {
      console.log('[Global] 제목 입력 요소를 찾지 못했습니다.');
    }
  }
}
