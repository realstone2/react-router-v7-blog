---
title: "routes.ts — 라우트 설정 파일"
date: "2026-03-08"
description: "React Router Framework Mode의 라우트 설정 파일 routes.ts와 5가지 헬퍼 함수 정리"
tags: ["react-router", "framework-conventions", "routing"]
category: "framework-conventions"
order: 2
---

> 공식 문서: [https://reactrouter.com/api/framework-conventions/routes.ts](https://reactrouter.com/api/framework-conventions/routes.ts)
> React Router v7 기준 (Framework Mode 전용)

---

# 들어가며

`app/routes.ts`는 **URL 패턴과 라우트 모듈 파일을 연결**하는 설정 파일이다.
Framework Mode에서 root.tsx와 함께 반드시 존재해야 하는 파일이며, `RouteConfig` 배열을 export한다.

```typescript
import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("some/path", "./some/file.tsx"),
  //    ^URL 패턴      ^라우트 모듈 파일
] satisfies RouteConfig;
```

`satisfies RouteConfig`로 타입 안전성을 확보한다.

---

# 1. route() — 기본 라우트

가장 기본적인 헬퍼. URL 패턴과 모듈 파일을 매핑한다.

```typescript
import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("about", "./about.tsx"),
  route("dashboard", "./dashboard.tsx"),
] satisfies RouteConfig;
```

### 중첩 라우트

세 번째 인자로 자식 라우트 배열을 전달한다. 자식 경로는 부모 경로가 자동으로 앞에 붙는다.

```typescript
export default [
  route("dashboard", "./dashboard.tsx", [
    route("settings", "./dashboard-settings.tsx"),
    route("profile", "./dashboard-profile.tsx"),
  ]),
] satisfies RouteConfig;
```

| URL | 모듈 |
|---|---|
| `/dashboard` | `dashboard.tsx` |
| `/dashboard/settings` | `dashboard-settings.tsx` |
| `/dashboard/profile` | `dashboard-profile.tsx` |

자식 라우트는 부모의 `<Outlet />`을 통해 렌더링된다.

```typescript
// dashboard.tsx
import { Outlet } from "react-router";

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Outlet /> {/* settings 또는 profile이 렌더링됨 */}
    </div>
  );
}
```

---

# 2. index() — 인덱스 라우트

부모의 URL에서 기본으로 렌더링되는 라우트다. 별도 경로 세그먼트가 추가되지 않는다.

```typescript
import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("./home.tsx"),                      // / → home.tsx
  route("dashboard", "./dashboard.tsx", [
    index("./dashboard-home.tsx"),          // /dashboard → dashboard-home.tsx
    route("settings", "./dashboard-settings.tsx"), // /dashboard/settings
  ]),
] satisfies RouteConfig;
```

> **index vs route("")의 차이**
> `index()`는 부모와 정확히 같은 URL에서만 매칭된다.
> 자식이 있는 라우트에서 "아무 자식도 선택되지 않았을 때" 보여줄 기본 화면에 사용한다.
> index 라우트는 자식을 가질 수 없다.

---

# 3. layout() — 레이아웃 라우트

URL 세그먼트를 추가하지 않고 공통 UI를 감싸는 라우트다.
여러 페이지가 같은 레이아웃(헤더, 사이드바 등)을 공유할 때 사용한다.

```typescript
import { type RouteConfig, route, index, layout } from "@react-router/dev/routes";

export default [
  layout("./marketing/layout.tsx", [
    index("./marketing/home.tsx"),        // / → layout + home
    route("contact", "./marketing/contact.tsx"),  // /contact → layout + contact
  ]),
] satisfies RouteConfig;
```

`home.tsx`와 `contact.tsx`는 각각 `/`, `/contact`로 렌더링되지만 둘 다 `marketing/layout.tsx`의 `<Outlet />`을 통해 표시된다.

### prefix()와 함께 쓰는 패턴

```typescript
export default [
  ...prefix("projects", [
    index("./projects/home.tsx"),
    layout("./projects/project-layout.tsx", [
      route(":pid", "./projects/project.tsx"),
      route(":pid/edit", "./projects/edit-project.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
```

| URL | 모듈 |
|---|---|
| `/projects` | `projects/home.tsx` |
| `/projects/:pid` | `project-layout.tsx` + `project.tsx` |
| `/projects/:pid/edit` | `project-layout.tsx` + `edit-project.tsx` |

---

# 4. prefix() — 경로 접두사

부모 라우트 없이 공통 경로 접두사만 추가한다.
`layout()`이 공통 UI를 위한 것이라면, `prefix()`는 **공통 URL 경로만** 붙이기 위한 것이다.

```typescript
import { type RouteConfig, route, index, prefix } from "@react-router/dev/routes";

export default [
  ...prefix("concerts", [
    index("./concerts/home.tsx"),          // /concerts
    route(":city", "./concerts/city.tsx"), // /concerts/:city
    route("trending", "./concerts/trending.tsx"), // /concerts/trending
  ]),
] satisfies RouteConfig;
```

`prefix()`를 쓰지 않고 같은 결과를 만들려면 경로를 직접 반복해야 한다.

```typescript
// prefix() 없이 — 반복
route("concerts", "./concerts-layout.tsx", [
  index("./concerts/home.tsx"),
  route(":city", "./concerts/city.tsx"),
  route("trending", "./concerts/trending.tsx"),
])

// prefix() 사용 — 레이아웃 없이 경로만 묶기
...prefix("concerts", [
  index("./concerts/home.tsx"),
  route(":city", "./concerts/city.tsx"),
  route("trending", "./concerts/trending.tsx"),
])
```

> `prefix()`는 라우트 트리에 부모 노드를 추가하지 않는다.
> 중간에 레이아웃이 필요하면 `layout()`을 함께 사용한다.

---

# 5. relative() — 파일 경로 분리

라우트 설정을 여러 파일로 나눌 때 사용한다.
`relative(import.meta.dirname)`으로 파일 기준 상대 경로를 쓸 수 있다.

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

도메인별로 라우트 설정을 분리할 때 유용하다.

---

# 6. 동적 세그먼트

`:세그먼트명`으로 URL의 동적 부분을 캡처한다. 라우트 모듈에서 `params`로 접근한다.

```typescript
route("teams/:teamId", "./team.tsx")
route("c/:categoryId/p/:productId", "./product.tsx")
```

```typescript
import type { Route } from "./+types/team";

export async function loader({ params }: Route.LoaderArgs) {
  // params.teamId: string (자동 타입 추론)
  const team = await getTeam(params.teamId);
  return { team };
}
```

자동 생성된 `+types` 덕분에 params 타입이 정확하게 추론된다.

---

# 7. 선택적 세그먼트

`?`를 붙이면 해당 세그먼트가 없어도 매칭된다.

```typescript
route(":lang?/categories", "./categories.tsx")
// /categories        → params.lang = undefined
// /ko/categories     → params.lang = "ko"

route("users/:userId/edit?", "./user.tsx")
// /users/123         → params.userId = "123"
// /users/123/edit    → params.userId = "123"
```

---

# 8. 스플랫 라우트 (Catch-all)

`/*`로 이후의 모든 경로를 캡처한다. `params["*"]`로 접근한다.

```typescript
route("files/*", "./files.tsx")
// /files/a/b/c → params["*"] = "a/b/c"
```

```typescript
export async function loader({ params }: Route.LoaderArgs) {
  const { "*": splat } = params;
  return { filePath: splat };
}
```

패턴에 매칭되지 않는 모든 경로를 처리하는 404 라우트에도 활용한다.

```typescript
export default [
  // ... 다른 라우트들
  route("*", "./not-found.tsx"), // 모든 미매칭 경로
] satisfies RouteConfig;
```

```typescript
// not-found.tsx
export function loader() {
  throw new Response("Not Found", { status: 404 });
}
```

---

# 9. 파일 시스템 기반 라우팅

`@react-router/fs-routes` 패키지를 사용하면 파일명 규칙으로 라우트를 자동 생성할 수 있다.

```typescript
import { type RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default flatRoutes() satisfies RouteConfig;
```

수동 설정과 혼합도 가능하다.

```typescript
import { route, type RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [
  route("/", "./home.tsx"),        // 수동 설정
  ...(await flatRoutes()),         // 나머지는 파일 기반
] satisfies RouteConfig;
```

---

# 전체 예시

```typescript
import {
  type RouteConfig,
  route,
  index,
  layout,
  prefix,
} from "@react-router/dev/routes";

export default [
  index("./home.tsx"),                      // /
  route("about", "./about.tsx"),            // /about

  layout("./auth/layout.tsx", [
    route("login", "./auth/login.tsx"),     // /login (공통 레이아웃)
    route("register", "./auth/register.tsx"), // /register (공통 레이아웃)
  ]),

  ...prefix("concerts", [
    index("./concerts/home.tsx"),           // /concerts
    route(":city", "./concerts/city.tsx"),  // /concerts/:city
    route("trending", "./concerts/trending.tsx"), // /concerts/trending
  ]),

  route("*", "./not-found.tsx"),            // 404
] satisfies RouteConfig;
```

---

# 헬퍼 함수 비교

| 헬퍼 | URL 세그먼트 추가 | 공통 UI 렌더링 | loader/action | 용도 |
|---|---|---|---|---|
| `route()` | O | O (Outlet) | O | 일반 라우트 |
| `index()` | X | O (Outlet) | O | 부모 URL의 기본 화면 |
| `layout()` | X | O (Outlet) | O | 공통 레이아웃 래핑 |
| `prefix()` | O | X | X | URL 접두사만 묶기 |
| `relative()` | — | — | — | 설정 파일 분리 |

---

# 헷갈리는 경우 선택 가이드

### `layout()` vs 중첩 `route()`

둘 다 공통 UI(레이아웃)를 `<Outlet />`으로 자식에게 제공한다. 차이는 **URL에 세그먼트가 추가되느냐**다.

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

---

### `prefix()` vs 중첩 `route()`

둘 다 URL에 공통 접두사를 추가한다. 차이는 **라우트 트리에 부모 노드가 생기느냐**다.

```typescript
// 중첩 route() — "concerts" 부모 노드 생성, layout.tsx가 렌더링됨
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

### 세 가지 한눈에 비교

```
URL: /login, /register (layout 사용)
URL: /auth/login, /auth/register (중첩 route 사용)
URL: /concerts, /concerts/:city (prefix 또는 중첩 route 사용)
     └ 공통 레이아웃 필요 → 중첩 route
     └ URL만 묶기       → prefix
```
