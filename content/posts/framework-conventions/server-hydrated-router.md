---
title: "ServerRouter & HydratedRouter — SSR 라우터 페어"
date: "2026-03-08"
description: "React Router Framework Mode의 서버/클라이언트 라우터 쌍인 ServerRouter와 HydratedRouter의 동작 원리"
tags: ["react-router", "framework-conventions", "ssr", "hydration"]
category: "framework-conventions"
order: 8
---

> 공식 문서:
> [ServerRouter](https://reactrouter.com/api/framework-routers/ServerRouter) /
> [HydratedRouter](https://reactrouter.com/api/framework-routers/HydratedRouter)
> React Router v7 기준 (Framework Mode 전용)
> 내부 동작은 [components.tsx 소스](https://github.com/remix-run/react-router/blob/dev/packages/react-router/lib/dom/ssr/components.tsx) 기반

---

# 들어가며

`ServerRouter`와 `HydratedRouter`는 항상 짝으로 동작하는 SSR 라우터 페어다.

| | ServerRouter | HydratedRouter |
|---|---|---|
| 실행 환경 | 서버 | 브라우저 |
| 사용 위치 | `entry.server.tsx` | `entry.client.tsx` |
| 역할 | HTML 생성 + 데이터 직렬화 | hydration + 클라이언트 라우팅 |

```
브라우저 요청
  → [서버] ServerRouter → HTML 렌더링 + window 데이터 삽입
  → [브라우저] HTML 표시
  → [브라우저] HydratedRouter → window 데이터 읽기 → React 연결
  → 이후 SPA처럼 동작
```

---

# ServerRouter

`entry.server.tsx`에서 HTML을 생성할 때 사용한다.

```tsx
function ServerRouter({
  context,  // 라우터 컨텍스트 (EntryContext)
  url,      // 요청 URL
  nonce?,   // CSP nonce (선택)
}: ServerRouterProps)
```

### Props

**`context`**
요청 렌더링에 필요한 모든 데이터를 담는다. `handleRequest`가 파라미터로 받는 `routerContext: EntryContext`를 그대로 전달하면 된다.

- 라우트 매니페스트 (라우트별 JS/CSS 경로)
- 라우트 모듈
- loader 실행 결과
- 클라이언트로 전달할 직렬화된 초기 상태

**`url`**
요청 URL. 이 URL로 어떤 라우트를 렌더링할지 결정한다.

**`nonce`**
CSP 인라인 스크립트 허용을 위한 nonce 값. `<Scripts />`, `<ScrollRestoration />`의 nonce와 동일하게 맞춰야 한다.

### 사용 예시

```tsx
// entry.server.tsx
import { PassThrough } from "node:stream";
import type { EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { renderToPipeableStream } from "react-dom/server";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={routerContext}
        url={request.url}
      />,
      {
        onShellReady() {
          responseHeaders.set("Content-Type", "text/html");
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
      },
    );
  });
}
```

---

# HydratedRouter

`entry.client.tsx`에서 서버가 만든 HTML에 React를 연결할 때 사용한다.

```tsx
function HydratedRouter({
  getContext?,  // clientLoader/clientAction에 전달할 컨텍스트 팩토리
  onError?,     // 에러 핸들러
}: HydratedRouterProps)
```

### Props

**`getContext`**
`clientLoader`, `clientAction`에 전달할 컨텍스트를 만드는 팩토리 함수. 매 탐색/fetch마다 새 인스턴스를 생성한다.

```tsx
<HydratedRouter
  getContext={() => ({
    user: getCurrentUser(),
  })}
/>
```

**`onError`**
미들웨어, loader, action, 렌더 에러를 한 곳에서 처리한다.
`ErrorBoundary`와 달리 리렌더링 영향을 받지 않고 에러당 한 번만 실행되어 Sentry 같은 에러 리포팅 서비스에 적합하다.

```tsx
<HydratedRouter
  onError={(error, info) => {
    const { location, params, errorInfo } = info;
    console.error(error, location);
    reportToSentry(error, { location, errorInfo });
  }}
/>
```

### 사용 예시

```tsx
// entry.client.tsx
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

---

# 내부 동작 — 어떻게 상태를 공유하나

> 아래 내용은 [components.tsx 소스](https://github.com/remix-run/react-router/blob/dev/packages/react-router/lib/dom/ssr/components.tsx) 기반이다.

### 1단계 — ServerRouter가 HTML에 데이터를 심는다

`root.tsx`의 `<Scripts />` 컴포넌트가 서버에서 렌더링될 때, `routerContext`에서 추출한 데이터를 인라인 스크립트로 HTML에 삽입한다.

```typescript
// components.tsx 소스 발췌
let contextScript = staticContext
  ? `window.__reactRouterContext = ${serverHandoffString};${streamScript}`
  : " ";
```

결과적으로 브라우저가 받는 HTML에는 이런 스크립트가 포함된다.

```html
<script>
  window.__reactRouterContext = {
    /* loader 결과, 라우트 상태 등 직렬화된 서버 상태 */
  };
</script>
<script type="module">
  // fog-of-war(lazy) 모드일 때 라우트 매니페스트
  window.__reactRouterManifest = {
    "/": { js: "chunks/home-abc.js", hasLoader: true },
    "/dashboard": { js: "chunks/dashboard-xyz.js", hasLoader: true },
  };
  window.__reactRouterRouteModules = { /* 라우트 모듈 */ };

  // 클라이언트 entry 모듈 import → entry.client.tsx 실행
  import("/assets/entry.client-abc123.js");
</script>
```

### 2단계 — HydratedRouter가 window 데이터를 읽어 라우터를 초기화한다

`HydratedRouter`는 내부적으로 `window.__reactRouterContext`를 읽어 `createBrowserRouter`를 초기화한다.
서버 loader 결과가 이미 포함되어 있으므로 **loader를 다시 실행하지 않는다.**

```
window.__reactRouterContext 읽기
  → createBrowserRouter 초기화 (서버 데이터 주입)
  → FrameworkContext.Provider로 트리 감싸기
  → hydrateRoot가 서버 DOM에 React 이벤트 연결
```

서버가 만든 DOM을 그대로 유지하면서 이벤트만 연결하므로 깜빡임(FOUC)이 없다.

### 3단계 — hydration 완료 후 Scripts가 사라진다

소스에서 `isHydrated` 플래그를 관리한다.

```typescript
// components.tsx 소스 발췌
let isHydrated = false;
export function setIsHydrated() {
  isHydrated = true;
}

// Scripts 컴포넌트
React.useEffect(() => {
  setIsHydrated();
}, []);

// hydration 완료 후 Scripts는 null 반환
return isHydrated ? null : <> ... </>;
```

`isHydrated = true`가 되면 인라인 스크립트 태그들이 DOM에서 사라진다.
이후 탐색은 완전한 클라이언트 SPA처럼 동작한다.

---

# 전체 흐름 요약

```
1. 브라우저가 / 요청

2. 서버 (entry.server.tsx)
   → loader("/") 실행 → 데이터 수집
   → ServerRouter로 HTML 렌더링
   → <Scripts />가 window.__reactRouterContext에 loader 결과 직렬화하여 삽입
   → HTML 응답

3. 브라우저
   → HTML 표시 (React 없는 상태)
   → <script> 태그 실행 → entry.client.tsx import
   → hydrateRoot(<HydratedRouter />) 실행

4. HydratedRouter
   → window.__reactRouterContext 읽기
   → createBrowserRouter 초기화 (loader 재실행 없음)
   → 서버 DOM에 React 이벤트 연결
   → isHydrated = true → Scripts null 반환

5. 이후
   → /dashboard 클릭 → 클라이언트 라우팅 (서버 요청 없음)
   → loader("/dashboard") 클라이언트에서 fetch
   → 화면 업데이트
```
