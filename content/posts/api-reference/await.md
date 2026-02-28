---
title: "<Await>"
date: "2026-02-22"
description: "loader의 Promise를 렌더링하는 Await 컴포넌트"
tags: ["react-router", "await", "streaming", "api"]
category: "api-reference"
order: 15
---

> 공식 문서: [https://reactrouter.com/api/components/Await](https://reactrouter.com/api/components/Await)
> Streaming SSR 노트의 API 참조용 — Props 상세 + 에러 처리 + 연관 훅

# 개요

`<Await>`는 loader에서 반환한 **미완료 Promise를 렌더링**하는 컴포넌트다.
Promise가 resolve되면 children을 렌더링하고, reject되면 `errorElement`을 렌더링한다.

> **반드시 `<React.Suspense>` 또는 `<React.SuspenseList>` 내부에서** 사용해야 한다.

```typescript
import { Await, useLoaderData } from "react-router";
import * as React from "react";

export async function loader() {
  const reviews = getReviews(); // await 안 함 → Promise 반환
  const book = await fetch("/api/book").then((res) => res.json()); // await 함 → 블로킹
  return { book, reviews };
}

function Book() {
  const { book, reviews } = useLoaderData();

  return (
    <div>
      <h1>{book.title}</h1>
      <p>{book.description}</p>

      <React.Suspense fallback={<ReviewsSkeleton />}>
        <Await
          resolve={reviews}
          errorElement={<div>Could not load reviews 😬</div>}
        >
          {(resolvedReviews) => <Reviews items={resolvedReviews} />}
        </Await>
      </React.Suspense>
    </div>
  );
}
```

---

# Props (AwaitProps)

## `resolve` (required)

loader에서 반환된 Promise를 전달한다. `loaderData`를 통해 접근한 값을 그대로 넘기면 된다.

```typescript
<Await resolve={reviews}> ... </Await>
// reviews: loader에서 await 하지 않고 반환한 Promise
```

## `children`

**두 가지 형태** 모두 지원한다.

### 1. 렌더 콜백 함수

```typescript
<Await resolve={reviews}>
  {(resolvedReviews) => <Reviews items={resolvedReviews} />}
</Await>
// Promise가 resolve되면 콜백으로 데이터 전달
```

### 2. React Element + `useAsyncValue`

```typescript
<Await resolve={reviews}>
  <Reviews />
</Await>

function Reviews() {
  const resolvedReviews = useAsyncValue(); // 가장 가까운 <Await>의 resolve된 값
  return <div>...</div>;
}
// 컴포넌트 분리가 필요할 때 유용
```

## `errorElement`

Promise가 reject되면 children 대신 렌더링된다.

```typescript
// 방법 1: 인라인 에러 UI
<Await
  resolve={reviews}
  errorElement={<div>Oops, failed to load</div>}
>
  <Reviews />
</Await>

// 방법 2: useAsyncError로 에러 구체화
<Await
  resolve={reviews}
  errorElement={<ReviewsError />}
>
  <Reviews />
</Await>

function ReviewsError() {
  const error = useAsyncError(); // reject된 에러 값
  return <div>Error loading reviews: {error.message}</div>;
}
```

> `errorElement`를 제공하지 않으면 reject된 값이 가장 가까운 route-level `ErrorBoundary`로 버블업된다.

---

# 타입 정의

```typescript
interface AwaitProps {
  resolve: TrackedPromise | any;   // 필수: loader에서의 Promise
  children:
    | React.ReactNode               // React Element
    | ((data: Awaited<any>) => React.ReactElement); // 렌더 콜백
  errorElement?: React.ReactNode;  // reject 시 표시할 UI
}
```

---

# 연관 훅

## `useAsyncValue`

`<Await>` 자식 컴포넌트에서 resolve된 값을 읽는다.

```typescript
function ProductVariants() {
  const variants = useAsyncValue(); // 가장 가까운 <Await>의 resolve 값
  return <div>...</div>;
}

<Await resolve={somePromise}>
  <ProductVariants />
</Await>
```

## `useAsyncError`

`<Await>`의 `errorElement` 내부에서 reject된 에러를 읽는다.

```typescript
function ReviewsError() {
  const error = useAsyncError();
  return <div>Error: {error.message}</div>;
}
```

---

# React 19에서의 대안

React 19에서는 `<Await>` 대신 `React.use()`를 쓸 수 있다.
단, **새 컴포넌트**에서 호출해야 Suspense가 트리거된다.

```typescript
// React 19
<React.Suspense fallback={<div>Loading...</div>}>
  <NonCriticalUI p={nonCriticalData} />
</React.Suspense>

function NonCriticalUI({ p }: { p: Promise<string> }) {
  const value = React.use(p); // <Await> 대체
  return <h3>{value}</h3>;
}

// ⚠️ 현재 컴포넌트에서 바로 React.use() 호출하면 Suspense 미트리거
```

---

# 에러 처리 우선순위

```javascript
Promise reject
  ↓
[1] <Await errorElement> → 에러가 여기서 소비됨
[2] 없으면 route-level ErrorBoundary로 버블업 → useRouteError로 접근
```

---

# TanStack Query와의 관계

TanStack Query를 쓰면 `<Await>`가 필요한 시나리오가 줄어든다.

| 시나리오 | 어떻게 |
|---|---|
| TanStack Query 없이 스트리밍 | `loader`에서 raw Promise 반환 → `<Await>` 필요 |
| TanStack Query와 함께 스트리밍 | `prefetchQuery` (non-blocking) → `useSuspenseQuery` → `<Await>` 불필요 |

> TQ를 쓰면 `prefetchQuery` + `useSuspenseQuery` + `<Suspense>` 조합으로
> `<Await>` 없이도 캐싱을 고려한 스트리밍이 가능하다. (자세한 내용은 Streaming SSR 노트 참조)
