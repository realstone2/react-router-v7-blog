---
title: 'HTTP 헤더'
date: '2026-03-23'
category: 'how-to'
order: 4
tags: ['react-router', 'headers', 'cache-control', 'cdn', 'isr']
description: 'React Router에서 HTTP 헤더 설정 — loader/action 헤더 전달, 부모 병합, CDN 캐싱과 ISR 구현'
---

> 공식 문서: [https://reactrouter.com/how-to/headers](https://reactrouter.com/how-to/headers)
> React Router v7 Framework Mode 기준

---

# 들어가며

`headers` export 기본은 [라우트 모듈 가이드](../core-concepts/route-module.md) 섹션 12 참고.

이 글은 세 가지에 집중한다:

1. **loader/action 헤더를 response에 전달하기** — 자동 전송되지 않으므로 명시적으로 처리해야 함
2. **부모 라우트 헤더와의 병합** — 중첩 라우트에서 헤더 조합 방법
3. **CDN 캐싱과 ISR 구현** — Next.js의 `revalidate` 같은 패턴을 HTTP 헤더로 구현

> Framework Mode 전용 기능이다. Data Router나 Declarative Mode에서는 `headers` export가 지원되지 않는다.

---

# 1. loader/action 헤더를 response에 전달하기

## Step 1: loader에서 `data()`로 헤더 포함

loader 함수가 데이터와 함께 헤더를 반환하도록 설정한다. `data()` 유틸리티를 사용하면 된다.

```typescript
import { data } from 'react-router';
import type { Route } from './+types/some-route';

export async function loader({ params }: Route.LoaderArgs) {
  // 데이터 페칭 (시간 측정)
  const startTime = Date.now();
  const page = await fetchPage(params.id);
  const duration = Date.now() - startTime;

  // 데이터와 헤더를 함께 반환
  return data(page, {
    headers: {
      'Server-Timing': `page;dur=${duration};desc="Page query"`,
    },
  });
}
```

같은 방식으로 `action`에서도 헤더를 포함할 수 있다.

```typescript
export async function action({ request }: Route.ActionArgs) {
  const result = await processForm(request);

  return data(result, {
    headers: {
      'Set-Cookie': 'session=abc123; Path=/; HttpOnly',
    },
  });
}
```

## Step 2: `headers` export에서 loaderHeaders/actionHeaders 전달

`headers` 함수는 `loaderHeaders`와 `actionHeaders`를 받는다. 이들을 검사해서 response 헤더에 포함시킨다.

```typescript
export function headers({ loaderHeaders, actionHeaders }: Route.HeadersArgs) {
  // action 헤더가 있으면 우선, 없으면 loader 헤더 사용
  if (actionHeaders.has('Server-Timing')) {
    return actionHeaders;
  }
  return loaderHeaders;
}
```

더 간단한 예:

```typescript
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders; // loader의 모든 헤더를 그대로 전달
}
```

## `HeadersArgs`의 파라미터

| 파라미터        | 설명                                               |
| --------------- | -------------------------------------------------- |
| `loaderHeaders` | `loader`에서 `data()`로 설정한 헤더 (Headers 객체) |
| `actionHeaders` | `action`에서 `data()`로 설정한 헤더 (Headers 객체) |
| `parentHeaders` | 부모 라우트의 헤더 (Headers 객체)                  |

세 가지 모두 `Headers` 인터페이스를 따르므로 `.get()`, `.has()`, `.append()`, `.set()` 등 표준 메서드를 사용할 수 있다.

---

# 2. 부모 헤더와 병합

## 중첩 라우트에서 가장 깊은 라우트의 헤더만 전송된다

React Router의 라우트 계층 구조에서 **가장 깊은 라우트(deepest match)의 `headers` export만 실행**된다.

예를 들어 다음 계층 구조에서:

```
/team (layout)
  /team/:id (페이지)
    /team/:id/settings (서브페이지)
```

`/team/:id/settings`가 매칭되면 **settings의 `headers` export만 호출**된다.

## 부모 헤더 상속하기

부모 라우트의 헤더도 함께 유지하려면 `parentHeaders`를 명시적으로 처리해야 한다.

### append: 부모 헤더에 새 값 추가

```typescript
export function headers({ parentHeaders }: Route.HeadersArgs) {
  // 부모 헤더에 새로운 헤더 추가
  parentHeaders.append('Permissions-Policy', 'geolocation=()');
  return parentHeaders;
}
```

여러 헤더를 추가:

```typescript
export function headers({ parentHeaders }: Route.HeadersArgs) {
  parentHeaders.append('Permissions-Policy', 'geolocation=(), camera=()');
  parentHeaders.append('X-Custom-Header', 'value1');
  return parentHeaders;
}
```

### set: 부모 헤더 덮어쓰기

```typescript
export function headers({ parentHeaders }: Route.HeadersArgs) {
  // 부모의 Cache-Control을 덮어쓰기
  parentHeaders.set('Cache-Control', 'max-age=3600, s-maxage=86400');
  return parentHeaders;
}
```

## 주의: `Set-Cookie`는 자동 보존

**`Set-Cookie` 헤더만 특별히 처리된다.**

부모와 자식이 모두 `Set-Cookie`를 설정해야 하는 경우, 둘 다 HTTP 응답에 포함된다. 다른 헤더는 deepest match만 전송되지만, `Set-Cookie`는 예외다.

```typescript
// 부모 라우트
export function headers() {
  return {
    'Set-Cookie': 'parentSession=abc; Path=/',
  };
}

// 자식 라우트
export function headers({ parentHeaders }: Route.HeadersArgs) {
  // parentHeaders에 이미 Set-Cookie가 있음
  parentHeaders.append('Set-Cookie', 'childSession=xyz; Path=/');
  return parentHeaders;
}
```

HTTP 응답에는 두 `Set-Cookie`가 모두 포함된다.

## 권장 패턴: leaf route에만 헤더 정의

부모/자식 헤더 병합 로직을 단순화하려면 **leaf route(자식이 없는 최하위 라우트)에만 `headers` export를 정의**하자.

레이아웃 라우트나 상위 라우트에서 공통 헤더가 필요하면 `entry.server.tsx`에서 처리하는 게 낫다. ([entry.server 가이드](../framework-conventions/entry-server.md) 참고)

---

# 3. CDN 캐싱과 ISR 구현

## 배경: Next.js의 ISR과 React Router

Next.js에서는 `export const revalidate = 60`으로 Incremental Static Regeneration(ISR)을 구현한다.

React Router는 `react-router.config.ts`의 `prerender` 옵션으로 SSG를 지원한다.
다만 Next.js의 ISR처럼 **"특정 주기로 정적 파일을 재생성"하는 빌드 타임 메커니즘은 없다.**

대신 **HTTP `Cache-Control` 헤더와 CDN의 `stale-while-revalidate`를 조합하면 동일한 효과를 낼 수 있다.**

## 비교표

|           | Next.js                        | React Router               |
| --------- | ------------------------------ | -------------------------- |
| SSG       | `generateStaticParams`         | `prerender` config         |
| SSR       | 기본                           | 기본                       |
| ISR       | `export const revalidate = 60` | `Cache-Control` 헤더 + CDN |
| 구현 위치 | 라우트 컴포넌트                | `headers` export           |

## React Router ISR 패턴: `Cache-Control` 헤더

```typescript
export function headers() {
  return {
    // CDN은 60초 캐시, 만료 후 최대 1시간 stale 서빙하며 백그라운드 재검증
    'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=3600',
  };
}
```

이 헤더의 의미:

| 지시자                        | 값    | 의미                                           |
| ----------------------------- | ----- | ---------------------------------------------- |
| `public`                      | —     | 모든 캐시(브라우저, CDN, 프록시)에서 캐싱 가능 |
| `max-age=0`                   | 0초   | 브라우저 캐시 비활성화                         |
| `s-maxage=60`                 | 60초  | CDN만 60초 캐싱                                |
| `stale-while-revalidate=3600` | 1시간 | 캐시 만료 후 1시간 동안 stale 응답 가능        |

## `Cache-Control` vs `CDN-Cache-Control`

브라우저와 CDN이 모두 같은 `Cache-Control`을 읽으면 **브라우저도 stale-while-revalidate를 따르게 돼서 이중 revalidation이 발생**한다.

이를 방지하려면 **`CDN-Cache-Control` 헤더를 사용**해 CDN만 읽도록 한다.

```typescript
export function headers() {
  return {
    // CDN만 읽고 브라우저는 무시 → 이중 revalidation 없음
    'CDN-Cache-Control': 'max-age=60, stale-while-revalidate=3600',
    // 브라우저 캐시는 별도 제어
    'Cache-Control': 'public, max-age=0',
  };
}
```

## 동작 원리 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│ 첫 요청 (캐시 미스)                                          │
├─────────────────────────────────────────────────────────────┤
│ 클라이언트 → CDN → Origin 서버 실행 → 응답 캐싱 (60초)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 60초 이내 재요청 (캐시 hit)                                 │
├─────────────────────────────────────────────────────────────┤
│ 클라이언트 ← CDN (캐시된 응답 즉시 반환)                     │
│            Origin 서버는 실행되지 않음                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 60초~1시간 사이 재요청 (stale-while-revalidate 기간)        │
├─────────────────────────────────────────────────────────────┤
│ 클라이언트 ← CDN (stale 응답 즉시 반환, 사용자 블로킹 없음)  │
│            백그라운드 → Origin 서버 재요청 → 캐시 갱신       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 1시간 후 재요청 (캐시 완전 만료)                             │
├─────────────────────────────────────────────────────────────┤
│ 클라이언트 → CDN → Origin 서버 실행 (일반 SSR처럼 동작)     │
└─────────────────────────────────────────────────────────────┘
```

## 실전 예: 상품 상세 페이지의 동적 캐시 제어

상품의 재고 상태에 따라 캐시 전략을 다르게 적용:

```typescript
import { data } from "react-router";
import type { Route } from "./+types/product-detail";

export async function loader({ params }: Route.LoaderArgs) {
  const product = await getProduct(params.id);

  // 재고 있는 상품: 60초 캐시 + 1시간 stale-while-revalidate
  // 재고 없는 상품: 캐시 없음 (실시간)
  const cacheControl = product.inStock
    ? "public, max-age=0, s-maxage=60, stale-while-revalidate=3600"
    : "no-store"; // 캐싱 완전 비활성화

  return data(product, {
    headers: { "Cache-Control": cacheControl },
  });
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders; // loader에서 설정한 헤더 그대로 전달
}

export default function ProductPage({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData.name}</h1>;
}
```

## CDN 지원 확인

`stale-while-revalidate`는 모든 CDN에서 지원하지는 않는다.

**지원하는 주요 CDN:**

- Cloudflare
- Vercel
- Fastly
- AWS CloudFront (최신 버전)

**Direct 서빙(CDN 없음)에서는 동작하지 않는다.**

배포 환경에서 CDN을 사용 중인지 확인하고, 그렇지 않으면 `s-maxage`는 무시된다.

## 외부 참고자료

이 패턴은 Remix 커뮤니티에서 많이 사용되고 있다:

- [Netlify - How to do ISR and advanced caching with Remix](https://developers.netlify.com/guides/how-to-do-isr-and-advanced-caching-with-remix/)
- [Tiger Abrodi - Cache Control and Remix](https://tigerabrodi.blog/cache-control-and-remix-answering-my-own-questions)

---

# 주의사항

## 1. loader/action 헤더는 자동 전송되지 않는다

loader에서 헤더를 설정했다고 해서 자동으로 응답에 포함되지 않는다. **반드시 `headers` export에서 명시적으로 반환**해야 한다.

```typescript
// ❌ 이것만으로는 부족
export async function loader() {
  return data(page, { headers: { 'X-Custom': 'value' } });
}

// ✅ headers export가 필요
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders;
}
```

## 2. `Set-Cookie`는 예외

`Set-Cookie` 헤더만 자동으로 부모/자식 모두 보존된다. 인증 관련 쿠키는 별도 처리가 불필요하다.

## 3. `CDN-Cache-Control` vs `Cache-Control`

`CDN-Cache-Control`을 사용해서 **브라우저와 CDN을 분리 제어**하자. 그래야 이중 revalidation을 피할 수 있다.

## 4. Framework Mode 전용

이 가이드의 모든 기법은 **React Router Framework Mode**에서만 작동한다.

Data Router나 Declarative Mode에서는 `headers` export가 지원되지 않는다.

---

# 요약

| 시나리오                                 | 해결 방법                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| loader에서 설정한 헤더를 response에 포함 | `headers` export에서 `loaderHeaders` 반환                                      |
| 부모 라우트 헤더도 함께 유지             | `headers`에서 `parentHeaders.append()` 또는 `.set()`                           |
| CDN 캐시 제어 (ISR 패턴)                 | `Cache-Control: "public, max-age=0, s-maxage=60, stale-while-revalidate=3600"` |
| 브라우저 캐시 제어 분리                  | `CDN-Cache-Control` 사용                                                       |
| 동적 캐시 정책                           | loader에서 조건부로 `cacheControl` 결정 후 `data()`로 전달                     |
