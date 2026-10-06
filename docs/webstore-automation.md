# Chrome 웹스토어 자동 제출

정식 GitHub Release를 게시하면 `Publish Chrome Web Store` Actions가 첨부된
`dcshortcut-ts-v<버전>-dist.zip`을 다운로드하고 웹스토어 API v2로 업로드·심사 제출합니다.
Google이 승인하면 기존 공개 범위와 배포 비율로 자동 게시됩니다. 심사 승인 자체를 자동화하지는 않습니다.
현재 확장 ID는 `egojoffmbccdmdllejmaahbochbfdhbh`입니다.

## 최초 연결 (한 번만)

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 선택하거나 이 확장용 프로젝트를 만듭니다.
2. API 및 서비스 → 라이브러리에서 **Chrome Web Store API**와 **IAM Service Account Credentials API**를 사용 설정합니다.
3. IAM 및 관리자 → 서비스 계정에서 자동 제출용 서비스 계정을 만듭니다.
   Google Cloud 프로젝트의 Owner/Editor 권한을 부여할 필요는 없습니다.
   서비스 계정의 권한 탭에서 해당 서비스 계정 이메일에 **서비스 계정 토큰 생성자**
   (`roles/iam.serviceAccountTokenCreator`) 역할을 **자기 서비스 계정에 한해서** 부여합니다.
   이는 공식 Google 인증 Action이 단기 access token을 발급하는 데 필요합니다.
4. [웹스토어 개발자 콘솔](https://chrome.google.com/webstore/devconsole/)의 게시자/계정 설정에서
   서비스 계정 이메일을 연결하고 **Publisher ID**를 확인합니다. 확장 ID와 다른 값입니다.
   이미 연결된 서비스 계정이 있다면 교체하지 말고 기존 계정을 확인하세요.
5. 서비스 계정 → 키 → 키 추가 → 새 키 만들기 → JSON으로 키를 발급합니다.
6. [GitHub Actions Secrets](https://github.com/nonohako/dcshortcut-ts/settings/secrets/actions)에
   `CWS_SERVICE_ACCOUNT_JSON` 이름으로 JSON 전체를 등록합니다.
   키는 채팅·커밋·릴리스 첨부에 넣지 마세요. 로컬에서는 저장소 밖에 보관합니다.
7. [GitHub Actions Variables](https://github.com/nonohako/dcshortcut-ts/settings/variables/actions)에
   `CWS_PUBLISHER_ID` 이름으로 Publisher ID를 등록합니다.

서비스 계정 JSON과 게시자 ID만 있으면 됩니다. 별도의 OAuth client secret/refresh token은 사용하지 않습니다.
계정 연결 안내: [Google 공식 서비스 계정 문서](https://developer.chrome.com/docs/webstore/service-accounts).
토큰 권한 안내: [Google 인증 Action](https://github.com/google-github-actions/auth#inputs-service-account-key-json).

## 실행과 재실행

- 자동: ZIP 첨부를 완료한 정식 Release를 게시합니다. 초안·프리릴리스는 제출하지 않습니다.
- 수동: [Actions](https://github.com/nonohako/dcshortcut-ts/actions/workflows/publish-webstore.yml) →
  **Run workflow** → branch `main` → tag `v0.4.5` 등 입력.
- `validate_only` 체크 상태는 ZIP 검사만 실행하며 Google 인증도 필요 없습니다.
- **체크를 해제하면 실제 업로드 및 심사 제출**을 실행합니다.
- 이미 게시된 v0.4.5에는 새 워크플로 이벤트가 소급 발생하지 않습니다. 최초 연결 후 수동 실행하면 됩니다.
- 향후 Release를 다른 Actions에서 만들 경우 기본 `GITHUB_TOKEN`으로 생성한 이벤트는 후속 Actions를
  시작하지 않을 수 있습니다. 현재처럼 `gh`의 사용자 인증으로 게시하거나 명시적으로 이 워크플로를 호출하세요.

## 처리 방식

- 릴리스 ZIP 자체를 사용하며 현재 main 소스로 다시 빌드하지 않습니다.
- GitHub asset SHA-256, 태그/manifest 버전, 최상위 manifest, 프로덕션 파일 및 권한 범위를 검사합니다.
- 제출 도구는 main에서 체크아웃하므로 자동화 추가 이전의 릴리스도 수동 제출할 수 있습니다.
- 확장별 동시 실행을 직렬화합니다. 업로드 처리 완료 후에만 심사를 요청합니다.
- 같은 버전이 이미 심사 중이거나 게시됐다면 성공으로 종료하며 중복 제출하지 않습니다.
- 다른 버전이 심사 중/게시 대기 중이거나 더 새 버전이 등록됐다면 중단합니다.
- 업로드/제출 응답이 불확실하면 자동으로 POST를 반복하지 않습니다. 개발자 콘솔에서 상태를 확인한 뒤 재실행합니다.
- 워크플로 성공의 `PENDING_REVIEW`는 **심사 접수**를 의미하며 승인 완료가 아닙니다.
- API 호출은 GitHub Secrets로 발급한 단기 토큰을 사용하고 인증 응답·키는 출력하지 않습니다.

API 참고: [업로드와 제출](https://developer.chrome.com/docs/webstore/using-api),
[publish](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish).

## 로컬 검증

```powershell
corepack pnpm@11.22.0 exec python -m unittest discover -s scripts -p test_webstore_publish.py
corepack pnpm@11.22.0 exec python scripts/webstore_publish.py validate --tag v0.4.5 --directory .
```

실제 계정 연결 전에는 Google API 업로드/심사 제출 성공을 검증할 수 없습니다.
