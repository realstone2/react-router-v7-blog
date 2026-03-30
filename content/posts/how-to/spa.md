---
title: 'SPA (Single Page App) 모드'
date: '2026-03-31'
category: 'how-to'
order: 15
tags: ['react-router', 'spa', 'client-side', 'ssr', 'hydrate-fallback']
description: 'React Router Framework Mode에서 SPA 구축 — ssr:false 설정, HydrateFallback, clientLoader/clientAction, 정적 호스팅 배포'
---

> 공식 문서: [https://reactrouter.com/how-to/spa](https://reactrouter.com/how-to/spa)
> React Router v7 기준 — **Framework Mode 전용**

---

# 들어가며

SPA(Single Page App)는 서버에서 HTML을 매번 렌더링하지 않고, 클라이언트에서 모든 라우팅과 렌더링을 처리하는 방식이다.

React Router의 SPA Mode는 기존 SPA와 다른 점이 있다:

| | 기존 SPA | React Router SPA Mode |
|---|---|---|
| 초기 HTML | `<div id="root"></div>` (빈 페이지) | **빌드 타임에 root 라우트를 렌더링**한 HTML |
| 로딩 화면 | JS 로드 후에야 표시 | HTML에 포함되어 즉시 표시 |
| SSR 전환 | 코드 변경 필요 | `ssr: false`만 제거하면 전환 가능 |

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ❌ |
| Declarative Mode | ❌ |

---

# Step 1: 런타임 SSR 비활성화

```typescript
// react-router.config.ts
import { type Config } from "@react-router/dev/config";

export default {
  ssr: false,
} satisfies Config;
```

**주의:** `ssr: false`는 **런타임** 서버 렌더링만 비활성화한다. 빌드 타임에는 root 라우트를 서버 렌더링해서 `index.html`을 생성한다. 따라서 라우트 코드는 SSR-safe해야 한다 — 초기 렌더링에서 `window`나 브라우저 전용 API를 직접 사용하면 빌드 에러가 발생한다.

---

# Step 2: HydrateFallback과 Root Loader

## HydrateFallback

SPA에서 JS가 로드되기 전에 사용자에게 보여줄 화면을 `HydrateFallback`으로 정의한다. 이 컴포넌트는 **빌드 타임에 HTML로 렌더링**되어 `index.html`에 포함된다:

```tsx
// app/root.tsx
import LoadingScreen from "./components/loading-screen";

export function Layout() {
  return <html>{/* ... */}</html>;
}

export function HydrateFallback() {
  return <LoadingScreen />;
}

export default function App() {
  return <Outlet />;
}
```

## Root Loader (선택)

root 라우트에서 `loader`를 사용할 수 있다. 이 loader는 **빌드 타임에 실행**되며, `HydrateFallback`의 `loaderData`로 전달된다:

```tsx
import type { Route } from "./+types/root";

export async function loader() {
  return {
    version: await getVersion(),
  };
}

export function HydrateFallback({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>Loading version {loaderData.version}...</h1>
      <AwesomeSpinner />
    </div>
  );
}
```

**제약:** SPA Mode에서는 root 라우트 외의 다른 라우트에서 `loader`를 사용할 수 없다 (pre-rendering하는 경우 제외).

---

# Step 3: clientLoader와 clientAction 사용

서버 렌더링이 없으므로 데이터 로딩과 mutation은 `clientLoader`와 `clientAction`으로 처리한다:

```typescript
import type { Route } from "./+types/some-route";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const data = await fetch(`/some/api/stuff/${params.id}`);
  return data;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  return await processPayment(formData);
}
```

`loader`/`action`(서버)이 아닌 `clientLoader`/`clientAction`(브라우저)을 사용한다는 점에 주의한다.

---

# Step 4: 정적 호스팅 배포

`react-router build` 실행 후 `build/client` 디렉토리를 정적 호스팅에 배포한다. 서버 빌드는 생성되지 않는다.

## URL 리다이렉트 설정 필수

SPA는 모든 경로에서 `index.html`을 서빙해야 한다. 브라우저가 `/dashboard`를 직접 요청하면 서버에 `dashboard.html`이 없으므로 404가 발생하기 때문이다:

```
# _redirects (Netlify)
/*    /index.html   200
```

```nginx
# nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

404가 발생한다면 이 설정이 빠져 있을 가능성이 높다.

---

# SSR vs SPA 비교

| 항목 | SPA Mode (`ssr: false`) | SSR (기본) |
|---|---|---|
| 서버 빌드 | ❌ 없음 | ✅ 생성 |
| 런타임 SSR | ❌ | ✅ |
| 빌드 타임 root 렌더링 | ✅ | ✅ |
| root `loader` | ✅ (빌드 타임 실행) | ✅ (요청마다 실행) |
| 다른 라우트 `loader` | ❌ | ✅ |
| `clientLoader`/`clientAction` | ✅ | ✅ |
| 배포 대상 | 정적 호스팅 | Node.js / Edge 서버 |

---

# 정리

| 항목 | 내용 |
|---|---|
| 활성화 | `ssr: false` in `react-router.config.ts` |
| 초기 화면 | `HydrateFallback` (빌드 타임 렌더링) |
| 데이터 로딩 | `clientLoader` / `clientAction` |
| root loader | 빌드 타임에만 실행 |
| 배포 | `build/client` → 정적 호스팅 + URL 리다이렉트 설정 |
| SSR 전환 | `ssr: false` 제거만으로 전환 가능 |
