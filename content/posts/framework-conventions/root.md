---
title: "root.tsx — React Router의 문서 루트"
date: "2026-03-08"
description: "React Router Framework Mode의 유일한 필수 라우트, root.tsx의 역할과 핵심 패턴 정리"
tags: ["react-router", "framework-conventions", "root"]
category: "framework-conventions"
order: 1
---

> 공식 문서: [https://reactrouter.com/api/framework-conventions/root.tsx](https://reactrouter.com/api/framework-conventions/root.tsx)
> React Router v7 기준 (Framework Mode 전용)

---

# 들어가며

`root.tsx`는 React Router Framework Mode에서 **유일하게 반드시 존재해야 하는 라우트**다.
모든 라우트의 부모이며, `<html>`부터 시작하는 **전체 HTML 문서를 직접 렌더링**한다.

Next.js의 `layout.tsx`가 `<html>` 구조를 담당하는 것과 유사하지만,
root.tsx는 일반 라우트 모듈처럼 `loader`, `action`, `ErrorBoundary` 등을 모두 export할 수 있다는 점이 다르다.

---

# 1. 기본 구조

최소한의 root.tsx는 아래와 같다.

```tsx
import { Outlet, Scripts } from "react-router";
import "./app.css";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```

`<Outlet />`이 없으면 자식 라우트가 렌더링되지 않고,
`<Scripts />`가 없으면 클라이언트 사이드 JavaScript가 전혀 동작하지 않는다.

---

# 2. 필수 컴포넌트

root.tsx에서 렌더링해야 하는 컴포넌트들이다.

| 컴포넌트 | 역할 | 필수 여부 |
|---|---|---|
| `<Outlet />` | 자식 라우트 렌더링 | 필수 |
| `<Scripts />` | React Router 동작을 위한 JS 번들 삽입 | 필수 |
| `<ScrollRestoration />` | 클라이언트 전환 시 스크롤 위치 복원 | 권장 |
| `<Meta />` | 각 라우트의 `meta` export를 `<head>`에 삽입 | React 19 미사용 시 |
| `<Links />` | 각 라우트의 `links` export를 `<head>`에 삽입 | React 19 미사용 시 |

### React 19 이전 프로젝트

`<Meta />`와 `<Links />`를 `<head>` 안에 직접 배치해야 한다.

```tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

### React 19 프로젝트

컴포넌트 안에서 네이티브 `<title>`, `<meta>`, `<link>` 태그를 직접 사용할 수 있다.
React 19가 이를 자동으로 `<head>`로 호이스팅한다.

```tsx
export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* <Meta />, <Links /> 생략 가능 */}
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

---

# 3. Layout export — root.tsx 전용

root.tsx에만 존재하는 특수 export다. `App`, `HydrateFallback`, `ErrorBoundary` 세 컴포넌트가
모두 **같은 HTML 문서 구조(app shell)를 공유**해야 하는데, Layout 없이는 이를 세 곳에 반복해야 한다.

### Layout이 없을 때의 문제

```tsx
// Layout 없이 각각 선언 — HTML 구조 3번 반복
export default function App() {
  return (
    <html><head>...</head><body><Outlet /><Scripts /></body></html>
  );
}

export function HydrateFallback() {
  return (
    <html><head>...</head><body><p>Loading...</p><Scripts /></body></html>
  );
}

export function ErrorBoundary() {
  return (
    <html><head>...</head><body><p>Error!</p><Scripts /></body></html>
  );
}
```

### Layout으로 app shell 단일화

```tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

// HTML 문서 구조를 한 곳에서 관리
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return <p>Loading...</p>;
}

export function ErrorBoundary() {
  return <p>Something went wrong.</p>;
}
```

`App`, `HydrateFallback`, `ErrorBoundary`가 각자 `children`으로 Layout에 주입된다.
React가 Layout을 리마운트하지 않으므로 **스타일시트 깜빡임(FOUC)도 방지**된다.

---

# 4. Layout에서 데이터 접근 시 주의점

Layout 안에서 loader 데이터를 쓰고 싶을 때 **`useLoaderData()`를 사용하면 안 된다.**

이유: ErrorBoundary 상황에서는 loader가 실패했을 수 있어 데이터가 존재하지 않는다.
`useLoaderData()`는 loader가 항상 성공했다고 가정하므로, ErrorBoundary에서 호출하면 에러가 난다.

```tsx
// X — ErrorBoundary 상황에서 에러 발생 가능
export function Layout({ children }) {
  const data = useLoaderData(); // 위험
  ...
}
```

대신 `useRouteLoaderData("root")`를 사용한다. 데이터가 없을 수 있으므로 방어적으로 처리해야 한다.

```tsx
import { useRouteLoaderData, useRouteError } from "react-router";

export function Layout({ children }: { children: React.ReactNode }) {
  // undefined일 수 있음 — ErrorBoundary 상황 대비
  const data = useRouteLoaderData("root");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* loader 데이터를 CSS 변수로 주입 — 없으면 기본값 사용 */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root { --theme: ${data?.theme ?? "light"} }`,
          }}
        />
      </head>
      <body>
        {/* data가 있을 때만 Analytics 렌더링 */}
        {data ? <Analytics token={data.analyticsToken} /> : null}
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

**Layout 자체에서 에러가 나면 폴백할 방법이 없다.** React Router의 내장 최소 ErrorBoundary로 떨어지게 된다.
그래서 Layout은 항상 방어적으로 작성해야 한다.

---

# 5. 지원 Export 목록

root.tsx는 일반 라우트 모듈의 모든 export에 더해 `Layout`을 추가로 지원한다.

| Export | 설명 |
|---|---|
| `default` | 루트 컴포넌트 |
| `Layout` | 문서 쉘 래퍼 (root 전용) |
| `loader` | 서버 데이터 로딩 |
| `action` | 폼 제출 핸들러 |
| `ErrorBoundary` | 에러 UI |
| `HydrateFallback` | clientLoader 실행 중 초기 로딩 UI |
| `meta` | 메타 태그 |
| `links` | 링크 태그 |
| `handle` | `useMatches()`로 접근 가능한 커스텀 데이터 |

---

# 6. CSP(Content Security Policy) nonce 사용 시

nonce 기반 CSP를 적용하는 경우 `<Scripts />`와 `<ScrollRestoration />`에 nonce를 전달한다.

```tsx
<ScrollRestoration nonce={nonce} />
<Scripts nonce={nonce} />
```

nonce를 사용하지 않는다면 이 prop은 생략한다.

---

# 정리

| 개념 | 핵심 |
|---|---|
| root.tsx의 역할 | Framework Mode 유일한 필수 라우트, `<html>` 전체 소유 |
| 필수 컴포넌트 | `<Outlet />`, `<Scripts />` — 없으면 앱이 동작하지 않음 |
| `Layout` export | app shell 중복 제거 + FOUC 방지, root.tsx 전용 |
| 데이터 접근 | Layout 안에서는 `useLoaderData()` 금지, `useRouteLoaderData("root")` 사용 |
| 방어적 설계 | Layout은 ErrorBoundary 상황도 고려해 항상 방어적으로 작성 |
