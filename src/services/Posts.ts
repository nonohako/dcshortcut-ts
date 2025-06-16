// =================================================================
// Type Definitions (타입 정의)
// =================================================================

/**
 * @interface PostInfo
 * @description 유효한 게시글 하나의 정보를 담는 인터페이스.
 * @property {HTMLTableRowElement} row - 게시글의 `<tr>` 요소.
 * @property {HTMLAnchorElement} link - 게시글 제목의 `<a>` 링크 요소.
 */
interface PostInfo {
    row: HTMLTableRowElement;
    link: HTMLAnchorElement;
}

/**
 * @interface ValidPostsResult
 * @description getValidPosts 함수의 반환 타입을 정의합니다.
 * @property {PostInfo[]} validPosts - 페이지 내에서 유효하다고 판단된 게시글 목록.
 * @property {number} currentIndex - 유효한 게시글 목록에서 현재 보고 있는 글의 인덱스.
 */
interface ValidPostsResult {
    validPosts: PostInfo[];
    currentIndex: number;
}


// =================================================================
// Posts Module (게시글 모듈)
// =================================================================

const Posts = {
    /**
     * 주어진 행(tr)이 유효한 게시글인지 판별합니다.
     * 공지, 광고, 차단된 글 등을 필터링하는 원본 로직을 그대로 유지합니다.
     * @param {HTMLElement | null} numCell - 번호가 표시되는 `<td>` (gall_num).
     * @param {HTMLElement | null} titleCell - 제목이 표시되는 `<td>` (gall_tit).
     * @param {HTMLElement | null} subjectCell - 말머리가 표시되는 `<td>` (gall_subject).
     * @returns {boolean} 유효한 게시글이면 true, 아니면 false.
     */
    isValidPost(
        numCell: HTMLElement | null,
        titleCell: HTMLElement | null,
        subjectCell: HTMLElement | null
    ): boolean {
        // 1. 필수 셀이 없으면 유효하지 않음.
        if (!numCell || !titleCell) {
            return false;
        }

        const row = numCell.closest('tr');
        // 2. 행이 없거나, 차단/숨김 처리된 행, 트렌드 글 목록 등은 필터링.
        if (!row || row.classList.contains('block-disable') || row.classList.contains('list_trend') || row.style.display === 'none') {
            return false;
        }

        // 3. 제목 셀 내부에 공지 아이콘이 있으면 필터링.
        if (titleCell.querySelector('em.icon_notice')) {
            return false;
        }

        // 4. 제목 셀 내부에 <b> 태그가 있으면 고정/중요 글로 간주하고 필터링.
        if (titleCell.querySelector('b')) {
            return false;
        }
        
        // 5. 현재 보고 있는 글 아이콘('crt_icon')이 있는 경우, 유효한 글로 간주.
        //    (단, 위에서 공지/고정글은 이미 걸러졌어야 함)
        if (numCell.querySelector('.sp_img.crt_icon')) {
            return true;
        }

        // 6. 번호 셀의 텍스트가 'AD'이거나, 숫자가 아니면 광고 또는 기타 항목으로 보고 필터링.
        const numText = numCell.textContent?.trim() ?? '';
        const numberPart = numText.replace(/\[.*?\]\s*/, ''); // [댓글수] 부분 제거
        if (numText === 'AD' || isNaN(Number(numberPart)) || numberPart.trim() === '') {
            return false;
        }

        // 모든 필터링 조건을 통과하면 유효한 게시글로 판단.
        return true;
    },

    /**
     * 페이지 내의 모든 유효한 게시글 목록과 현재 글의 인덱스를 가져옵니다.
     * @returns {ValidPostsResult} 유효한 게시글 목록과 현재 글 인덱스를 담은 객체.
     */
    getValidPosts(): ValidPostsResult {
        const rows = document.querySelectorAll<HTMLTableRowElement>('table.gall_list tbody tr');
        const validPosts: PostInfo[] = [];
        let currentIndex = -1;

        rows.forEach((row) => {
            const numCell = row.querySelector<HTMLTableCellElement>('td.gall_num');
            const titleCell = row.querySelector<HTMLTableCellElement>('td.gall_tit');
            const subjectCell = row.querySelector<HTMLTableCellElement>('td.gall_subject');

            if (!this.isValidPost(numCell, titleCell, subjectCell)) return;

            const link = titleCell?.querySelector<HTMLAnchorElement>('a:first-child');
            if (link) {
                validPosts.push({ row, link });
                if (numCell?.querySelector('.sp_img.crt_icon')) {
                    currentIndex = validPosts.length - 1;
                }
            }
        });

        return { validPosts, currentIndex };
    },

    /**
     * 유효한 게시글 목록에 `[1]`, `[2]`... 와 같은 숫자 라벨을 시각적으로 추가합니다.
     * 개념글 목록 등 여러 tbody가 있는 페이지를 처리하는 원본 로직을 그대로 유지합니다.
     */
    addNumberLabels(): void {
        // 1. 기존에 추가했던 모든 라벨 정보를 깨끗하게 제거.
        const previouslyLabeled = document.querySelectorAll<HTMLTableCellElement>('td.gall_num.shortcut-labeled');
        previouslyLabeled.forEach(cell => {
            cell.classList.remove('shortcut-labeled');
            delete cell.dataset.shortcutLabel;
        });

        // 2. 페이지의 모든 유효한 행을 순서대로 수집.
        const rowsToLabel: HTMLTableRowElement[] = [];
        const tbodies = document.querySelectorAll<HTMLTableSectionElement>('table.gall_list tbody');

        tbodies.forEach((tbody, tbodyIndex) => {
            const rowsInTbody = tbody.querySelectorAll<HTMLTableRowElement>('tr');
            rowsInTbody.forEach(row => {
                const numCell = row.querySelector<HTMLTableCellElement>('td.gall_num');
                const titleCell = row.querySelector<HTMLTableCellElement>('td.gall_tit');
                if (!numCell || !titleCell) return;

                let isPostValidForLabeling = false;
                // 첫 번째 tbody(일반글 목록)는 엄격한 기준(isValidPost)으로 검사
                if (tbodyIndex === 0) {
                    if (this.isValidPost(numCell, titleCell, row.querySelector<HTMLTableCellElement>('td.gall_subject'))) {
                        isPostValidForLabeling = true;
                    }
                } else {
                    // 두 번째 이후의 tbody(개념글 등)는 광고와 차단글만 제외하는 느슨한 기준으로 검사
                    const numText = numCell.textContent?.trim() ?? '';
                    if (numText !== 'AD' && !row.classList.contains('block-disable')) {
                        isPostValidForLabeling = true;
                    }
                }
                
                if (isPostValidForLabeling) {
                    rowsToLabel.push(row);
                }
            });
        });

        // 3. 수집된 모든 행에 대해 1번부터 순차적으로 라벨링.
        rowsToLabel.forEach((row, index) => {
            const numCell = row.querySelector<HTMLTableCellElement>('td.gall_num');
            if (numCell) {
                numCell.classList.add('shortcut-labeled');
                numCell.dataset.shortcutLabel = `[${index + 1}]`;
            }
        });
    },

    /**
     * 주어진 번호에 해당하는 게시글로 이동합니다. (Alt+숫자 단축키용)
     * @param {string} number - 이동할 게시글의 번호 (1부터 시작).
     * @returns {boolean} 성공적으로 이동했으면 true, 아니면 false.
     */
    navigate(number: string): boolean {
        const { validPosts } = this.getValidPosts();
        const index = parseInt(number, 10) - 1;

        if (index >= 0 && index < validPosts.length) {
            validPosts[index].link.click();
            return true;
        }
        return false;
    },

    /**
     * 게시글 목록의 날짜 형식을 'MM.DD HH:mm' 또는 'HH:mm'(오늘)으로 변경합니다.
     */
    formatDates(): void {
        const today = new Date();
        const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const dateCells = document.querySelectorAll<HTMLTableCellElement>('td.gall_date:not(.date-formatted)');

        dateCells.forEach(dateCell => {
            if (dateCell.title) {
                const fullTimestamp = dateCell.title;
                const match = fullTimestamp.match(/(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):\d{2}/);

                if (match) {
                    const [, postYear, postMonth, postDay, postHour, postMinute] = match;
                    const postDateString = `${postYear}-${postMonth}-${postDay}`;

                    const formattedDate = (postDateString === todayDateString)
                        ? `${postHour}:${postMinute}`
                        : `${postMonth}.${postDay} ${postHour}:${postMinute}`;

                    if (dateCell.textContent !== formattedDate) {
                        dateCell.textContent = formattedDate;
                    }
                }
            }
            dateCell.classList.add('date-formatted');
        });
    },

    /**
     * 게시글 목록 테이블의 `<colgroup>` 너비를 조정하여 레이아웃을 최적화합니다.
     * 갤러리마다 다른 컬럼 개수(6, 7, 8개)에 대응하는 원본 로직을 그대로 유지합니다.
     */
    adjustColgroupWidths(): void {
        const colgroup = document.querySelector<HTMLTableColElement>('table.gall_list colgroup');
        if (!colgroup) return;

        const cols = colgroup.querySelectorAll('col');
        let targetWidths: (string | null)[] | null = null;

        if (cols.length === 8) {
            targetWidths = ['25px', '9%', '51px', null, '15%', '8%', '6%', '6%'];
        } else if (cols.length === 7) {
            targetWidths = ['9%', '51px', null, '15%', '8%', '6%', '6%'];
        } else if (cols.length === 6) {
            targetWidths = ['9%', null, '15%', '8%', '6%', '6%'];
        } else {
            return;
        }

        cols.forEach((col, index) => {
            if (index >= targetWidths!.length) return;
            const targetWidth = targetWidths![index];

            if (targetWidth !== null) {
                if (col.style.width !== targetWidth) col.style.width = targetWidth;
            } else {
                if (col.style.width) col.style.width = '';
            }
        });
    }
};

export default Posts;