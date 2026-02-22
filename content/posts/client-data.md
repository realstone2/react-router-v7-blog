---
title: "Client Data"
date: "2026-02-22"
description: "clientLoader와 clientAction을 활용한 클라이언트 측 데이터 처리"
tags: ["react-router", "client-data"]
category: "core-concepts"
order: 6
---

> 공식 문서: [https://reactrouter.com/how-to/client-data](https://reactrouter.com/how-to/client-data)
> Data Loading 섹션의 심화 — clientLoader/clientAction 실전 패턴 4가지

# 개요

`clientLoader`와 `clientAction`은 브라우저에서 직접 데이터를 fetch/mutate하는 함수다.
주로 **SPA 모드**의 핵심 메커니즘이지만, SSR 환경에서도 다양한 패턴으로 활용된다.
공식 문서는 SSR 환경에서의 주요 use case 4가지를 소개한다.

---

# 패턴 1 — Skip the Server Hop (BFF 우회)

## 언제 쓰나?

React Router 서버를 거치지 않고 **백엔드 API에 직접 통신**하고 싶을 때.
BFF(Backend For Frontend) 아키텍처에서 서버 홉(server hop)을 줄이고 싶은 경우.

> 전제 조건: 인증 처리 완비 + CORS 제한 없음

## 동작 방식

- **초기 문서 로드**: `loader` (서버에서 fetch)
- **이후 클라이언트 네비게이션**: `clientLoader` (브라우저에서 직접 API 호출)
- React Router는 hydration 시 `clientLoader`를 호출하지 않는다 — 이후 네비게이션에서만 호출

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const data = await fetchApiFromServer({ request }); // 초기 로드: 서버에서
  return data;
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const data = await fetchApiFromClient({ request }); // 이후 네비게이션: 클라이언트에서
  return data;
}
```

```javascript
[초기 로드]
  브라우저 → RR 서버 → 백엔드 API (서버 홉 있음, SSR)

[이후 네비게이션]
  브라우저 ──────────────→ 백엔드 API (서버 홉 없음)
```

---

# 패턴 2 — Fullstack State (서버 + 클라이언트 데이터 합산)

## 언제 쓰나?

서버 데이터와 **브라우저 전용 데이터**(IndexedDB, localStorage, 브라우저 SDK 등)를 합쳐서 렌더링해야 할 때.

## 구현 방법

1. `loader`에서 서버 데이터 일부 로드 (partialData)
2. `HydrateFallback` export — SSR 시 표시할 스켈레톤
3. `clientLoader.hydrate = true` 설정 — 초기 hydration 시 clientLoader 실행 지시
4. `clientLoader`에서 서버 데이터 + 클라이언트 데이터 병합

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const partialData = await getPartialDataFromDb({ request }); // (1)
  return partialData;
}

export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const [serverData, clientData] = await Promise.all([
    serverLoader(),         // (4) 서버 데이터
    getClientData(request), // (4) 브라우저 데이터 (IndexedDB 등)
  ]);
  return { ...serverData, ...clientData }; // (4) 병합
}
clientLoader.hydrate = true as const; // (3)

export function HydrateFallback() {
  return <p>Loading...</p>; // (2) SSR 시 표시
}

export default function Component({ loaderData }: Route.ComponentProps) {
  // 항상 서버 + 클라이언트 데이터가 합쳐진 상태
  return <>...</>;
}
```

> **`clientLoader.hydrate = true`란?**
> 기본적으로 `clientLoader`는 클라이언트 네비게이션에서만 실행된다.
> `hydrate = true`를 설정하면 **초기 hydration 시에도** 실행된다.
> `HydrateFallback`이 있으면 암묵적으로 `hydrate = true`가 적용된다.

---

# 패턴 3 — Choosing Server or Client Data Loading (전략 선택)

## 서버 전용 로딩

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const data = await getServerData(request);
  return data;
}

export default function Component({ loaderData }: Route.ComponentProps) {
  return <>...</>;
}
```

## 클라이언트 전용 로딩

```typescript
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const clientData = await getClientData(request);
  return clientData;
}
// loader가 없으면 clientLoader.hydrate = true가 암묵적으로 적용됨
clientLoader.hydrate = true;

export function HydrateFallback() {
  return <p>Skeleton rendered during SSR</p>;
}

export default function Component({ loaderData }: Route.ComponentProps) {
  return <>...</>;
}
```

> `loader`가 없으면 `clientLoader.hydrate = true`는 명시하지 않아도 암묵적으로 적용된다.

---

# 패턴 4 — Client-Side Caching (클라이언트 캐시)

## 언제 쓰나?

TanStack Query 없이, 또는 커스텀 캐시(memory, localStorage 등)를 써서
**서버 요청을 최소화**하고 싶을 때.

## 구현 방법

1. `loader`에서 서버 데이터 로드 (초기)
2. `clientLoader.hydrate = true` + 캐시 프라이밍
3. 이후 네비게이션에서 캐시 HIT 시 서버 요청 스킵
4. `clientAction`에서 캐시 무효화 후 서버 action 실행

```typescript
let isInitialRequest = true;

export async function loader({ request }: Route.LoaderArgs) {
  const data = await getDataFromDb({ request }); // (1)
  return data;
}

export async function action({ request }: Route.ActionArgs) {
  await saveDataToDb({ request });
  return { ok: true };
}

export async function clientLoader({
  request,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const cacheKey = generateKey(request);

  if (isInitialRequest) {
    isInitialRequest = false;
    const serverData = await serverLoader();
    cache.set(cacheKey, serverData); // (2) 캐시 프라이밍
    return serverData;
  }

  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    return cachedData; // (3) 캐시 HIT → 서버 요청 스킵
  }

  const serverData = await serverLoader();
  cache.set(cacheKey, serverData);
  return serverData;
}
clientLoader.hydrate = true; // (2)

export async function clientAction({
  request,
  serverAction,
}: Route.ClientActionArgs) {
  const cacheKey = generateKey(request);
  cache.delete(cacheKey); // (4) 캐시 무효화
  const serverData = await serverAction();
  return serverData;
}
```

> `HydrateFallback`을 export하지 않으면 SSR 시 라우트 컴포넌트가 먼저 렌더링된다.
> 이때 `loader`와 `clientLoader`가 초기 로드에서 **같은 데이터를 반환해야** hydration 에러가 발생하지 않는다.

---

# TanStack Query와의 관계

패턴 4의 Client-Side Caching은 사실 **TanStack Query가 대체해주는 영역**이다.

| | 패턴 4 (수동 캐시) | TanStack Query |
|---|---|---|
| 캐시 프라이밍 | `isInitialRequest` 플래그 + `cache.set` | `ensureQueryData` |
| 캐시 HIT | 직접 구현 | 자동 (staleTime 기반) |
| 캐시 무효화 | `cache.delete` | `invalidateQueries` |
| 백그라운드 리페치 | 직접 구현 | 자동 (refetchOnWindowFocus 등) |
| 타입 안전성 | 직접 관리 | `queryOptions()`로 추론 |

> TanStack Query를 쓴다면 패턴 4를 직접 구현할 필요 없이 `clientLoader + ensureQueryData` 조합으로 대체할 수 있다.

---

# 패턴 요약

| 패턴 | 핵심 아이디어 | 사용 시나리오 |
|---|---|---|
| Skip the Server Hop | `loader` (초기) + `clientLoader` (이후) | BFF, 백엔드 직접 통신 |
| Fullstack State | `serverLoader()` + 브라우저 데이터 병합 | IndexedDB, 브라우저 SDK |
| Choosing Strategy | `loader` 또는 `clientLoader` 단독 | 라우트별 전략 분리 |
| Client-Side Caching | 캐시 프라이밍 + 무효화 | 서버 요청 최소화 (TQ로 대체 가능) |

> **핵심**
> `clientLoader`는 클라이언트 네비게이션 전용이 기본.
> `clientLoader.hydrate = true` 또는 `loader` 부재 시 초기 hydration에서도 실행.
> TanStack Query를 쓴다면 Client-Side Caching 패턴은 자동으로 처리된다.
