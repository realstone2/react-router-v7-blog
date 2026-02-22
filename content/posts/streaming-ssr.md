---
title: "Streaming SSR with Suspense"
date: "2026-02-22"
description: "Streaming SSR과 TanStack Query 연계 패턴"
tags: ["react-router", "streaming", "ssr", "suspense", "tanstack-query"]
category: "core-concepts"
order: 11
---

> 공식 문서: [https://reactrouter.com/how-to/suspense](https://reactrouter.com/how-to/suspense)
> Data Loading 노트의 심화 주제 — TanStack Query 연계 관점으로 정리

# 개요

RR v7은 React Suspense와 함께 **Streaming SSR**을 지원한다.
핵심 아이디어는 간단하다.

> **`loader`에서 `await`하지 않은 Promise를 반환하면 → 서버가 HTML을 스트리밍한다**

중요 데이터(criticalData)는 `await`해서 첫 HTML에 포함시키고,
부수적인 데이터(nonCriticalData)는 Promise 그대로 반환해 나중에 스트리밍한다.

```javascript
[브라우저]
  ↓ 요청
[서버]
  ├─ criticalData await (300ms) → HTML 첫 청크 전송
  └─ nonCriticalData Promise 시작만 해둠
        ↓ 5초 후 완료 → 추가 HTML 청크 스트리밍
```

---

# RR v7 기본 Streaming 패턴

## 1. loader에서 Promise 반환

```typescript
import type { Route } from "./+types/my-route";

export async function loader({}: Route.LoaderArgs) {
  // await 안 함 → Promise 그대로 반환 → 스트리밍 대상
  const nonCriticalData = new Promise<string>((res) =>
    setTimeout(() => res("non-critical"), 5000)
  );

  // await 함 → 첫 HTML에 포함 (블로킹)
  const criticalData = await new Promise<string>((res) =>
    setTimeout(() => res("critical"), 300)
  );

  return { nonCriticalData, criticalData };
  // 단일 Promise는 반환 불가 — 반드시 객체(key-value) 형태로
}
```

## 2. `<Await>` + `<Suspense>`로 렌더링

```typescript
import * as React from "react";
import { Await } from "react-router";

export default function MyComponent({ loaderData }: Route.ComponentProps) {
  const { criticalData, nonCriticalData } = loaderData;

  return (
    <div>
      {/* criticalData: 첫 HTML에 포함, 즉시 렌더링 */}
      <h2>Critical: {criticalData}</h2>

      {/* nonCriticalData: Promise → Suspense 경계에서 스트리밍 */}
      <React.Suspense fallback={<div>Loading...</div>}>
        <Await resolve={nonCriticalData}>
          {(value) => <h3>Non critical: {value}</h3>}
        </Await>
      </React.Suspense>
    </div>
  );
}
```

## React 19에서는 `React.use`로 대체 가능

```typescript
// React 19
<React.Suspense fallback={<div>Loading...</div>}>
  <NonCriticalUI p={nonCriticalData} />
</React.Suspense>

function NonCriticalUI({ p }: { p: Promise<string> }) {
  const value = React.use(p); // Promise 언팩
  return <h3>Non critical: {value}</h3>;
}
// React.use는 새 컴포넌트에서 사용해야 Suspense 트리거됨
// 현재 컴포넌트에서 바로 쓰면 동작 안 함
```

## 타임아웃 설정

```typescript
// entry.server.tsx
// 기본값: 4950ms 후 미완료 Promise reject
export const streamTimeout = 10_000; // 10초로 연장
```

---

# Next.js와 비교

| | Next.js App Router | React Router v7 |
|---|---|---|
| Streaming 방식 | `loading.tsx` / `<Suspense>` / async 컴포넌트 | `loader`에서 미완료 Promise 반환 + `<Await>` |
| 중요 데이터 | async 컴포넌트에서 `await` | `loader`에서 `await` |
| 부수 데이터 | 하위 컴포넌트에서 별도 fetch | Promise를 `loaderData`로 전달 |
| 타임아웃 | 설정 없음 (서버에 따라 다름) | `streamTimeout` export로 제어 |
| React 19 | `use()` 네이티브 지원 | `<Await>` 또는 `React.use` 모두 가능 |

---

# TanStack Query와의 연계

여기서 중요한 질문:

> **TanStack Query를 쓰면서 Streaming SSR도 함께 활용할 수 있을까?**

**결론: 가능하다. 두 가지 접근 방식이 있다.**

---

## 방식 1 — loader에서 prefetch (non-blocking) + useSuspenseQuery

TanStack Query의 `prefetchQuery`는 Promise를 반환한다.
이걸 `await`하지 않고 반환하면 스트리밍 대상이 된다.

```typescript
import type { Route } from "./+types/product";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryClient } from "~/lib/queryClient";
import { productQuery, reviewsQuery } from "~/queries/product";

export async function loader({ params }: Route.LoaderArgs) {
  // 중요 데이터: await → 첫 HTML에 포함
  await queryClient.ensureQueryData(productQuery(params.pid));

  // 부수 데이터: await 안 함 → 스트리밍
  // prefetchQuery는 반환값이 void이므로 Promise 자체를
  // loaderData로 넘기기 어려움
  queryClient.prefetchQuery(reviewsQuery(params.pid)); // fire-and-forget

  return null;
}

export default function Product({ params }: Route.ComponentProps) {
  // 중요 데이터: 캐시에서 즉시
  const { data: product } = useSuspenseQuery(productQuery(params.pid));

  return (
    <div>
      <h1>{product.name}</h1>

      {/* 부수 데이터: Suspense 경계로 감싸 스트리밍 */}
      <React.Suspense fallback={<ReviewsSkeleton />}>
        <Reviews pid={params.pid} />
      </React.Suspense>
    </div>
  );
}

function Reviews({ pid }: { pid: string }) {
  // prefetchQuery로 시작해둔 fetch가 아직 진행 중이면 Suspend
  // 완료되면 캐시에서 즉시 읽음
  const { data: reviews } = useSuspenseQuery(reviewsQuery(pid));
  return <ReviewList items={reviews} />;
}
```

**흐름:**

```javascript
서버
  ├─ productQuery await (TQ 캐시 채움) → 첫 HTML 전송
  └─ reviewsQuery prefetch 시작만 (fire-and-forget)
        ↓ React 렌더
        ├─ <h1>제품명</h1> 즉시
        └─ <Reviews> → useSuspenseQuery → 아직 로딩 중이면 Suspend
              ↓ prefetch 완료 → 스트리밍
```

---

## 방식 2 — loader에서 Promise를 loaderData로 직접 전달 + `<Await>`

TanStack Query를 쓰지 않는 데이터나, 쿼리 결과를 스트리밍하고 싶을 때:

```typescript
export async function loader({ params }: Route.LoaderArgs) {
  // 중요 데이터: TanStack Query 캐시 채움
  await queryClient.ensureQueryData(productQuery(params.pid));

  // 부수 데이터: raw Promise를 loaderData에 담아 전달
  const reviewsPromise = fetchReviews(params.pid); // await 안 함

  return { reviewsPromise };
}

export default function Product({ loaderData, params }: Route.ComponentProps) {
  const { data: product } = useSuspenseQuery(productQuery(params.pid));
  const { reviewsPromise } = loaderData;

  return (
    <div>
      <h1>{product.name}</h1>
      <React.Suspense fallback={<ReviewsSkeleton />}>
        <Await resolve={reviewsPromise}>
          {(reviews) => <ReviewList items={reviews} />}
        </Await>
      </React.Suspense>
    </div>
  );
}
```

> **주의**: 이 방식의 `reviewsPromise` 데이터는 TanStack Query 캐시에 들어가지 않는다.
> 클라이언트 네비게이션 시 다시 fetch된다. 캐싱이 필요하면 방식 1을 쓰는 것이 좋다.

---

## 방식 선택 기준

| 상황 | 추천 방식 |
|---|---|
| 부수 데이터도 캐싱하고 싶다 | 방식 1 (prefetchQuery + useSuspenseQuery) |
| 단순히 스트리밍만 필요, 캐싱 불필요 | 방식 2 (raw Promise + `<Await>`) |
| TanStack Query 없이 스트리밍 | 방식 2 (공식 문서 기본 패턴) |

---

# useSuspenseQuery vs useQuery — SSR에서의 차이

| | `useQuery` | `useSuspenseQuery` |
|---|---|---|
| SSR 시 서버에서 실행 | 안 됨 (클라이언트에서만) | 됨 (서버에서도 실행) |
| Suspense 트리거 | 안 됨 (`isLoading` 직접 체크) | 됨 (자동으로 Suspense 발동) |
| 스트리밍 연계 | 안 됨 | 됨 |
| 타입 | `data: T \| undefined` | `data: T` (항상 존재) |

```typescript
// useQuery: SSR에서 서버 실행 안 됨, Suspense 미트리거
const { data, isLoading } = useQuery(productQuery(pid));
if (isLoading) return <Skeleton />;

// useSuspenseQuery: SSR + Streaming 모두 지원
const { data } = useSuspenseQuery(productQuery(pid));
// data는 항상 존재 (undefined 체크 불필요)
```

> TanStack Query + RR v7 스트리밍을 함께 쓸 땐 `useSuspenseQuery`를 기본으로 쓰자.

---

# 실전 패턴: 상품 상세 페이지

```typescript
// route("/:locale/products/:pid", "./product.tsx")
import type { Route } from "./+types/product";
import * as React from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryClient } from "~/lib/queryClient";
import { productQuery, reviewsQuery, relatedQuery } from "~/queries/product";

export async function loader({ params }: Route.LoaderArgs) {
  // 중요: 상품 정보 (첫 HTML에 반드시 포함)
  await queryClient.ensureQueryData(productQuery(params.pid, params.locale));

  // 부수: 리뷰, 연관 상품 (스트리밍 허용)
  queryClient.prefetchQuery(reviewsQuery(params.pid));
  queryClient.prefetchQuery(relatedQuery(params.pid));

  return null;
}

export default function ProductPage({ params }: Route.ComponentProps) {
  const { data: product } = useSuspenseQuery(
    productQuery(params.pid, params.locale)
  );

  return (
    <div>
      {/* 즉시 렌더링 (첫 HTML에 포함) */}
      <ProductInfo product={product} />

      {/* 스트리밍 1: 리뷰 */}
      <React.Suspense fallback={<ReviewsSkeleton />}>
        <ReviewsSection pid={params.pid} />
      </React.Suspense>

      {/* 스트리밍 2: 연관 상품 */}
      <React.Suspense fallback={<RelatedSkeleton />}>
        <RelatedProducts pid={params.pid} />
      </React.Suspense>
    </div>
  );
}

function ReviewsSection({ pid }: { pid: string }) {
  const { data: reviews } = useSuspenseQuery(reviewsQuery(pid));
  return <ReviewList items={reviews} />;
}

function RelatedProducts({ pid }: { pid: string }) {
  const { data: related } = useSuspenseQuery(relatedQuery(pid));
  return <ProductGrid items={related} />;
}
```

---

# SEO 고려사항

## 크롤러별 Streaming SSR 인식 차이

**결론: SEO가 필요한 데이터는 반드시 `await` 블로킹으로 첫 HTML에 포함시켜야 한다.**

| 크롤러 | JS 실행 | 스트리밍 대기 | 비고 |
|---|---|---|---|
| Googlebot | O | 일부 | 렌더링 대기열 있어 스트리밍 완료 전 크롤 끊길 수 있음 |
| Naver / Daum | X | X | `await` 데이터만 인식 |
| Bing | 부분 | X | 안전하게 `await` 권장 |
| SNS 미리보기 (OG) | X | X | `await` 데이터만 인식 |

Googlebot은 JS를 실행하지만, 렌더링이 크롤링과 분리된 2단계 프로세스라 스트리밍이 완료되기 전에 크롤이 끊길 수 있다. 글로벌 서비스에서 Naver 등 다른 검색엔진까지 고려하면 SEO 데이터는 `await`가 안전하다.

---

## `meta` export와의 연관성

`meta` export는 `loaderData`만 받을 수 있다. 스트리밍 데이터(`prefetchQuery` non-blocking)는 `meta`에서 접근 불가능하다.

```typescript
export function meta({ data }: Route.MetaArgs) {
  // loaderData가 null이면(await 안 했으면) meta에서 접근 불가
  return [
    { title: data?.product?.name },
    { name: "description", content: data?.product?.description },
    { property: "og:image", content: data?.product?.imageUrl },
  ];
}
```

즉, SEO에 필요한 데이터를 `meta`에서 활용하려면 `loader`에서 `await` → `return`하는 구조가 필수다.

---

## SEO 전략 판단 기준

| 데이터 | SEO 필요 여부 | 처리 방식 |
|---|---|---|
| 상품명, 설명, 가격 | O | `await` 블로킹 |
| OG 이미지, meta 태그 | O | `await` 블로킹 |
| 리뷰, 평점 | 보통 불필요 | `prefetchQuery` 스트리밍 |
| 연관 상품 | X | `prefetchQuery` 스트리밍 |
| 장바구니, 찜 상태 | X | `clientLoader` |

> **핵심 원칙**
> SEO 데이터 → `await` 블로킹 / UX 부수 데이터 → 스트리밍 / 개인화 데이터 → `clientLoader`

---

# 정리

| 개념 | 방법 |
|---|---|
| 첫 HTML에 포함 | `loader`에서 `await` |
| 스트리밍 (RR v7 기본) | `loader`에서 `await` 없이 Promise 반환 + `<Await>` |
| 스트리밍 (TanStack Query) | `prefetchQuery` (non-blocking) + `useSuspenseQuery` |
| 타임아웃 제어 | `entry.server.tsx`에서 `streamTimeout` export |
| React 19 | `<Await>` 대신 `React.use()` 사용 가능 |

> **핵심 한 줄**
> `await`하면 블로킹(첫 HTML), `await` 안 하면 스트리밍.
> TanStack Query와 함께 쓸 땐 `prefetchQuery` + `useSuspenseQuery` 조합이 정석.
