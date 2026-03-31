---
title: 'Suspense 스트리밍'
date: '2026-03-31'
category: 'how-to'
order: 17
tags: ['react-router', 'suspense', 'streaming', 'await', 'loader']
description: 'React Router에서 Suspense를 활용한 스트리밍 — loader에서 Promise 반환, Await 컴포넌트, streamTimeout 설정'
---

> 공식 문서: [https://reactrouter.com/how-to/suspense](https://reactrouter.com/how-to/suspense)
> React Router v7 기준

---

# 들어가며

React Router는 기본적으로 모든 loader를 **await한 뒤** 컴포넌트를 렌더링한다. 하지만 비핵심 데이터까지 기다리면 초기 렌더링이 느려진다.

Suspense 스트리밍을 사용하면 **핵심 데이터만 기다리고, 비핵심 데이터는 나중에 도착하면 채워넣을** 수 있다.

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ✅ |
| Declarative Mode | ❌ |

---

# 1. Loader에서 Promise 반환

비핵심 데이터는 `await` **하지 않고** Promise 그대로 반환한다:

```tsx
import type { Route } from "./+types/my-route";

export async function loader({}: Route.LoaderArgs) {
  // 비핵심 데이터 — await 안 함!
  let nonCriticalData = new Promise((res) =>
    setTimeout(() => res("non-critical"), 5000),
  );

  // 핵심 데이터 — await로 기다림
  let criticalData = await new Promise((res) =>
    setTimeout(() => res("critical"), 300),
  );

  return { nonCriticalData, criticalData };
}
```

`criticalData`는 300ms 후 준비되면 즉시 렌더링하고, `nonCriticalData`는 5초 뒤에 도착해도 된다.

**주의:** Promise를 단독으로 반환할 수 없다. 반드시 객체의 프로퍼티로 감싸야 한다.

---

# 2. Suspense + Await로 렌더링

`<React.Suspense>`가 로딩 fallback을 보여주고, `<Await>`가 Promise를 기다렸다가 결과를 렌더링한다:

```tsx
import * as React from "react";
import { Await } from "react-router";

export default function MyComponent({
  loaderData,
}: Route.ComponentProps) {
  const { criticalData, nonCriticalData } = loaderData;

  return (
    <div>
      <h1>Streaming example</h1>
      {/* 핵심 데이터는 즉시 표시 */}
      <h2>Critical data value: {criticalData}</h2>

      {/* 비핵심 데이터는 로딩 중 fallback → 완료 후 결과 표시 */}
      <React.Suspense fallback={<div>Loading...</div>}>
        <Await resolve={nonCriticalData}>
          {(value) => <h3>Non critical value: {value}</h3>}
        </Await>
      </React.Suspense>
    </div>
  );
}
```

사용자는 핵심 데이터를 **즉시** 보고, 비핵심 영역에는 "Loading..." 을 보다가 데이터가 도착하면 자동으로 교체된다.

---

# React 19: React.use() 사용

React 19에서는 `<Await>` 대신 `React.use()`를 사용할 수 있다. 단, Suspense를 트리거하려면 Promise를 **자식 컴포넌트**에 전달해야 한다:

```tsx
<React.Suspense fallback={<div>Loading...</div>}>
  <NonCriticalUI p={nonCriticalData} />
</React.Suspense>
```

```tsx
function NonCriticalUI({ p }: { p: Promise<string> }) {
  const value = React.use(p);
  return <h3>Non critical value: {value}</h3>;
}
```

`React.use()`는 Promise가 미해결 상태면 컴포넌트 렌더링을 중단하고 가장 가까운 Suspense boundary의 fallback을 보여준다.

---

# Timeout 설정

기본적으로 loader/action의 미해결 Promise는 **4950ms** 후에 reject된다. `entry.server.tsx`에서 `streamTimeout`을 export하면 이 시간을 변경할 수 있다:

```typescript
// entry.server.tsx
// 10초 후 미해결 Promise reject
export const streamTimeout = 10_000;
```

---

# TanStack Query와 함께 사용하기

TanStack Query를 사용하는 앱에서는 React Router의 `<Await>` 대신 `prefetchQuery` + `useSuspenseQuery` 패턴을 사용한다.

## 기본 패턴: prefetchQuery를 await

가장 일반적인 방식이다. 스트리밍은 아니지만 **캐싱/재검증**을 얻는다:

```typescript
export async function loader({ params, context }: Route.LoaderArgs) {
  await context.queryClient.prefetchQuery({
    queryKey: ["product", params.id],
    queryFn: () => getProduct(params.id),
  });
  return null;
}
```

```tsx
export default function Product() {
  const { data } = useSuspenseQuery({
    queryKey: ["product", params.id],
    queryFn: () => getProduct(params.id),
  });
  return <h1>{data.name}</h1>;
}
```

## 핵심/비핵심 데이터 분리: await 선택적 적용

비핵심 데이터는 `prefetchQuery`를 **await하지 않으면** 서버에서 fetch를 시작만 하고, 클라이언트에서 `useSuspenseQuery`가 이어받는다:

```typescript
export async function loader({ params, context }: Route.LoaderArgs) {
  // 핵심 — await (페이지 렌더링 전에 데이터 보장)
  await context.queryClient.prefetchQuery({
    queryKey: ["product", params.id],
    queryFn: () => getProduct(params.id),
  });

  // 비핵심 — await 안 함 (fetch 시작만 해놓음)
  context.queryClient.prefetchQuery({
    queryKey: ["reviews", params.id],
    queryFn: () => getReviews(params.id),
  });

  return null;
}
```

## React Router 스트리밍과의 차이

| | React Router `<Await>` | TanStack Query `prefetchQuery` |
|---|---|---|
| 동작 방식 | 서버 → 브라우저로 HTML을 점진적 스트리밍 | 서버에서 fetch 시작, 클라이언트에서 이어받음 |
| 캐싱 | ❌ | ✅ (stale/revalidation 관리) |
| refetch | ❌ (1회성 Promise) | ✅ (queryFn 재실행) |
| 진짜 스트리밍 | ✅ | ❌ |

TanStack Query를 쓰고 있다면 `prefetchQuery` 패턴으로 통일하는 게 일반적이다. 캐싱과 재검증이 스트리밍보다 실용적 가치가 크기 때문이다. 두 방식을 섞어 쓸 수도 있지만 드문 케이스다.

---

# 정리

| 항목 | 내용 |
|---|---|
| 핵심 데이터 | `await`로 기다린 뒤 반환 → 즉시 렌더링 |
| 비핵심 데이터 | `await` 없이 Promise 반환 → Suspense fallback 후 도착 시 표시 |
| 렌더링 | `<Suspense>` + `<Await>` (React 19에서는 `React.use()`) |
| 기본 타임아웃 | 4950ms |
| 타임아웃 변경 | `entry.server.tsx`의 `streamTimeout` export |
