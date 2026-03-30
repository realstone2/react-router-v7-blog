---
title: 'React Server Components'
date: '2026-03-27'
category: 'how-to'
order: 10
tags: ['react-router', 'rsc', 'server-components', 'vite', 'streaming']
description: 'React Router v7에서 React Server Components(RSC) 활성화, ServerComponent 라우트, "use client"/"use server" 디렉티브, 빌드/배포, Custom Entry, 점진적 마이그레이션'
---

> 공식 문서: [https://reactrouter.com/how-to/react-server-components](https://reactrouter.com/how-to/react-server-components)
> React Router v7 기준 — **현재 unstable(실험적) API**

---

# 들어가며

React Server Components(RSC)는 컴포넌트를 서버에서만 실행하고, 직렬화된 React 트리(React Flight 프로토콜)를 클라이언트로 스트리밍하는 아키텍처다. HTML이 아니라 컴포넌트 트리를 보내기 때문에 클라이언트 React가 점진적으로 재구성할 수 있다.

React Router v7은 Framework Mode에서 `unstable_reactRouterRSC` Vite 플러그인을 통해 RSC를 지원한다. 이 글은 설정 방법과 핵심 패턴을 정리한다.

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ✅ |
| Declarative Mode | ❌ |

---

# RSC 활성화

## 템플릿으로 시작

```bash
npx create-react-router@latest --template remix-run/react-router-templates/unstable_rsc-framework-mode
```

## Vite 설정

RSC Framework Mode는 기존 Framework Mode와 **다른 Vite 플러그인**(`unstable_reactRouterRSC`)을 사용한다. `@vitejs/plugin-rsc`가 피어 의존성으로 필요하며, React Router RSC 플러그인 **뒤에** 배치해야 한다.

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { unstable_reactRouterRSC } from "@react-router/dev/vite";
import rsc from "@vitejs/plugin-rsc";

export default defineConfig({
  plugins: [
    unstable_reactRouterRSC(),
    rsc(),
  ],
});
```

필요한 의존성: `vite`, `@vitejs/plugin-react`, `@vitejs/plugin-rsc`

## 빌드 결과물과 서버 연결

`npm run build` 하면 두 폴더가 생성된다:

```
build/
├── client/    ← 브라우저용 정적 파일 (JS, CSS, 이미지)
└── server/
    └── index.js  ← 서버 핸들러
```

`build/server/index.js`는 **요청 핸들러 함수**를 default export한다:

```typescript
(request: Request) => Promise<Response>
```

여기서 `Request`/`Response`는 **Web Standard(Fetch API)** 객체다. 브라우저에서 `fetch()`를 사용할 때 다루는 바로 그 `Request`/`Response`와 동일한 표준이다.

### Web Standard vs Node.js 방식

HTTP를 다루는 API가 두 계열로 나뉜다:

```typescript
// Node.js 방식 (자체 API)
createServer((req, res) => {
  res.writeHead(200);
  res.end("<h1>Hello</h1>");
});

// Web Standard 방식 (Fetch API 기반)
function handler(request: Request): Response {
  return new Response("<h1>Hello</h1>");
}
```

같은 일을 하지만 객체 구조와 메서드가 전혀 다르다. Node.js는 2009년에 자체 API를 만들었고, 이후 브라우저 쪽에서 Fetch API 표준이 정해졌다. Deno, Bun, Cloudflare Workers 등 최신 런타임은 Web Standard를 채택했다.

React Router RSC 빌드는 Web Standard를 사용하므로, 런타임에 따라 연결 방식이 달라진다:

| 런타임 | Web Standard 지원 | 연결 방식 |
|---|---|---|
| Cloudflare Workers | ✅ | 그대로 사용 |
| Deno | ✅ | 그대로 사용 |
| Bun | ✅ | 그대로 사용 |
| Node.js (Express 등) | ❌ | `createRequestListener`로 변환 필요 |

### Express 연결 예시

Node.js의 Express는 Web Standard를 사용하지 않으므로, `@remix-run/node-fetch-server`의 `createRequestListener`가 Express의 `(req, res)` ↔ Web `(Request, Response)` 간 변환을 담당한다:

```typescript
import express from "express";
import requestHandler from "./build/server/index.js";
import { createRequestListener } from "@remix-run/node-fetch-server";

const app = express();

app.use(
  "/assets",
  express.static("build/client/assets", {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(express.static("build/client"));
app.use(createRequestListener(requestHandler));
app.listen(3000);
```

> 기존 Framework Mode(non-RSC)에서는 프리셋(`presets`)이 이 연결을 자동 처리해줬지만, RSC Mode에서는 프리셋이 아직 미지원이라 직접 구성해야 한다.

## Scripts 컴포넌트 제거

RSC 활성화 후, root layout에서 `<Scripts />` 컴포넌트를 **제거**해야 한다. RSC 페이로드에 스크립트가 자동 포함되기 때문이다.

---

# ServerComponent 라우트

기존 라우트는 `default export`로 클라이언트 컴포넌트를 내보낸다. RSC에서는 `ServerComponent`를 named export하면 해당 라우트가 서버 컴포넌트가 된다.

```tsx
// app/routes/home.tsx
import type { Route } from "./+types/route";
import { Outlet } from "react-router";
import { getMessage } from "./message";

export async function loader() {
  return { message: await getMessage() };
}

export function ServerComponent({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <h1>Server Component Route</h1>
      <p>Message from the server: {loaderData.message}</p>
      <Outlet />
    </>
  );
}
```

`ServerComponent`를 사용하면 `ErrorBoundary`, `HydrateFallback`, `Layout` 등 다른 라우트 컴포넌트도 서버 컴포넌트로 동작한다.

**loader 없이도 가능하다.** 서버 컴포넌트이므로 컴포넌트 내에서 직접 DB 접근이나 파일 시스템 호출을 할 수 있다:

```tsx
export async function ServerComponent() {
  const data = await db.query("SELECT * FROM posts");
  return <PostList posts={data} />;
}
```

---

# Loader에서 UI 반환

## 기존 방식의 문제: 직렬화/역직렬화

기존(non-RSC) loader는 서버에서 데이터를 가져온 뒤 클라이언트로 전달한다. 이때 React Router가 내부적으로 `JSON.stringify()`로 직렬화하고, 클라이언트에서 `JSON.parse()`로 역직렬화한다:

```
서버: DB 조회 → JavaScript 객체 → JSON.stringify() → 네트워크 전송
클라이언트: JSON 문자열 수신 → JSON.parse() → 컴포넌트에 전달
```

개발자가 직접 호출하지는 않지만, React Router가 loader 반환값을 HTML에 `<script>window.__remixContext = {...}</script>` 형태로 삽입하면서 이 변환이 일어난다.

문제는 `JSON.stringify()`가 모든 JavaScript 타입을 표현할 수 없다는 것이다:

```typescript
export async function loader() {
  return {
    createdAt: new Date(),          // Date 객체
    tags: new Set(["react", "rsc"]), // Set 객체
  };
}

// JSON.stringify() 결과:
// { "createdAt": "2026-03-31T00:00:00.000Z", "tags": {} }
//   Date → string으로 변환됨, Set → 빈 객체로 손실됨
```

정리하면:

- **타입 손실**: `Date` → `string`, `Set`/`Map` → `{}`, 함수/클래스 인스턴스는 에러
- **이중 비용**: 서버에서 `JSON.stringify()`, 클라이언트에서 `JSON.parse()` 연산이 양쪽에서 발생
- **타입 안전성 단절**: 서버의 TypeScript 타입이 JSON 변환을 거치면서 사라진다 (`Date`로 보냈는데 클라이언트에서는 `string`)

## RSC의 해결: JSX를 직접 반환

RSC에서는 loader가 데이터 대신 **렌더링된 서버 컴포넌트(JSX)**를 반환할 수 있다:

```tsx
export async function loader() {
  const posts = await db.query("SELECT * FROM posts");
  return {
    content: <PostList posts={posts} />,
  };
}

export function ServerComponent({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>Blog</h1>
      {loaderData.content}
    </div>
  );
}
```

`posts` 데이터가 `JSON.stringify()`를 거치는 것이 아니라, 서버에서 `<PostList>` 컴포넌트까지 실행한 뒤 **React Flight 프로토콜**(`renderToReadableStream`)로 직렬화된다. 클라이언트는 데이터를 해석할 필요 없이 완성된 UI 트리를 받아서 그대로 렌더링한다.

```
기존: 서버 → JSON.stringify(data) → 클라이언트 JSON.parse() → 컴포넌트 렌더링
RSC:  서버 → 컴포넌트 실행 → renderToReadableStream(React 트리) → 클라이언트는 그대로 표시
```

---

# "use client" 디렉티브

서버 컴포넌트 라우트에서 클라이언트 전용 기능(hooks, 이벤트 핸들러)이 필요하면 별도 파일로 분리하고 `"use client"` 디렉티브를 선언한다.

```tsx
// app/components/counter.tsx
"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

```tsx
// app/routes/home.tsx (서버 컴포넌트)
import { Counter } from "~/components/counter";

export function ServerComponent() {
  return (
    <>
      <h1>Home</h1>
      <Counter />
    </>
  );
}
```

서버 컴포넌트에서 `"use client"` 모듈을 import하면 해당 컴포넌트만 클라이언트에서 실행된다.

---

# "use server" 디렉티브 — Server Functions

클라이언트 컴포넌트에서 서버 로직을 호출할 때 사용한다.

```tsx
// app/actions/newsletter.ts
"use server";

export async function subscribe(formData: FormData) {
  const email = formData.get("email") as string;
  await db.newsletter.insert({ email });
}
```

```tsx
// app/components/subscribe-form.tsx
"use client";

import { subscribe } from "~/actions/newsletter";

export function SubscribeForm() {
  return (
    <form action={subscribe}>
      <input name="email" type="email" />
      <button type="submit">Subscribe</button>
    </form>
  );
}
```

---

# 서버/클라이언트 경계 관리

## server-only / client-only

`.server`/`.client` 파일 네이밍 컨벤션 대신 `@vitejs/plugin-rsc`가 제공하는 `"server-only"`/`"client-only"` import을 사용한다. 런타임 에러가 아닌 **빌드 타임 검증**을 제공한다.

```typescript
// 이 모듈은 서버에서만 import 가능 — 클라이언트에서 import하면 빌드 에러
import "server-only";

export function getSecretKey() {
  return process.env.SECRET_KEY;
}
```

## 기존 .server/.client 파일 마이그레이션

기존 코드가 `.server`/`.client` 파일 네이밍을 사용한다면 `vite-env-only` 플러그인의 `denyImports`로 빠르게 마이그레이션할 수 있다:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { denyImports } from "vite-env-only";
import { unstable_reactRouterRSC as reactRouterRSC } from "@react-router/dev/vite";
import rsc from "@vitejs/plugin-rsc";

export default defineConfig({
  plugins: [
    denyImports({
      client: { files: ["**/.server/*", "**/*.server.*"] },
    }),
    reactRouterRSC(),
    rsc(),
  ],
});
```

---

# Custom Entry Files

RSC는 내부적으로 3단계 파이프라인으로 동작한다:

```
① RSC 서버: 서버 컴포넌트 실행 → Flight 페이로드 생성
② SSR 서버: Flight 페이로드 → HTML로 변환
③ 브라우저: HTML 표시 + hydration
```

각 단계의 **시작점(진입점)**이 Entry File이다. React Router가 기본 파일을 제공하므로 보통은 신경 쓸 필요 없지만, 각 단계의 동작을 커스텀하고 싶을 때(로깅, 인증 체크, 모니터링 SDK 초기화 등) `app` 디렉토리에 해당 파일을 만들면 오버라이드할 수 있다:

| 파일 | 담당 단계 | 하는 일 |
|---|---|---|
| `app/entry.rsc.ts(x)` | ① RSC 서버 | 서버 컴포넌트를 실행하고 Flight 페이로드를 만듦 |
| `app/entry.ssr.ts(x)` | ② SSR 서버 | Flight 페이로드를 받아서 HTML로 렌더링 |
| `app/entry.client.tsx` | ③ 브라우저 | HTML을 받아서 hydration 수행 |

## 기본 오버라이드 패턴

기본 엔트리를 import한 뒤 로깅 등 커스텀 로직을 추가하는 방식이다:

```typescript
// app/entry.rsc.ts — 커스텀 RSC 엔트리 (로깅 추가)
import defaultEntry from "@react-router/dev/config/default-rsc-entries/entry.rsc";
import { RouterContextProvider } from "react-router";

export default {
  fetch(request: Request): Promise<Response> {
    console.log("Custom RSC entry handling request:", request.url);
    const requestContext = new RouterContextProvider();
    return defaultEntry.fetch(request, requestContext);
  },
};

if (import.meta.hot) {
  import.meta.hot.accept();
}
```

```typescript
// app/entry.ssr.ts — 커스텀 SSR 엔트리
import { generateHTML as defaultGenerateHTML } from "@react-router/dev/config/default-rsc-entries/entry.ssr";

export function generateHTML(
  request: Request,
  serverResponse: Response,
): Promise<Response> {
  console.log("Custom SSR entry generating HTML for:", request.url);
  return defaultGenerateHTML(request, serverResponse);
}
```

```typescript
// app/entry.client.tsx — 커스텀 클라이언트 엔트리
import "@react-router/dev/config/default-rsc-entries/entry.client";
```

기본 엔트리 소스를 직접 확인하려면 IDE에서 import 경로에 "Go to Definition"을 사용한다.

---

# 점진적 마이그레이션

React Router RSC의 가장 큰 장점은 **점진적 도입**이 가능하다는 것이다.

- 중첩 라우트에서 클라이언트 라우트와 서버 라우트를 **자유롭게 혼합** 가능
- 부모 라우트가 클라이언트여도 자식 라우트는 서버 컴포넌트일 수 있고, 그 반대도 가능
- 팀별로 독립적으로 RSC를 도입할 수 있다

```
routes/
├── root.tsx              ← 클라이언트 라우트
├── dashboard.tsx         ← 서버 컴포넌트 라우트 (ServerComponent)
│   ├── settings.tsx      ← 클라이언트 라우트
│   └── analytics.tsx     ← 서버 컴포넌트 라우트
└── about.tsx             ← 클라이언트 라우트
```

기존 Framework Mode 사용자는 RSC로 전환할 때 **별도 마이그레이션이 필요 없다**(seamless transition).

---

# 현재 상태와 제한사항

React Router RSC는 아직 **unstable** API다:

- 프로덕션 사용보다는 실험/피드백 단계
- 아래 설정 옵션들은 RSC Framework Mode에서 **아직 미지원**이다 (안정 릴리스 전 지원 예정):

| 미지원 옵션 | 설명 |
|---|---|
| `ssr: false` | SPA Mode |
| `prerender` | 사전 렌더링 |
| `presets` | 프리셋 |
| `buildEnd` | 빌드 후처리 |
| `routeDiscovery` | 라우트 디스커버리 |
| `serverBundles` | 서버 번들 분리 |
| `future.v8_splitRouteModules` | 라우트 모듈 분할 |
| `future.unstable_subResourceIntegrity` | SRI 지원 |

그럼에도 RSC 아키텍처를 미리 파악하고 싶다면 unstable 템플릿으로 시작해보는 것을 추천한다.

---

# 정리

| 항목 | 내용 |
|---|---|
| 활성화 | `unstable_reactRouterRSC` + `@vitejs/plugin-rsc` |
| 빌드 결과물 | `(request: Request) => Promise<Response>` 핸들러 |
| 서버 컴포넌트 라우트 | `ServerComponent` named export |
| 클라이언트 컴포넌트 | `"use client"` 디렉티브로 분리 |
| 서버 함수 | `"use server"` 디렉티브 |
| 경계 검증 | `"server-only"` / `"client-only"` import |
| Custom Entry | `entry.rsc.ts`, `entry.ssr.ts`, `entry.client.tsx` |
| 점진적 도입 | 중첩 라우트에서 서버/클라이언트 자유 혼합 |
| 현재 상태 | unstable — 실험적 |
