---
title: "Data Loading"
date: "2026-02-22"
description: "React Router v7에서 loader를 사용한 데이터 로딩 패턴"
tags: ["react-router", "data-loading", "loader"]
category: "core-concepts"
order: 4
---

> 공식 문서: [https://reactrouter.com/start/framework/data-loading](https://reactrouter.com/start/framework/data-loading)
> 참고: [TkDodo - React Query meets React Router](https://tkdodo.eu/blog/react-query-meets-react-router)
> **TanStack Query를 함께 사용하는 관점**으로 정리한 학습 노트

# 들어가며

> "React Router is not a cache. React Router is about *when*, data caching libs are about *what*."
> — Ryan Florence (Remix 팀)

RR v7의 `loader` / `clientLoader`는 **언제** 데이터를 fetch할지를 담당하고,
TanStack Query는 **무엇을** 캐싱하고 유지할지를 담당한다.

두 개는 경쟁 관계가 아니라 **역할이 명확히 다른 보완 관계**다.

| 역할 | 담당 | 설명 |
|---|---|---|
| 데이터 패칭 타이밍 | React Router `loader` | 컴포넌트 렌더 전, 라우트 진입 시 미리 실행 |
| 캐싱 / 재검증 | TanStack Query | staleTime, refetchOnWindowFocus, 백그라운드 갱신 |

---

# 왜 loader만으로는 부족한가

`loader`만 쓸 때의 문제는 **캐시가 없다**는 것이다.

```javascript
상품 목록 → 상품 A 상세 → 뒤로가기 → 상품 A 상세
```

이 흐름에서 `loader`만 쓰면 상품 A 상세를 **두 번 모두 서버에 fetch**한다.
TanStack Query의 `staleTime`이 있었다면 두 번째 방문에서 캐시를 즉시 보여주고 백그라운드에서만 갱신할 수 있었을 것이다.

---

# 기본 세팅

## QueryClient 모듈 분리

RR v7의 `loader`는 훅이 아니라 일반 함수이므로 `useQueryClient()`를 쓸 수 없다.
따라서 QueryClient를 모듈로 분리해서 import해서 쓴다.

> **SSR 환경 주의**: 서버에서 모듈 수준 QueryClient를 공유하면 **요청 간 캐시가 섞인다**.
> CSR(SPA) 환경이라면 아래처럼 모듈 싱글톤으로 써도 안전하다.
> SSR 환경이라면 요청마다 새 인스턴스를 생성하는 구조가 필요하다.

```typescript
// app/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      gcTime: 1000 * 60 * 10,   // 10분
    },
  },
});
```

## Query Options 함수 패턴

`loader`와 컴포넌트에서 동일한 queryKey / queryFn을 재사용하기 위해 `queryOptions()`로 분리한다.

```typescript
// app/queries/product.ts
import { queryOptions } from "@tanstack/react-query";
import { getProduct } from "~/api/products";

export const productQuery = (pid: string) =>
  queryOptions({
    queryKey: ["products", "detail", pid],
    queryFn: () => getProduct(pid),
    staleTime: 1000 * 60 * 5,
  });

export const productsQuery = queryOptions({
  queryKey: ["products", "list"],
  queryFn: () => getProducts(),
});
```

## root.tsx에 QueryClientProvider 추가

```typescript
// app/root.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "~/lib/queryClient";

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

# 1. Client Data Loading — clientLoader + TanStack Query

`ssr: false` (SPA 모드)이거나 특정 라우트만 클라이언트에서 fetch하고 싶을 때 쓴다.

## 패턴: clientLoader에서 ensureQueryData

```typescript
// route("products/:pid", "./product.tsx")
import type { Route } from "./+types/product";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "~/lib/queryClient";
import { productQuery } from "~/queries/product";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  // 캐시에 데이터가 있으면 fetch 없이 즉시 반환
  // 없으면 fetch 후 캐시에 저장
  await queryClient.ensureQueryData(productQuery(params.pid));
  return null; // 컴포넌트에서 useQuery로 직접 접근
}

export function HydrateFallback() {
  return <div>Loading...</div>;
}

export default function Product({ params }: Route.ComponentProps) {
  // loaderData 대신 useQuery로 데이터 접근
  // → TanStack Query의 캐싱, refetch, 상태 관리를 그대로 누릴 수 있다
  const { data: product } = useQuery(productQuery(params.pid));
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  );
}
```

**핵심 흐름**

```javascript
라우트 진입
  ↓
clientLoader 실행 → ensureQueryData
  ├─ 캐시 HIT (staleTime 이내): fetch 없이 즉시 반환
  └─ 캐시 MISS: fetch → 캐시 저장 후 반환
  ↓
component 렌더링 → useQuery (캐시에서 즉시 읽음)
```

## 기존 useEffect 방식과 비교

```typescript
// ❌ 기존: useEffect + useState (워터폴 위험)
export default function Product({ params }) {
  const [product, setProduct] = useState(null);
  useEffect(() => {
    fetch(`/api/products/${params.pid}`)
      .then(r => r.json())
      .then(setProduct);
  }, [params.pid]);
  if (!product) return <div>Loading...</div>;
  return <h1>{product.name}</h1>;
}
```

```typescript
// ✅ RR v7 + TanStack Query: 컴포넌트 렌더 전에 미리 fetch
export async function clientLoader({ params }) {
  await queryClient.ensureQueryData(productQuery(params.pid));
  return null;
}
export default function Product({ params }) {
  const { data } = useQuery(productQuery(params.pid)); // 항상 데이터 있음
  return <h1>{data.name}</h1>;
}
```

`useEffect` 방식은 컴포넌트가 마운트된 후 fetch를 시작하지만,
`clientLoader` 방식은 컴포넌트 렌더 **전**에 fetch를 시작한다. 워터폴 없음.

---

# 2. Server Data Loading — loader + TanStack Query (SSR)

SSR 환경에서 TanStack Query를 쓸 때의 핵심 패턴이다.

## 패턴: loader에서 prefetchQuery, 컴포넌트에서 useQuery

```typescript
// route("products/:pid", "./product.tsx")
import type { Route } from "./+types/product";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "~/lib/queryClient";
import { productQuery } from "~/queries/product";

export async function loader({ params }: Route.LoaderArgs) {
  // 서버: SSR 시 TanStack Query 캐시를 미리 채워둔다
  // prefetchQuery: 이미 캐시에 있어도 항상 await하지 않음 (non-blocking)
  // ensureQueryData: 캐시에 없을 때만 fetch (blocking)
  await queryClient.ensureQueryData(productQuery(params.pid));
  return null;
}

export default function Product({ params }: Route.ComponentProps) {
  const { data: product } = useQuery(productQuery(params.pid));
  // SSR 시: loader가 캐시를 채웠으므로 즉시 data 접근 가능
  // 클라이언트 네비게이션 시: 캐시 HIT이면 즉시, MISS면 background fetch
  return (
    <div>
      <h1>{product.name}</h1>
    </div>
  );
}
```

## prefetchQuery vs ensureQueryData 선택 기준

| | `prefetchQuery` | `ensureQueryData` |
|---|---|---|
| 캐시 HIT 시 | 아무것도 안 함 | 캐시 데이터 반환 |
| 캐시 MISS 시 | fetch 후 캐시 저장 (반환값 없음) | fetch 후 캐시 저장 후 반환 |
| loader에서 await | fire-and-forget 가능 | blocking (완료 보장) |
| 용도 | 병렬 prefetch (렌더 전에 시작만) | 렌더 전에 반드시 데이터 필요 |

```typescript
export async function loader({ params }: Route.LoaderArgs) {
  // 상품 상세: 반드시 있어야 함 → ensureQueryData (await)
  await queryClient.ensureQueryData(productQuery(params.pid));

  // 연관 상품: 있으면 좋지만 없어도 됨 → prefetchQuery (non-blocking)
  queryClient.prefetchQuery(relatedProductsQuery(params.pid));

  return null;
}
```

## TkDodo 원본 패턴 (fetchQuery 버전)

```typescript
// loader가 null 대신 직접 데이터를 반환하는 방식
export const loader =
  (queryClient: QueryClient) =>
  async ({ params }: Route.LoaderArgs) => {
    const query = productQuery(params.pid);
    // 캐시에 있으면 캐시 반환, 없으면 fetch
    return (
      queryClient.getQueryData(query.queryKey) ??
      (await queryClient.fetchQuery(query))
    );
  };

// 이렇게 하면 loaderData도 쓸 수 있지만
// 컴포넌트에서 useQuery를 별도로 쓰는 게 TanStack Query 이점을 더 잘 활용함
```

---

# 3. Static Data Loading — prerender + TanStack Query

Pre-rendering 시에도 동일한 query 함수를 재사용할 수 있다.

```typescript
// route("products/:pid", "./product.tsx")
import type { Route } from "./+types/product";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "~/lib/queryClient";
import { productQuery } from "~/queries/product";

export async function loader({ params }: Route.LoaderArgs) {
  // 빌드 타임에 queryFn 실행 → HTML 생성
  await queryClient.ensureQueryData(productQuery(params.pid));
  return null;
}

export default function Product({ params }: Route.ComponentProps) {
  // 빌드 타임: 캐시 데이터로 렌더링
  // 브라우저 Hydration 후: 동일 queryKey로 캐시 재사용
  const { data: product } = useQuery(productQuery(params.pid));
  return <h1>{product.name}</h1>;
}
```

```typescript
// react-router.config.ts
export default {
  async prerender() {
    const products = await getProducts();
    return products.map(p => `/products/${p.id}`);
  },
} satisfies Config;
```

---

# 4. loader + clientLoader 함께 사용 — 캐시 레이어 추가

`loader`(SSR)와 `clientLoader`(이후 네비게이션)를 함께 쓰면
**초기 SSR은 서버에서, 이후 네비게이션은 TanStack Query 캐시에서** 가져오는 구조를 만들 수 있다.

```typescript
import type { Route } from "./+types/product";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "~/lib/queryClient";
import { productQuery } from "~/queries/product";

// 초기 SSR 시 실행
export async function loader({ params }: Route.LoaderArgs) {
  await queryClient.ensureQueryData(productQuery(params.pid));
  return null;
}

// 클라이언트 네비게이션 시 실행 (SSR 이후)
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  // TanStack Query 캐시가 살아있으면 즉시 반환 (fetch 없음)
  // staleTime 지났으면 백그라운드 갱신
  await queryClient.ensureQueryData(productQuery(params.pid));
  return null;
}

export default function Product({ params }: Route.ComponentProps) {
  const { data: product } = useQuery(productQuery(params.pid));
  return <h1>{product.name}</h1>;
}
```

**흐름 정리**

```javascript
초기 페이지 로드
  → loader 실행 (서버)
  → TanStack Query 캐시 채움
  → SSR HTML 생성
  → Hydration

이후 클라이언트 네비게이션
  → clientLoader 실행
  → ensureQueryData → 캐시 HIT: 즉시 / MISS: fetch
  → useQuery가 캐시에서 읽음
```

---

# 5. 여러 쿼리 병렬 프리페치

중첩 라우트나 여러 데이터가 필요한 페이지에서 병렬 fetch를 하려면:

```typescript
export async function loader({ params }: Route.LoaderArgs) {
  // 반드시 필요한 데이터는 await
  await queryClient.ensureQueryData(productQuery(params.pid));

  // 있으면 좋은 데이터는 non-blocking으로 병렬 시작
  queryClient.prefetchQuery(reviewsQuery(params.pid));
  queryClient.prefetchQuery(relatedProductsQuery(params.pid));

  return null;
}
```

또는 둘 다 필수라면 `Promise.all`:

```typescript
export async function loader({ params }: Route.LoaderArgs) {
  await Promise.all([
    queryClient.ensureQueryData(productQuery(params.pid)),
    queryClient.ensureQueryData(reviewsQuery(params.pid)),
  ]);
  return null;
}
```

---

# action 후 쿼리 무효화 — invalidateQueries

action이 완료되면 RR v7은 자동으로 loader를 재실행한다.
하지만 TanStack Query 캐시는 별도로 무효화해줘야 한다.

```typescript
// action.tsx
import { queryClient } from "~/lib/queryClient";

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  await updateProduct(params.pid, Object.fromEntries(formData));

  // TanStack Query 캐시 무효화 → 다음 useQuery 시 refetch
  await queryClient.invalidateQueries({ queryKey: ["products"] });

  return null;
}
```

---

# 정리: RR v7 + TanStack Query 역할 분담

| 관심사 | 담당 | 방법 |
|---|---|---|
| 데이터 조기 fetch (SSR/네비) | React Router `loader` | `ensureQueryData` / `prefetchQuery` |
| 캐싱 / stale 판단 | TanStack Query | `staleTime`, `gcTime` |
| 백그라운드 갱신 | TanStack Query | `refetchOnWindowFocus` 등 |
| 컴포넌트에서 데이터 접근 | TanStack Query | `useQuery` |
| 데이터 변경 후 캐시 초기화 | TanStack Query | `invalidateQueries` |

> **핵심 패턴 한 줄 요약**
> `loader`/`clientLoader`에서 `ensureQueryData`로 캐시를 채우고,
> 컴포넌트에서는 `useQuery`로 캐시를 읽는다.
> loader는 타이밍, TanStack Query는 캐싱을 맡는다.
