---
title: ".client 모듈 — 클라이언트 전용 파일"
date: "2026-03-08"
description: "React Router에서 .client 접미사로 브라우저 전용 코드를 서버 번들에서 제외하는 방법"
tags: ["react-router", "framework-conventions", "client-only"]
category: "framework-conventions"
order: 6
---

> 공식 문서: [https://reactrouter.com/api/framework-conventions/client-modules](https://reactrouter.com/api/framework-conventions/client-modules)
> React Router v7 기준 (Framework Mode 전용)

---

# 들어가며

`npm run build` 시 Vite는 **서버 번들**과 **클라이언트 번들** 두 개를 만든다.

```
build/
├── server/index.js      ← 서버용 번들
└── client/assets/...    ← 클라이언트용 번들
```

일반 파일은 두 번들 **모두에 포함**된다. 이때 `window`, `localStorage` 같은 브라우저 API를 사용하는 코드가 서버 번들에 포함되면 문제가 생긴다.

**"실행되지 않으면 괜찮지 않나?"** 라고 생각할 수 있지만, 번들링 단계에서 Vite가 해당 파일을 읽는 순간 Node.js가 코드를 파싱하면서 에러가 발생한다. 실행 여부와 관계없이 **파일이 번들에 포함되는 것 자체가 문제**다.

```
// browser-only-lib 내부에 window 참조가 있다면
import someLib from "browser-only-lib"; // ← 서버 번들에 포함되는 순간
// → Node.js가 코드 파싱 시 "window is not defined" 에러
```

`.client` 접미사를 붙이면 **서버 번들에서 해당 파일 자체를 제외**한다. Vite가 번들링할 때 아예 읽지 않으므로 에러가 발생하지 않는다.

| | 서버 번들 | 클라이언트 번들 |
|---|---|---|
| 일반 파일 | O | O |
| `.client` 파일 | X | O |
| `.server` 파일 | O | X |

---

# 사용 방법

### 파일 단위

```
app/
├── analytics.client.ts       ← 클라이언트 전용
├── browser-utils.client.ts   ← 클라이언트 전용
└── root.tsx
```

### 디렉토리 단위

```
app/
├── .client/                  ← 디렉토리 내 전체가 클라이언트 전용
│   ├── analytics.ts
│   └── browser-utils.ts
└── root.tsx
```

---

# 동작 방식

서버에서 `.client` 모듈을 import하면 **모든 export가 `undefined`** 로 대체된다.
실제 코드는 클라이언트 번들에만 포함된다.

```typescript
// analytics.client.ts
export function trackEvent(name: string) {
  // 브라우저에서만 실행되는 코드
  window.gtag("event", name);
}
```

```typescript
// 서버에서 import 시 → trackEvent = undefined
// 클라이언트에서 import 시 → 실제 함수
import { trackEvent } from "./analytics.client.ts";
```

---

# 주의사항 — 반드시 useEffect 또는 이벤트 핸들러 안에서 사용

서버에서는 `undefined`이므로, 컴포넌트 최상단에서 바로 호출하면 에러가 난다.
**`useEffect`** 또는 **이벤트 핸들러** 안에서만 사용해야 한다.

```typescript
import { useEffect } from "react";
import { trackEvent } from "../analytics.client.ts";
import { canUseDOM } from "../browser-utils.client.ts";

export default function Dashboard() {
  useEffect(() => {
    // useEffect는 클라이언트에서만 실행 → 안전
    if (canUseDOM) {
      trackEvent("dashboard_viewed");
    }
  }, []);

  // X — 서버에서도 실행됨 → trackEvent가 undefined → 에러
  // trackEvent("dashboard_viewed");

  return <div>Dashboard</div>;
}
```

---

# 주요 사용 사례

### 1. 브라우저 기능 감지

```typescript
// app/utils/browser.client.ts
export const canUseDOM = typeof window !== "undefined";
export const hasWebGL = !!window.WebGLRenderingContext;
export const supportsVibration = "vibrate" in window.navigator;
```

### 2. 클라이언트 전용 라이브러리

브라우저에서만 동작하는 라이브러리를 import할 때.

```typescript
// app/analytics.client.ts
import { track } from "some-browser-only-lib";

export function trackEvent(name: string, data: object) {
  track(name, data);
}
```

### 3. 브라우저 스토리지 접근

```typescript
// app/storage.client.ts
export function getItem(key: string) {
  return localStorage.getItem(key);
}

export function setItem(key: string, value: string) {
  localStorage.setItem(key, value);
}
```

---

# .client vs useEffect 안에서 직접 처리

브라우저 API를 `useEffect` 안에서 직접 써도 되는데, 굳이 `.client` 파일로 분리하는 이유는 **서버에서 해당 모듈 자체를 번들에 포함하지 않기 위해서**다.

```typescript
// useEffect 직접 사용 — 서버 번들에 코드가 포함됨 (실행은 안 되지만)
useEffect(() => {
  window.gtag("event", "view");
}, []);

// .client 파일 분리 — 서버 번들에서 완전히 제외됨
import { trackEvent } from "./analytics.client.ts";
useEffect(() => {
  trackEvent("view");
}, []);
```

번들 크기, 트리 셰이킹, 보안(민감한 클라이언트 키 노출 방지) 측면에서 `.client` 분리가 유리하다.

---

# 정리

| | 내용 |
|---|---|
| 파일명 규칙 | `*.client.ts`, `*.client.tsx` 또는 `.client/` 디렉토리 |
| 서버에서의 export 값 | 모두 `undefined` |
| 안전한 사용 위치 | `useEffect`, 이벤트 핸들러 |
| 주요 용도 | 브라우저 API, 클라이언트 전용 라이브러리, 기능 감지 |
