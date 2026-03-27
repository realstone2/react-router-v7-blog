---
title: 'React Server Components'
date: '2026-03-27'
category: 'how-to'
order: 10
tags: ['react-router', 'rsc', 'server-components', 'vite', 'streaming']
description: 'React Router v7에서 React Server Components(RSC) 활성화, ServerComponent 라우트, "use client"/"use server" 디렉티브, 점진적 마이그레이션'
---

> 공식 문서: [https://reactrouter.com/how-to/react-server-components](https://reactrouter.com/how-to/react-server-components)
> React Router v7 기준 — **현재 unstable(실험적) API**

---

# 들어가며

React Server Components(RSC)는 컴포넌트를 서버에서만 실행하고, 직렬화된 React 트리(React Flight 프로토콜)를 클라이언트로 스트리밍하는 아키텍처다. HTML이 아니라 컴포넌트 트리를 보내기 때문에 클라이언트 React가 점진적으로 재구성할 수 있다.

React Router v7은 두 가지 방식으로 RSC를 지원한다:

1. **Framework Mode** — `unstable_reactRouterRSC` Vite 플러그인 사용
2. **Data Mode** — `@vitejs/plugin-rsc` 기반의 저수준 API

이 글은 Framework Mode 중심으로 설정 방법과 핵심 패턴을 정리한다.

---

# RSC 활성화

## 템플릿으로 시작

```bash
# Framework Mode
npx create-react-router@latest --template remix-run/react-router-templates/unstable_rsc-framework-mode

# Data Mode (Vite)
npx create-react-router@latest --template remix-run/react-router-templates/unstable_rsc-data-mode-vite
```

## Vite 설정 — Framework Mode

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

## Vite 설정 — Data Mode

```typescript
// vite.config.ts
import rsc from "@vitejs/plugin-rsc/plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    rsc({
      entries: {
        client: "src/entry.browser.tsx",
        rsc: "src/entry.rsc.tsx",
        ssr: "src/entry.ssr.tsx",
      },
    }),
  ],
});
```

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

RSC의 강력한 패턴 중 하나는 loader가 데이터 대신 **JSX(서버 컴포넌트)**를 반환하는 것이다:

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

데이터 직렬화/역직렬화 없이 서버에서 렌더링된 UI를 그대로 전달할 수 있다.

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

기존 코드가 `.server`/`.client` 파일 네이밍을 사용한다면 `vite-env-only` 플러그인으로 빠르게 마이그레이션할 수 있다.

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

- **미지원 기능**: SPA Mode, pre-rendering, custom build entries (안정 릴리스 전 지원 예정)
- 프로덕션 사용보다는 실험/피드백 단계
- 기존 Framework Mode나 Data/Declarative API 사용이 현재로서는 권장됨

그럼에도 RSC 아키텍처를 미리 파악하고 싶다면 unstable 템플릿으로 시작해보는 것을 추천한다.

---

# 정리

| 항목 | 내용 |
|---|---|
| 활성화 | `unstable_reactRouterRSC` + `@vitejs/plugin-rsc` |
| 서버 컴포넌트 라우트 | `ServerComponent` named export |
| 클라이언트 컴포넌트 | `"use client"` 디렉티브로 분리 |
| 서버 함수 | `"use server"` 디렉티브 |
| 경계 검증 | `"server-only"` / `"client-only"` import |
| 점진적 도입 | 중첩 라우트에서 서버/클라이언트 자유 혼합 |
| 현재 상태 | unstable — 실험적 |
