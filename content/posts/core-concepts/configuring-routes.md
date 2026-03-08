---
title: "Configuring Routes"
date: "2026-02-22"
description: "React Router v7의 라우트 설정 방법과 패턴"
tags: ["react-router", "routing"]
category: "core-concepts"
order: 1
---

> 공식 문서: [https://reactrouter.com/start/framework/routing](https://reactrouter.com/start/framework/routing)
> Next.js App Router와 비교하며 정리한 학습 노트

# 들어가며

React Router v7의 Framework Mode는 기존 Remix의 기능을 흡수한 풀스택 라우팅 시스템이다.
Next.js App Router에 익숙하다면, **"파일 구조 대신 코드로 라우트를 선언한다"** 는 차이를 먼저 이해하면 빠르게 적응할 수 있다.

---

# 1. Configuring Routes — 라우트 설정

## Next.js vs React Router v7

| | Next.js App Router | React Router v7 |
|---|---|---|
| 라우트 정의 방식 | 폴더/파일 구조 자체가 라우트 | `routes.ts` 파일에 명시적 선언 |
| 설정 파일 | 없음 (암묵적) | `app/routes.ts` (명시적) |

## Next.js

```javascript
app/
├── page.tsx          # /
├── about/
│   └── page.tsx      # /about
```

폴더를 만들면 자동으로 라우트가 생긴다. 직관적이지만 라우트 구조가 암묵적이다.

## React Router v7

```typescript
// app/routes.ts
import {
  type RouteConfig,
  route,
  index,
  layout,
  prefix,
} from "@react-router/dev/routes";

export default [
  index("./home.tsx"),
  route("about", "./about.tsx"),

  layout("./auth/layout.tsx", [
    route("login", "./auth/login.tsx"),
    route("register", "./auth/register.tsx"),
  ]),

  ...prefix("concerts", [
    index("./concerts/home.tsx"),
    route(":city", "./concerts/city.tsx"),
    route("trending", "./concerts/trending.tsx"),
  ]),
] satisfies RouteConfig;
```

라우트를 코드로 명시적으로 선언한다. 전체 라우트 구조가 `routes.ts` 한 파일에서 파악되므로 **가시성이 높다.**

> **파일 기반 라우팅이 익숙하다면?**
> `@react-router/fs-routes` 패키지를 사용하면 Next.js처럼 파일 기반 라우팅도 지원한다. 두 가지 방식을 혼합해서 사용하는 것도 가능하다.
>
> ```ts
> import { flatRoutes } from "@react-router/fs-routes";
>
> export default [
>   route("/", "./home.tsx"),
>   ...(await flatRoutes()), // 나머지는 파일 기반으로
> ] satisfies RouteConfig;
> ```

---

# 2. Route Modules — 라우트 모듈

각 라우트 파일(모듈)은 다양한 기능을 `export`하여 동작을 정의한다.

## Next.js

```typescript
// app/teams/[teamId]/page.tsx
// async 컴포넌트가 데이터 페칭 + 렌더링을 동시에 담당
export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const team = await fetchTeam(params.teamId);
  return <h1>{team.name}</h1>;
}
```

## React Router v7

```typescript
// app/routes/team.tsx
import type { Route } from "./+types/team";

// 데이터 페칭은 loader가 전담
export async function loader({ params }: Route.LoaderArgs) {
  const team = await fetchTeam(params.teamId);
  return { name: team.name };
}

// 컴포넌트는 렌더링만 담당 (항상 동기)
export default function Component({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData.name}</h1>;
}
```

## 핵심 차이

- Next.js: 컴포넌트가 데이터 페칭 + 렌더링을 함께 담당
- RR v7: **loader(데이터) / component(렌더링) 역할이 명확히 분리**
- `./+types/team` 파일은 빌드 시 자동 생성되며, `loaderData`와 `params`의 타입이 자동으로 추론된다

---

# 3. Nested Routes — 중첩 라우트

부모 라우트 안에 자식 라우트를 중첩시킬 수 있다. 부모의 URL 경로가 자식에 자동으로 포함된다.

```typescript
export default [
  route("dashboard", "./dashboard.tsx", [
    index("./home.tsx"),               // /dashboard
    route("settings", "./settings.tsx"), // /dashboard/settings
  ]),
] satisfies RouteConfig;
```

자식 라우트는 부모의 `<Outlet />`에 렌더링된다.

```typescript
// dashboard.tsx (부모)
import { Outlet } from "react-router";

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Outlet /> {/* home.tsx 또는 settings.tsx가 여기에 렌더링됨 */}
    </div>
  );
}
```

> Next.js의 `{children}`과 RR v7의 `<Outlet />`은 동일한 개념이다.
> Next.js는 파일 구조로 암묵적으로, RR v7은 `routes.ts`에서 명시적으로 결정된다.

---

# 4. Root Route — 루트 라우트

`app/root.tsx`는 모든 라우트의 최상위 조상이다. Next.js의 `app/layout.tsx`에 해당한다.

```typescript
// app/root.tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <Meta />   {/* meta export 적용 */}
        <Links />  {/* CSS 링크 */}
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
```

> Next.js와 달리 HTML 태그(`<html>`, `<head>`, `<body>`)를 직접 제어한다. 그만큼 HTML 레벨에서의 제어권이 더 크다.

---

# 5. Layout Routes — 레이아웃 라우트

URL에 경로 세그먼트를 추가하지 않으면서, 자식 라우트를 감싸는 레이아웃을 제공한다.

```typescript
export default [
  layout("./marketing/layout.tsx", [
    index("./marketing/home.tsx"),            // URL: /
    route("contact", "./marketing/contact.tsx"), // URL: /contact
  ]),

  ...prefix("projects", [
    index("./projects/home.tsx"),                       // URL: /projects
    layout("./projects/project-layout.tsx", [
      route(":pid", "./projects/project.tsx"),            // URL: /projects/:pid
      route(":pid/edit", "./projects/edit-project.tsx"), // URL: /projects/:pid/edit
    ]),
  ]),
] satisfies RouteConfig;
```

`layout()`은 URL 구조에는 관여하지 않고, **렌더링 구조(레이아웃)만 추가**한다.
Next.js에서 공통 레이아웃을 적용하려면 Route Group `(group)` 폴더를 만들어야 하지만, RR v7의 `layout()`은 폴더 구조 없이도 레이아웃을 자유롭게 구성할 수 있어 **더 유연하다.**

---

# 6. Index Routes — 인덱스 라우트

부모 라우트의 URL에서 기본으로 렌더링되는 자식 라우트다. "부모 Outlet의 기본값"이라고 이해하면 쉽다.

```typescript
export default [
  index("./home.tsx"),               // /

  route("dashboard", "./dashboard.tsx", [
    index("./dashboard-home.tsx"),   // /dashboard (기본)
    route("settings", "./dashboard-settings.tsx"), // /dashboard/settings
  ]),
] satisfies RouteConfig;
```

| | Next.js | React Router v7 |
|---|---|---|
| 인덱스 라우트 | 폴더 내 `page.tsx` | `index()` 함수 |

단, **index route는 자식 라우트를 가질 수 없다.**

---

# 7. Route Prefixes — 라우트 프리픽스

공통 경로 prefix를 공유하는 라우트들을 그룹핑할 때 사용한다. **새로운 라우트 트리를 만들지 않고, 단순히 자식들의 경로를 변경하는 역할**이다.

```typescript
// 아래 두 코드는 완전히 동일하다

// prefix 사용
prefix("parent", [
  route("child1", "./child1.tsx"),
  route("child2", "./child2.tsx"),
])

// prefix 미사용
[
  route("parent/child1", "./child1.tsx"),
  route("parent/child2", "./child2.tsx"),
]
```

## 실전 예시: 글로벌 서비스의 locale prefix

```typescript
export default [
  ...prefix(":locale", [
    index("./home.tsx"),                           // /:locale
    route("products", "./products/list.tsx"),       // /:locale/products
    route("products/:id", "./products/detail.tsx"), // /:locale/products/:id
  ]),
] satisfies RouteConfig;
```

```typescript
export async function loader({ params }: Route.LoaderArgs) {
  const { locale } = params; // "en", "ko", "ja" 등
  const products = await fetchProducts({ locale });
  return { products };
}
```

> `/en/products`, `/ko/products`, `/ja/products` 같은 locale 기반 URL 구조를 만들 때 `prefix(":locale", [...])` 패턴이 깔끔하게 적용된다.

---

# 8. Dynamic Segments — 동적 세그먼트

`:` 로 시작하는 세그먼트는 동적 파라미터가 된다.

```typescript
route("teams/:teamId", "./team.tsx"),
```

| | Next.js | React Router v7 |
|---|---|---|
| 동적 파라미터 | `[teamId]` 폴더명 | `:teamId` |
| 타입 | 직접 작성 | `+types`로 자동 추론 |

```typescript
import type { Route } from "./+types/team";

export async function loader({ params }: Route.LoaderArgs) {
  //                           ^? { teamId: string }  ← 자동 추론!
  const team = await fetchTeam(params.teamId);
  return { team };
}
```

다중 동적 세그먼트도 지원한다.

```typescript
route("c/:categoryId/p/:productId", "./product.tsx"),
// params → { categoryId: string; productId: string }
```

---

# 9. Optional Segments — 선택적 세그먼트

세그먼트 끝에 `?`를 붙이면 해당 세그먼트가 없어도 매칭된다.

```typescript
route(":lang?/categories", "./categories.tsx"),
// /categories      → 매칭 (lang = undefined)
// /ko/categories   → 매칭 (lang = "ko")

route("users/:userId/edit?", "./user.tsx"),
// /users/123       → 매칭
// /users/123/edit  → 매칭
```

| | Next.js | React Router v7 |
|---|---|---|
| 선택적 세그먼트 | `[[...slug]]` | `:param?` |

Next.js보다 훨씬 간결한 문법이다.

---

# 10. Splats — 와일드카드

`/*`로 끝나는 경로는 이후의 모든 URL을 매칭한다.

```typescript
route("files/*", "./files.tsx"),
// /files/a         → params["*"] = "a"
// /files/a/b/c     → params["*"] = "a/b/c"
```

```typescript
export async function loader({ params }: Route.LoaderArgs) {
  const { "*": splat } = params;
  return { path: splat };
}
```

404 Catch-all 라우트로도 활용할 수 있다.

```typescript
route("*", "./catchall.tsx");
```

```typescript
export function loader() {
  throw new Response("Page not found", { status: 404 });
}
```

---

# 11. relative() — 라우트 설정 파일 분리

라우트 수가 많아지면 `routes.ts` 하나가 비대해진다.
`relative()`를 사용하면 도메인별로 라우트 설정을 **여러 파일로 분리**할 수 있다.

```typescript
// app/routes.ts
import { type RouteConfig } from "@react-router/dev/routes";
import { authRoutes } from "./routes/auth.routes.ts";

export default [
  ...authRoutes,
] satisfies RouteConfig;
```

```typescript
// app/routes/auth.routes.ts
import { relative } from "@react-router/dev/routes";

const { route, layout, index } = relative(import.meta.dirname);

export const authRoutes = [
  layout("../auth/layout.tsx", [
    route("login", "../auth/login.tsx"),
    route("register", "../auth/register.tsx"),
  ]),
];
```

`relative(import.meta.dirname)`을 사용하면 해당 파일 위치 기준 상대 경로로 모듈을 참조할 수 있다.

---

# 12. 헬퍼 함수 선택 가이드

각 헬퍼가 **URL 세그먼트 추가 여부**와 **공통 UI 렌더링 여부**로 구분된다.

| 헬퍼 | URL 세그먼트 추가 | 공통 UI 렌더링 | loader/action |
|---|---|---|---|
| `route()` | O | O (Outlet) | O |
| `index()` | X | O (Outlet) | O |
| `layout()` | X | O (Outlet) | O |
| `prefix()` | O | X | X |
| `relative()` | — | — | — |

### layout() vs 중첩 route()

둘 다 공통 레이아웃을 `<Outlet />`으로 자식에게 제공한다. 차이는 URL에 세그먼트가 추가되느냐다.

```typescript
// 중첩 route() — URL에 "auth/"가 붙음
route("auth", "./auth/layout.tsx", [
  route("login", "./auth/login.tsx"),    // /auth/login
  route("register", "./auth/register.tsx"), // /auth/register
])

// layout() — URL에 아무것도 추가되지 않음
layout("./auth/layout.tsx", [
  route("login", "./auth/login.tsx"),    // /login
  route("register", "./auth/register.tsx"), // /register
])
```

> **URL에 경로도 추가해야 하면** 중첩 `route()`, **UI만 공유하고 URL은 그대로 두려면** `layout()`

### prefix() vs 중첩 route()

둘 다 URL에 공통 접두사를 추가한다. 차이는 라우트 트리에 부모 노드가 생기느냐다.

```typescript
// 중첩 route() — 부모 노드 생성, layout.tsx가 렌더링됨
route("concerts", "./concerts/layout.tsx", [
  index("./concerts/home.tsx"),          // /concerts
  route(":city", "./concerts/city.tsx"), // /concerts/:city
])

// prefix() — 부모 노드 없음, URL만 묶기
...prefix("concerts", [
  index("./concerts/home.tsx"),          // /concerts
  route(":city", "./concerts/city.tsx"), // /concerts/:city
])
```

> **공통 레이아웃이나 loader가 필요하면** 중첩 `route()`, **URL 그룹핑만 하려면** `prefix()`

---

# 13. Component Routes — 컴포넌트 라우트

`routes.ts` 밖에서, 컴포넌트 트리 내부에 직접 라우트를 선언하는 방식이다.

```typescript
import { Routes, Route } from "react-router";

function Wizard() {
  return (
    <div>
      <h1>Step Wizard</h1>
      <Routes>
        <Route index element={<StepOne />} />
        <Route path="step-2" element={<StepTwo />} />
        <Route path="step-3" element={<StepThree />} />
      </Routes>
    </div>
  );
}
```

> 이 방식은 Framework Mode의 핵심 기능(loader, action, code splitting, SSR)을 사용할 수 없다.
> 단계별 Wizard처럼 독립된 UI 내부의 간단한 라우팅에만 사용하고, 실제 페이지 라우팅은 항상 `routes.ts`에서 관리하는 것이 좋다.

---

# 정리

React Router v7 Framework Mode의 라우팅을 한 줄로 요약하면:

> **"라우트 구조는 `routes.ts`에 명시적으로, 라우트 동작은 각 모듈 파일에 분리해서"**

| 기능 | 함수 | Next.js 대응 |
|---|---|---|
| 기본 라우트 | `route()` | 폴더/page.tsx |
| 인덱스 라우트 | `index()` | page.tsx (폴더 내 기본) |
| 레이아웃 | `layout()` | layout.tsx / Route Groups |
| 경로 그룹 | `prefix()` | Route Groups `(group)` |
| 동적 파라미터 | `:param` | `[param]` |
| 선택적 세그먼트 | `:param?` | `[[...slug]]` |
| 와일드카드 | `/*` | `[...slug]` |
