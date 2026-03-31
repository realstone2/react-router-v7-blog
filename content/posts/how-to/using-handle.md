---
title: 'handle을 활용한 라우트 메타데이터'
date: '2026-03-31'
category: 'how-to'
order: 18
tags: ['react-router', 'handle', 'useMatches', 'breadcrumb', 'metadata']
description: 'React Router에서 handle export와 useMatches를 활용한 Breadcrumb, 라우트 메타데이터 전달 패턴'
---

> 공식 문서: [https://reactrouter.com/how-to/using-handle](https://reactrouter.com/how-to/using-handle)
> React Router v7 기준 — **Framework Mode 전용**

---

# 들어가며

라우트 컴포넌트는 자기 영역만 렌더링한다. 하지만 때로는 자식 라우트의 정보를 **부모나 조상 컴포넌트**에서 사용해야 할 때가 있다 — 대표적으로 Breadcrumb이다.

`handle` export는 라우트가 **임의의 메타데이터**를 노출하는 수단이고, `useMatches` hook은 현재 매칭된 모든 라우트의 `handle`을 수집하는 수단이다.

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ❌ |
| Declarative Mode | ❌ |

---

# handle 정의

라우트 모듈에서 `handle` 객체를 named export한다. `handle`은 React Router가 제공하는 특별한 기능이 아니라, 라우트가 **임의의 데이터를 자유롭게 노출**할 수 있는 통로다. Breadcrumb에 표시하고 싶은 라우트에만 넣으면 된다:

## 라우트 구조

```typescript
// app/routes.ts
import { route } from "@react-router/dev/routes";

export default [
  route("parent", "./routes/parent.tsx", [
    route("child", "./routes/child.tsx"),
  ]),
];
```

## 부모 라우트

```tsx
// app/routes/parent.tsx
import { Link } from "react-router";

export const handle = {
  breadcrumb: () => <Link to="/parent">Some Route</Link>,
};
```

## 자식 라우트

```tsx
// app/routes/child.tsx
import { Link } from "react-router";

export const handle = {
  breadcrumb: () => <Link to="/parent/child">Child Route</Link>,
};
```

---

# handle 사용 — useMatches

`useMatches()`는 현재 URL에 매칭된 **모든 라우트**의 정보를 배열로 반환한다. 각 항목에서 `handle`과 `data`(loader 데이터)에 접근할 수 있다.

```tsx
// app/root.tsx
import { useMatches, Outlet, Scripts, ScrollRestoration } from "react-router";

export function Layout({ children }) {
  const matches = useMatches();

  return (
    <html lang="en">
      <head>{/* ... */}</head>
      <body>
        <header>
          <ol>
            {matches
              .filter((match) => match.handle?.breadcrumb)
              .map((match, index) => (
                <li key={index}>
                  {match.handle.breadcrumb(match)}
                </li>
              ))}
          </ol>
        </header>
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
```

## 동작 흐름

사용자가 `/parent/child`에 접근하면:

**1단계: React Router가 URL에 매칭되는 라우트를 위에서부터 찾는다:**

```
root.tsx        → "/" 매칭          ✅
parent.tsx      → "/parent" 매칭     ✅
child.tsx       → "/parent/child" 매칭 ✅
```

**2단계: `useMatches()`가 매칭된 라우트를 배열로 반환한다:**

```typescript
const matches = useMatches();
// [
//   { id: "root",   handle: undefined,                    data: ... },
//   { id: "parent", handle: { breadcrumb: () => <Link> }, data: ... },
//   { id: "child",  handle: { breadcrumb: () => <Link> }, data: ... },
// ]
```

**3단계: `handle.breadcrumb`이 있는 라우트만 필터링한다:**

```typescript
matches.filter((match) => match.handle?.breadcrumb)
// root는 handle이 없으니 제외 → [parent, child]만 남음
```

**4단계: 각 breadcrumb 함수를 호출해서 JSX를 받는다:**

```typescript
match.handle.breadcrumb(match)
// parent → <Link to="/parent">Some Route</Link>
// child  → <Link to="/parent/child">Child Route</Link>
```

`match.handle.breadcrumb`은 라우트에서 정의한 **함수 자체**이고, `(match)`를 인자로 넘겨서 호출하면 JSX가 반환된다. `match`를 전달하는 이유는 `match.data`에서 loader 데이터에 접근할 수 있기 때문이다.

**결과:** `Some Route > Child Route`

## match 객체를 활용한 동적 Breadcrumb

`match.data`에서 loader 데이터를 읽으면 **DB에서 가져온 이름으로 breadcrumb을 동적 생성**할 수 있다:

```tsx
// app/routes/product.tsx
export const handle = {
  breadcrumb: (match) => (
    <Link to={`/products/${match.data.product.id}`}>
      {match.data.product.name}  {/* "나이키 에어맥스" */}
    </Link>
  ),
};
```

---

# 타입 안전성

`useMatches()`가 반환하는 `match.handle`의 타입은 `unknown`이다. React Router가 `handle`의 타입을 자동 생성하거나 강제하는 기능은 제공하지 않는다 — `handle`은 라우트마다 자유롭게 정의하는 객체이므로 프레임워크가 타입을 알 수 없기 때문이다.

모듈 확장(declaration merging)으로 `UIMatch`의 `handle` 타입을 선언하면 된다. 모든 라우트가 `handle`을 가지는 것은 아니므로 **전부 옵셔널**로 정의한다:

```typescript
// app/types.d.ts
import type { ReactNode } from "react";
import "react-router";

declare module "react-router" {
  interface UIMatch {
    handle?: {
      breadcrumb?: (match: UIMatch) => ReactNode;
      title?: string;
    };
  }
}
```

```tsx
// root.tsx에서 옵셔널 체이닝으로 안전하게 접근
matches
  .filter((match) => match.handle?.breadcrumb)
  .map((match) => match.handle?.breadcrumb?.(match))
```

> React Router의 타입 자동 생성(`typegen`)은 `loader`, `params`, `componentProps`에만 적용되며, `handle`에는 적용되지 않는다.

---

# Breadcrumb 외 활용 사례

`handle`은 breadcrumb에 국한되지 않는다. 자식 라우트의 정보를 부모에서 사용해야 하는 모든 패턴에 적용할 수 있다:

- **페이지 제목**: `handle.title`을 정의하고 레이아웃에서 `<title>` 렌더링
- **배경색/테마**: `handle.theme`으로 라우트별 테마 변경
- **액션 버튼**: `handle.actions`로 라우트별 헤더 버튼 구성

---

# 정리

| 항목 | 내용 |
|---|---|
| `handle` | 라우트가 노출하는 임의 메타데이터 객체 |
| `useMatches()` | 현재 매칭된 모든 라우트의 handle/data 수집 |
| 대표 패턴 | Breadcrumb, 페이지 제목, 라우트별 테마 |
| match 객체 | `match.handle`, `match.data`(loader 데이터) 접근 가능 |
| 타입 안전성 | 기본 `unknown` — 타입 가드 직접 작성 필요 |
