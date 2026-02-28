---
title: "Route Module"
date: "2026-02-22"
description: "React Router v7 라우트 모듈의 구조와 exports"
tags: ["react-router", "route-module"]
category: "core-concepts"
order: 2
---

> 공식 문서: [https://reactrouter.com/start/framework/route-module](https://reactrouter.com/start/framework/route-module)
> Next.js App Router와 비교하며 정리한 학습 노트

# 들어가며

라우트 모듈은 React Router v7 Framework Mode의 핵심이다.
`routes.ts`에서 참조하는 각 파일이 바로 라우트 모듈이며, 하나의 파일 안에서 데이터 로딩, 뮤테이션, 에러 처리, SEO 등 **페이지에 필요한 모든 것을 export로 정의**한다.

```typescript
route("teams/:teamId", "./team.tsx"),
//           route module ^^^^^^^^
```

라우트 모듈이 담당하는 것들:

- 자동 코드 스플리팅
- 데이터 로딩 (loader / clientLoader)
- 데이터 변경 (action / clientAction)
- 미들웨어 (middleware / clientMiddleware)
- 에러 처리 (ErrorBoundary)
- 로딩 UI (HydrateFallback)
- SEO (meta, links)
- HTTP 헤더 (headers)
- 재검증 제어 (shouldRevalidate)

---

# 1. Component (default export) — 기본 컴포넌트

`default export`가 해당 라우트가 매칭될 때 렌더링될 컴포넌트다.

## Next.js

```typescript
// app/teams/[teamId]/page.tsx
export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const team = await fetchTeam(params.teamId); // 컴포넌트 안에서 직접 fetch
  return <h1>{team.name}</h1>;
}
```

## React Router v7

```typescript
import type { Route } from "./+types/team";

export default function MyRouteComponent({ loaderData, params }: Route.ComponentProps) {
  return <h1>{loaderData.name} — {params.teamId}</h1>;
}
```

컴포넌트는 **항상 동기**이며, 아래 props를 자동으로 받는다.

| Props | 설명 |
|---|---|
| `loaderData` | `loader` 함수가 반환한 데이터 |
| `actionData` | `action` 함수가 반환한 데이터 |
| `params` | URL 동적 파라미터 |
| `matches` | 현재 라우트 트리의 모든 매치 배열 |

> `useLoaderData()`, `useParams()` 같은 훅 대신 props로 받는 게 권장된다.
> `+types`로 자동 생성된 타입 덕분에 props가 정확하게 타입 추론되기 때문이다.

---

# 2. loader — 서버 사이드 데이터 페칭

컴포넌트가 렌더링되기 전에 서버에서 데이터를 가져온다. **서버에서만 실행**된다.

## Next.js

```typescript
// app/products/[id]/page.tsx
// async 컴포넌트가 데이터 페칭을 직접 담당
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetchProduct(params.id);
  return <div>{product.name}</div>;
}
```

## React Router v7

```typescript
import type { Route } from "./+types/product";

// 데이터 페칭은 loader가 전담 (서버에서만 실행)
export async function loader({ params, request }: Route.LoaderArgs) {
  const product = await fetchProduct(params.id);
  if (!product) throw new Response("Not Found", { status: 404 });
  return { product };
}

// 컴포넌트는 loaderData로 데이터를 받아 렌더링만 담당
export default function ProductPage({ loaderData }: Route.ComponentProps) {
  return <div>{loaderData.product.name}</div>;
}
```

### 핵심 차이

- Next.js: async 컴포넌트가 직접 fetch → 데이터 + 렌더링 혼재
- RR v7: loader(데이터) ↔ component(렌더링) **역할 완전 분리** → 테스트, 유지보수 용이
- loader에서 `throw new Response()`로 HTTP 에러를 명시적으로 처리할 수 있다

---

# 3. clientLoader — 클라이언트 사이드 데이터 페칭

loader는 서버 전용인 반면, clientLoader는 **브라우저에서만 실행**된다.
서버 loader와 함께 사용하거나 단독으로 사용 가능하다.

```typescript
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  // 캐시 확인
  const cached = productCache.get(params.id);
  if (cached) return cached;

  // 캐시 없으면 서버 loader 호출
  const data = await serverLoader();
  productCache.set(params.id, data);
  return data;
}
```

### 초기 hydration 참여

```typescript
export async function clientLoader() {
  const data = await loadFromLocalStorage();
  return data;
}
clientLoader.hydrate = true as const;
// as const → hydrate 타입이 boolean이 아닌 true로 추론됨
// → React Router가 loaderData 타입을 정확하게 파생할 수 있음
```

> TanStack Query의 `stale-while-revalidate` 패턴과 유사하다.
> serverLoader로 서버 데이터를 받고, 클라이언트 캐시 레이어를 직접 구성할 수 있다.

---

# 4. action — 서버 사이드 데이터 변경

`<Form>`, `useFetcher`, `useSubmit`으로 호출되며, action 완료 후 페이지의 **모든 loader가 자동 재검증**된다.

## Next.js — Server Action

```typescript
// 컴포넌트 안에 "use server" 인라인
export default function Page() {
  async function handleSubmit(formData: FormData) {
    "use server";
    await createTodo(formData.get("title"));
    redirect("/list");
  }
  return (
    <form action={handleSubmit}>
      <input name="title" />
      <button type="submit">추가</button>
    </form>
  );
}
```

## React Router v7

```typescript
import { Form } from "react-router";

export async function loader() {
  const items = await fakeDb.getItems();
  return { items };
}

export async function action({ request }: Route.ActionArgs) {
  const data = await request.formData();
  await fakeDb.addItem({ title: data.get("title") });
  return { ok: true };
  // action 완료 → loader 자동 재실행 → UI 자동 업데이트
}

export default function Items({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <List items={loaderData.items} />
      <Form method="post">
        <input type="text" name="title" />
        <button type="submit">Create Todo</button>
      </Form>
    </div>
  );
}
```

### 핵심 차이

- Next.js Server Action: `"use server"` 지시어로 컴포넌트 내부에 인라인
- RR v7 action: 모듈 레벨에서 독립적으로 선언, **Web 표준 HTTP/form 기반**
- **action 완료 후 loader 자동 재검증** — 별도 상태 관리 없이 UI가 최신 데이터로 갱신됨

---

# 5. clientAction — 클라이언트 사이드 데이터 변경

action의 클라이언트 버전. 브라우저에서만 실행된다.

```typescript
export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  // 클라이언트 캐시 무효화
  invalidateClientCache();
  // 필요시 서버 action도 호출 가능
  const data = await serverAction();
  return data;
}
```

---

# 6. middleware — 서버 미들웨어

문서/데이터 요청 전후로 서버에서 순차 실행된다. 로깅, 인증, 응답 후처리에 활용한다.
`next()` 함수가 체인을 계속 진행시키며, 리프 라우트에서 loader/action을 실행한다.

## 로깅 미들웨어

```typescript
async function loggingMiddleware({ request, context }, next) {
  console.log(`${request.method} ${request.url}`);
  const start = performance.now();
  const response = await next();
  console.log(`Response ${response.status} (${performance.now() - start}ms)`);
  return response;
}

export const middleware = [loggingMiddleware];
```

## 인증 미들웨어

```typescript
async function authMiddleware({ request, context }) {
  const session = await getSession(request);
  const userId = session.get("userId");

  if (!userId) throw redirect("/login");

  const user = await getUserById(userId);
  context.set(userContext, user); // loader에서 context로 user 접근 가능
}

export const middleware = [authMiddleware];
```

> **Next.js의 `middleware.ts`와 비교**
> Next.js는 프로젝트 루트의 `middleware.ts` 단일 파일에서 전역 미들웨어를 처리하지만,
> RR v7은 **라우트별로 미들웨어를 선언**할 수 있어 더 세밀한 제어가 가능하다.

---

# 7. clientMiddleware — 클라이언트 미들웨어

middleware의 클라이언트 버전. 브라우저 내비게이션 시 실행된다.
Response를 반환하지 않는다는 점이 서버 middleware와의 차이다.

```typescript
async function loggingMiddleware({ request, context }, next) {
  console.log(`${request.method} ${request.url}`);
  const start = performance.now();
  await next(); // Response 반환 없음
  console.log(`(${performance.now() - start}ms)`);
  // return 없음
}

export const clientMiddleware = [loggingMiddleware];
```

---

# 8. ErrorBoundary — 에러 처리

loader, action, 컴포넌트 어디서든 에러가 발생하면 컴포넌트 대신 ErrorBoundary가 렌더링된다.

## Next.js

```typescript
// app/products/[id]/error.tsx (별도 파일)
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <p>{error.message}</p>
      <button onClick={reset}>다시 시도</button>
    </div>
  );
}
```

## React Router v7

```typescript
// 같은 라우트 파일 안에서 export
import { isRouteErrorResponse, useRouteError } from "react-router";

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    // loader에서 throw new Response("Not Found", { status: 404 }) 했을 때
    return (
      <div>
        <h1>{error.status} {error.statusText}</h1>
        <p>{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <pre>{error.stack}</pre>
      </div>
    );
  }

  return <h1>Unknown Error</h1>;
}
```

### 핵심 차이

- Next.js: 별도 `error.tsx` 파일에 분리
- RR v7: **같은 라우트 파일에서 export** → 라우트 단위 응집도가 높다
- `isRouteErrorResponse(error)`: loader에서 throw한 Response인지 판별
- `error instanceof Error`: 일반 JS 에러인지 판별

---

# 9. HydrateFallback — 초기 로딩 UI

clientLoader가 있을 때, 초기 페이지 로드 시 clientLoader가 완료될 때까지 컴포넌트 대신 렌더링된다.

## Next.js

```typescript
// app/game/loading.tsx (별도 파일)
export default function Loading() {
  return <GameSkeleton />;
}
```

## React Router v7

```typescript
export async function clientLoader() {
  const data = await loadFromLocalStorage();
  return data;
}

// clientLoader 실행 중에 보여줄 UI
export function HydrateFallback() {
  return <p>Loading Game...</p>;
}

export default function Component({ loaderData }) {
  return <Game data={loaderData} />;
}
```

> Next.js `loading.tsx`가 더 간단하지만, RR v7은 clientLoader와 명시적으로 연결되어
> **언제 로딩 UI를 보여줄지 더 세밀하게 제어**할 수 있다.

---

# 10. meta — SEO 메타 태그

`<head>`의 메타 태그를 정의한다. loader 데이터를 재사용할 수 있어 추가 fetch가 필요 없다.

## Next.js

```typescript
// generateMetadata는 loader와 별개로 데이터를 다시 fetch해야 하는 경우가 있음
export async function generateMetadata({ params }: { params: { id: string } }) {
  const product = await fetchProduct(params.id); // 또 한 번 fetch
  return { title: product.name };
}
```

## React Router v7 — loader 데이터 재사용

```typescript
// loader가 이미 가져온 데이터를 meta에서 바로 재사용
export function meta({ data }: Route.MetaArgs) {
  return [
    { title: data.product.name },
    { property: "og:title", content: data.product.name },
    { name: "description", content: data.product.description },
    { property: "og:image", content: data.product.imageUrl },
  ];
}
```

> React 19부터는 컴포넌트 안에 `<title>`, `<meta>` 태그를 직접 쓰는 방식도 권장된다.
>
> ```tsx
> export default function MyRoute() {
>   return (
>     <div>
>       <title>Very cool app</title>
>       <meta property="og:title" content="Very cool app" />
>     </div>
>   );
> }
> ```

**주의**: 마지막으로 매칭된 라우트의 meta가 사용되며, 부모 라우트의 meta를 오버라이드한다.
전체 meta 배열이 **교체(replace)**되며 병합(merge)되지 않는다.

---

# 11. links — CSS/리소스 링크

각 라우트에서 필요한 `<link>` 태그를 정의한다. `<Links />` 컴포넌트를 통해 `<head>`에 삽입된다.

```typescript
export function links() {
  return [
    { rel: "icon", href: "/favicon.png", type: "image/png" },
    { rel: "stylesheet", href: "https://example.com/styles.css" },
    { rel: "preload", href: "/images/banner.jpg", as: "image" }, // 이미지 preload
  ];
}
```

> **라우트별 CSS 스코핑**에 유용하다.
> 특정 페이지에서만 필요한 스타일시트를 해당 라우트의 `links()`에 선언하면
> 그 페이지에 진입할 때만 로드되고 이탈하면 제거된다.

---

# 12. headers — HTTP 응답 헤더

서버 렌더링 시 HTTP 응답 헤더를 정의한다.

```typescript
export function headers() {
  return {
    "Cache-Control": "max-age=300, s-maxage=3600", // CDN 캐싱
    "X-Custom-Header": "hello",
  };
}
```

> 글로벌 커머스 서비스에서 **CDN 캐시 제어**에 직접 활용할 수 있다.
> 상품 상세 페이지는 `s-maxage=3600`으로 CDN에 캐싱하고,
> 재고/가격처럼 자주 바뀌는 데이터는 `no-cache`로 설정하는 식이다.

---

# 13. handle — 라우트 커스텀 데이터

`useMatches()`를 통해 접근 가능한 라우트별 임의 데이터를 정의한다. 브레드크럼, 네비게이션 활성 상태 등에 활용한다.

```typescript
export const handle = {
  breadcrumb: "상품 상세",
  navKey: "products",
};
```

```typescript
// 레이아웃 컴포넌트에서 모든 매치의 handle 접근
import { useMatches } from "react-router";

export default function Layout() {
  const matches = useMatches();
  const breadcrumbs = matches
    .filter(match => match.handle?.breadcrumb)
    .map(match => match.handle.breadcrumb);

  return (
    <div>
      <Breadcrumb items={breadcrumbs} />
      <Outlet />
    </div>
  );
}
```

---

# 14. shouldRevalidate — 재검증 제어

Framework Mode + SSR에서는 내비게이션/폼 제출 후 **모든 loader가 자동으로 재검증**된다.
(Data Mode와의 차이점)

특정 라우트의 loader가 불필요하게 재실행되는 걸 막고 싶을 때 사용한다.

```typescript
import type { ShouldRevalidateFunctionArgs } from "react-router";

export function shouldRevalidate(arg: ShouldRevalidateFunctionArgs) {
  // 같은 라우트 내에서의 이동이면 재검증 스킵
  if (arg.currentUrl.pathname === arg.nextUrl.pathname) {
    return false;
  }
  return true;
}
```

> TanStack Query의 `staleTime`과 유사한 역할이다.
> 불필요한 서버 요청을 줄여 성능을 최적화할 수 있다.

---

# 라우트 모듈 전체 구조 요약

하나의 라우트 파일에서 export할 수 있는 것들을 모두 모으면:

```typescript
import type { Route } from "./+types/my-route";

// 서버 미들웨어
export const middleware = [authMiddleware];

// 클라이언트 미들웨어
export const clientMiddleware = [loggingMiddleware];

// 서버 데이터 페칭
export async function loader({ params, request }: Route.LoaderArgs) { ... }

// 클라이언트 데이터 페칭 (+ 캐싱)
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) { ... }
clientLoader.hydrate = true as const;

// 서버 데이터 변경
export async function action({ request }: Route.ActionArgs) { ... }

// 클라이언트 데이터 변경
export async function clientAction({ serverAction }: Route.ClientActionArgs) { ... }

// SEO
export function meta({ data }: Route.MetaArgs) { return [...]; }

// CSS/리소스 링크
export function links() { return [...]; }

// HTTP 헤더
export function headers() { return {...}; }

// 커스텀 라우트 데이터
export const handle = { breadcrumb: "페이지명" };

// 재검증 제어
export function shouldRevalidate(arg) { return true; }

// 에러 처리
export function ErrorBoundary() { ... }

// 초기 로딩 UI (clientLoader 있을 때)
export function HydrateFallback() { return <Skeleton />; }

// 컴포넌트 (항상 동기)
export default function Component({ loaderData, actionData, params }: Route.ComponentProps) {
  return <div>...</div>;
}
```

---

# 정리 — Next.js와 비교표

| 기능 | React Router v7 | Next.js 대응 |
|---|---|---|
| 서버 데이터 페칭 | `loader` | `async` 컴포넌트 / `fetch` |
| 클라이언트 데이터 페칭 | `clientLoader` | `useEffect` / SWR / TanStack Query |
| 데이터 변경 | `action` | Server Action (`"use server"`) |
| 클라이언트 변경 | `clientAction` | 클라이언트 fetch 함수 |
| 서버 미들웨어 | `middleware` (라우트별) | `middleware.ts` (전역) |
| 에러 처리 | `ErrorBoundary` (같은 파일) | `error.tsx` (별도 파일) |
| 로딩 UI | `HydrateFallback` | `loading.tsx` (별도 파일) |
| SEO 메타 | `meta` (loader 데이터 재사용) | `generateMetadata` (별도 fetch) |
| CSS 링크 | `links` | `import './styles.css'` |
| HTTP 헤더 | `headers` | `next.config.js` / Route Handler |
| 커스텀 데이터 | `handle` | 없음 (별도 구현 필요) |
| 재검증 제어 | `shouldRevalidate` | `revalidate` / `revalidatePath` |
