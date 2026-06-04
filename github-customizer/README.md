# 🌸 GitHub Bloom

GitHub 잔디(contribution graph) 테마 커스터마이저 + AI 개발자 분석 크롬 확장 프로그램

## 기능

- 🎨 **잔디 테마 변경** — 깃허브 / 오션 / 선셋 / 퍼플 / 핑크 / 모노 / 파이어 (7종)
- 📊 **미리보기** — 적용 전 팝업에서 색상 확인
- 🤖 **AI 개발자 분석** — Claude API로 프로필 분석 (커밋 성향, 추천 프로젝트 등)

## 로컬 설치 방법

1. 이 폴더를 다운로드하거나 clone
2. Chrome에서 `chrome://extensions` 열기
3. 우측 상단 **개발자 모드** 켜기
4. **압축 해제된 확장 프로그램 로드** 클릭
5. 이 폴더(`github-customizer`) 선택

## AI 분석 사용법

1. 확장 팝업 → **설정** 탭
2. [Anthropic Console](https://console.anthropic.com)에서 발급한 API 키 입력 후 저장
3. GitHub 프로필 페이지(`github.com/유저명`) 접속
4. **AI 분석** 탭에서 질문하기

## 파일 구조

```
github-customizer/
├── manifest.json       # 확장 설정
├── content.js          # GitHub 페이지에 테마 주입
├── content.css         # 전환 애니메이션
├── background.js       # 서비스 워커
├── icons/              # 아이콘 이미지 (직접 추가)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── popup/
    ├── popup.html      # 팝업 UI
    └── popup.js        # 팝업 로직
```

## 아이콘 추가

`icons/` 폴더에 `icon16.png`, `icon48.png`, `icon128.png` 세 파일을 추가해주세요.
(없어도 동작하지만 확장 아이콘이 기본 이미지로 표시됩니다)

## 크롬 웹스토어 배포 시

1. `icons/` 폴더에 아이콘 추가
2. 폴더 전체를 ZIP으로 압축
3. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 에서 업로드
4. 스토어 등록비 $5 (1회) 결제 후 심사 제출
