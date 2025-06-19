// =================================================================
// Type Definitions (타입 정의)
// =================================================================

/**
 * @interface GalleryInfo
 * @description 갤러리 정보를 담는 인터페이스. navigateToGallery 함수에서 사용됩니다.
 * @property {string} galleryId - 갤러리 ID (예: 'programming')
 * @property {'board' | 'mgallery' | 'mini'} galleryType - 갤러리 종류
 */
export interface GalleryInfo {
  galleryId: string;
  galleryType: 'board' | 'mgallery' | 'mini';
}

/**
 * @type ElementProperties
 * @description createElement 함수에서 요소에 할당할 속성들을 정의하는 타입.
 * HTMLElement의 속성들을 부분적으로 포함하며, `dataset` 속성을 특별히 다룹니다.
 * 제네릭 `K`를 사용하여 생성되는 특정 HTML 요소(예: HTMLAnchorElement)에 맞는 속성을 타입 검사할 수 있습니다.
 */
type ElementProperties<K extends keyof HTMLElementTagNameMap> = Partial<
  Omit<HTMLElementTagNameMap[K], 'style' | 'dataset'>
> & {
  dataset?: Record<string, string>;
};

// =================================================================
// UI Module (UI 모듈)
// =================================================================

/**
 * @module UI
 * @description UI 관련 유틸리티 함수들을 모아놓은 객체.
 * DOM 요소 생성, 폰트 로드, 페이지 이동, 알림 메시지 표시 등의 기능을 제공합니다.
 */
const UI = {
  /**
   * 지정된 태그, 스타일, 속성을 가진 HTML 요소를 생성합니다.
   * @template K - 생성할 HTML 요소의 태그 이름 (예: 'div', 'a', 'link')
   * @param {K} tag - HTML 태그 이름
   * @param {Partial<CSSStyleDeclaration>} styles - 요소에 적용할 CSS 스타일 객체
   * @param {ElementProperties<K>} [props={}] - 요소에 할당할 속성들 (textContent, className, dataset 등)
   * @returns {HTMLElementTagNameMap[K]} 생성된 HTML 요소
   */
  createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    styles: Partial<CSSStyleDeclaration>,
    props: ElementProperties<K> = {}
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    // Object.assign을 사용하여 스타일을 한 번에 적용합니다.
    Object.assign(el.style, styles);

    // props에서 dataset을 분리하고 나머지 속성들을 요소에 할당합니다.
    const { dataset, ...otherProps } = props;
    Object.assign(el, otherProps);

    // dataset 객체가 존재하면, 각 키-값 쌍을 요소의 data-* 속성으로 설정합니다.
    if (dataset && typeof dataset === 'object') {
      for (const key in dataset) {
        // 상속된 속성이 아닌 객체 자신의 속성인지 확인합니다.
        if (Object.prototype.hasOwnProperty.call(dataset, key)) {
          el.dataset[key] = dataset[key];
        }
      }
    }
    return el;
  },

  /**
   * Google Fonts의 Roboto 폰트를 동적으로 로드합니다.
   * 페이지에 이미 해당 폰트가 로드되어 있는지 확인하여 중복 로드를 방지합니다.
   */
  loadRobotoFont(): void {
    // 이미 Roboto 폰트 link 태그가 있는지 확인
    if (!document.querySelector('link[href*="Roboto"]')) {
      // this.createElement를 사용하여 link 태그 생성 및 head에 추가
      document.head.appendChild(
        this.createElement(
          'link',
          {},
          {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
          }
        )
      );
    }
  },

  /**
   * 주어진 갤러리 정보에 따라 해당 갤러리 페이지로 이동합니다.
   * @param {GalleryInfo} gallery - 이동할 갤러리 정보를 담은 객체
   */
  navigateToGallery(gallery: GalleryInfo): void {
    if (!gallery || !gallery.galleryId) {
      console.error('페이지 이동을 위한 갤러리 정보가 유효하지 않습니다:', gallery);
      return;
    }
    const baseUrl = 'https://gall.dcinside.com';
    const listPath = 'board/lists';
    // 갤러리 타입이 'board'가 아니면 URL에 해당 타입을 추가합니다 (예: /mgallery).
    const galleryPrefix = gallery.galleryType === 'board' ? '' : `/${gallery.galleryType}`;
    const url = `${baseUrl}${galleryPrefix}/${listPath}?id=${gallery.galleryId}`;

    // 생성된 URL로 페이지를 이동시킵니다.
    window.location.href = url;
  },

  /**
   * 화면에 전역 알림 메시지를 표시합니다.
   * @param {string} message - 표시할 메시지 내용
   * @param {number} [duration=2000] - 메시지가 표시될 시간 (ms). 0으로 설정하면 자동으로 사라지지 않습니다.
   * @returns {HTMLDivElement} 생성된 알림 요소
   */
  showAlert(message: string, duration: number = 2000): HTMLDivElement {
    // 동일한 메시지의 알림이 이미 있다면 먼저 제거
    this.removeAlert(message);

    const alert = this.createElement(
      'div',
      {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: '10000',
        transition: 'opacity 0.3s ease',
        opacity: '0', // 초기 투명도를 0으로 설정하여 fade-in 효과 준비
      },
      {
        textContent: message,
        className: 'dc-ShortCut-alert', // 식별을 위한 클래스 이름
        dataset: { message: message }, // 메시지 내용을 데이터 속성으로 저장
      }
    );

    document.body.appendChild(alert);

    // 잠시 후 투명도를 1로 변경하여 fade-in 효과를 줍니다.
    requestAnimationFrame(() => {
      alert.style.opacity = '1';
    });

    // duration이 0보다 크면 지정된 시간 후에 알림을 자동으로 제거합니다.
    if (duration > 0) {
      setTimeout(() => {
        // fade-out 효과
        alert.style.opacity = '0';
        // 트랜지션이 끝난 후 DOM에서 요소를 완전히 제거합니다.
        setTimeout(() => {
          if (alert.parentNode) {
            document.body.removeChild(alert);
          }
        }, 300); // transition 시간과 일치시킴
      }, duration);
    }

    return alert;
  },

  /**
   * 화면에 표시된 알림 메시지를 제거합니다.
   * @param {string} [message] - 제거할 특정 메시지. 제공되지 않으면 모든 알림을 제거합니다.
   */
  removeAlert(message?: string): void {
    // 메시지가 주어지면 해당 메시지를 가진 알림만, 아니면 모든 알림을 선택
    const selector = message
      ? `.dc-ShortCut-alert[data-message="${message}"]`
      : '.dc-ShortCut-alert';
    document.querySelectorAll<HTMLDivElement>(selector).forEach((alert) => {
      alert.style.opacity = '0';
      setTimeout(() => {
        if (alert.parentNode) {
          document.body.removeChild(alert);
        }
      }, 300); // fade-out 트랜지션 시간
    });
  },
};

export default UI;
