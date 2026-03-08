---
title: "entry.client.tsx — 브라우저 진입점"
date: "2026-03-08"
description: "React Router Framework Mode의 클라이언트 진입점 entry.client.tsx 정리"
tags: ["react-router", "framework-conventions", "hydration"]
category: "framework-conventions"
order: 4
---

> 공식 문서: [https://reactrouter.com/api/framework-conventions/entry.client.tsx](https://reactrouter.com/api/framework-conventions/entry.client.tsx)
> React Router v7 기준 (Framework Mode 전용)

---

# 들어가며

`entry.client.tsx`는 **브라우저에서 가장 먼저 실행되는 코드**다.
서버(`entry.server.tsx`)가 만들어준 HTML을 React가 이어받아 인터랙티브하게 만드는 **hydration**을 담당한다.

필수 파일이 아니다. 없으면 React Router가 기본 구현을 자동으로 사용한다.
커스텀이 필요할 때만 아래 명령어로 기본 파일을 꺼내서 수정하면 된다.

```bash
npx react-router reveal
```

---

# 기본 구현

```tsx
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
```

### 각 요소의 역할

| 요소 | 역할 |
|---|---|
| `hydrateRoot` | 서버 HTML에 React를 연결해 인터랙티브하게 만듦 |
| `HydratedRouter` | 클라이언트 사이드 라우팅 관리 |
| `StrictMode` | 개발 환경에서 잠재적 문제 감지 |
| `startTransition` | hydration을 낮은 우선순위로 처리해 브라우저 응답성 유지 |

### `startTransition`으로 감싸는 이유

hydration은 무거운 작업일 수 있다. `startTransition` 없이 실행하면 hydration이 완료될 때까지 브라우저가 사용자 입력에 응답하지 못할 수 있다.
`startTransition`으로 감싸면 React가 hydration을 **낮은 우선순위 작업**으로 처리해서, 사용자 클릭 같은 긴급한 이벤트를 먼저 처리할 수 있다.

---

# 커스텀이 필요한 경우

### 1. 클라이언트 전용 라이브러리 초기화

analytics, 모니터링 등 서버에서 실행하면 안 되는 라이브러리를 초기화한다.

```tsx
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

// 클라이언트에서만 초기화
initAnalytics();
initSentry();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
```

### 2. Provider 추가

테마, 인증 등 앱 전체에 필요한 클라이언트 전용 Provider를 감싼다.

```tsx
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { ThemeProvider } from "./theme";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <ThemeProvider>
        <HydratedRouter />
      </ThemeProvider>
    </StrictMode>
  );
});
```

### 3. MSW(Mock Service Worker) 설정

개발 환경에서 API를 모킹할 때, MSW는 브라우저 Service Worker를 등록해야 하므로 `entry.client.tsx`에서 초기화한다.
MSW가 준비된 후에 hydration을 시작해야 요청이 모킹된 상태로 앱이 시작된다.

```tsx
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

async function prepare() {
  if (process.env.NODE_ENV === "development") {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      onUnhandledRequest: "bypass",
    });
  }
}

prepare().then(() => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    );
  });
});
```

`worker.start()`가 완료된 후 hydration을 시작하므로, 앱이 처음 렌더링될 때부터 모든 API 요청이 MSW에 의해 인터셉트된다.

---

# 정리

| | 내용 |
|---|---|
| 실행 환경 | 브라우저 전용 |
| 필수 여부 | 선택 (없으면 기본 구현 자동 사용) |
| 주요 역할 | 서버 HTML hydration |
| 커스텀 시점 | 클라이언트 전용 초기화가 필요할 때 |
