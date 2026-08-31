# project-bookey-app

bookey 모바일 앱 — iOS / Android (Expo, React Native).

관련 저장소
- **[project-bookey](https://github.com/Jay-0315/project-bookey)** — 백엔드 API, 기획서
- **[project-bookey-admin](https://github.com/Jay-0315/project-bookey-admin)** — 관리자 백오피스

## 구성

```
project-bookey-app/
├─ app/            화면 (expo-router 파일 기반 라우팅)
│   ├─ (tabs)/     홈 · 서재 · 모임 · 기록 · 프로필
│   ├─ club/       모임 참가 · 생성 · 홈 · 토론 · 결산
│   ├─ book/       도서 상세
│   ├─ timer.tsx   독서 타이머
│   └─ search.tsx  도서 검색
├─ src/
│   ├─ api/        API 클라이언트 · 타입
│   ├─ components/ 공용 UI
│   ├─ store/      인증 · 토큰 저장
│   └─ theme/      디자인 토큰
└─ scripts/        OpenAPI → TS 타입 생성기
```

## 시작하기

```bash
# 백엔드 저장소에서 API 서버를 먼저 띄웁니다 (http://localhost:8080)
npm install

npm run web     # 브라우저 미리보기 (http://localhost:8081)
npm start       # Expo Go / 시뮬레이터
```

### 실제 폰에서 보기

Xcode 없이도 확인할 수 있습니다.

1. App Store / Play 스토어에서 **Expo Go** 설치
2. 맥과 폰을 같은 Wi-Fi에 연결
3. `npm start` 후 터미널의 QR 코드를 스캔

API 주소는 개발 서버 호스트에서 자동으로 유추합니다(맥의 LAN IP:8080).
다른 주소를 쓰려면 `EXPO_PUBLIC_API_URL` 을 지정하세요.

> 시뮬레이터로 띄우려면 Xcode(iOS) 또는 Android Studio(Android)가 필요합니다.

## 백엔드와의 계약

백엔드가 다른 저장소에 있으므로, 두 쪽을 잇는 것은 **서버가 발행하는 OpenAPI 문서**입니다.

```bash
npm run types                                    # 로컬 서버 기준
BOOKEY_API_URL=https://api.bookey.app npm run types
```

`src/api/generated.ts` 가 만들어집니다. 생성물이라 커밋하지 않습니다 — 서버 API 가 바뀌면 다시 뽑으세요.

**주의**: 지금은 `src/api/types.ts` 에 손으로 쓴 타입이 남아 있습니다. 생성 타입으로 옮기는 작업은 아직 하지 않았습니다.

## 환경 변수

| 키 | 설명 |
|---|---|
| `EXPO_PUBLIC_API_URL` | API 주소. 없으면 개발 서버 호스트에서 유추 |

## 검사

```bash
npm run typecheck
```
