---
title: "Rendering Strategies"
date: "2026-02-22"
description: "SSR, CSR, SSG — React Router v7의 렌더링 전략"
tags: ["react-router", "ssr", "ssg"]
category: "core-concepts"
order: 3
---

> 공식 문서: [https://reactrouter.com/start/framework/rendering](https://reactrouter.com/start/framework/rendering)
> Next.js App Router와 비교하며 정리한 학습 노트

# 들어가며

React Router v7은 **렌더링 전략을 하나의 설정 파일**(`react-router.config.ts`)에서 제어한다.
Next.js처럼 페이지마다 `getStaticProps` / `getServerSideProps`를 선택하는 방식이 아니라,
**앱 전체의 기본 전략을 전역으로 설정**하고 라우트별로 부분 조정하는 구조다.

React Router v7이 지원하는 렌더링 전략은 세 가지다.

| 전략 | 설명 | 설정 |
|---|---|---|
| CSR (Client Side Rendering) | 클라이언트에서만 렌더링, SPA | `ssr: false` |
| SSR (Server Side Rendering) | 요청마다 서버에서 렌더링 | `ssr: true` |
| Static Pre-rendering | 빌드 타임에 HTML 생성 | `prerender()` |

---

# 1. Client Side Rendering (CSR) — SPA 모드

서버 렌더링을 완전히 끄고, 기존 Create React App / Vite SPA처럼 동작한다.

## 설정

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
} satisfies Config;
```

## 동작 방식

```javascript
브라우저 요청
    ↓
빈 HTML (index.html) 반환
    ↓
JS 번들 다운로드 및 실행
    ↓
React가 클라이언트에서 렌더링
    ↓
loader → clientLoader만 실행 (서버 loader 없음)
```

## Next.js와 비교

Next.js는 SPA 전용 모드가 따로 없고 `output: 'export'`로 정적 export를 하거나,
`'use client'` + `useEffect`로 클라이언트 전용 렌더링을 구현해야 한다.
RR v7은 **`ssr: false` 한 줄로 앱 전체를 SPA로 전환**할 수 있어 훨씬 명시적이다.

## 언제 사용?

- 인증이 필요한 대시보드, 어드민 페이지
- SEO가 필요 없는 내부 툴
- 서버 인프라 없이 정적 호스팅(S3, GitHub Pages)에 배포할 때

---

# 2. Server Side Rendering (SSR)

매 요청마다 서버에서 HTML을 생성해 내려준다. React Router v7의 **기본값(default)**이다.

## 설정

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  ssr: true, // 기본값이므로 생략 가능
} satisfies Config;
```

## 동작 방식

```javascript
브라우저 요청
    ↓
서버에서 매칭된 라우트의 loader 병렬 실행
    ↓
데이터와 함께 HTML 생성 (SSR)
    ↓
HTML + JS 번들 브라우저로 전송
    ↓
React Hydration (클라이언트에서 이벤트 연결)
    ↓
이후 네비게이션은 클라이언트 사이드로 처리
```

## Next.js와 비교

Next.js App Router는 **기본이 SSR**이며, 컴포넌트 단위로 `'use client'`를 붙여 CSR로 전환한다.
RR v7도 기본이 SSR이지만, **라우트 단위로** `clientLoader`를 사용해 특정 라우트만 서버 fetch를 건너뛸 수 있다.

```typescript
// 이 라우트만 서버 렌더링/페칭을 건너뜀
export async function clientLoader() {
  return await fetchFromBrowser();
}
// → SSR 전역 설정이어도 이 라우트는 클라이언트에서만 데이터 로딩
```

## 언제 사용?

- SEO가 중요한 상품 상세, 카테고리 페이지
- 초기 로딩 속도가 중요한 랜딩 페이지
- 개인화된 콘텐츠 (사용자별 다른 HTML)
- SEO + 성능 모두 중요한 서비스

---

# 3. Static Pre-rendering (SSG) — 빌드 타임 HTML 생성

빌드 시점에 지정한 URL들의 HTML을 미리 생성한다.
요청마다 서버가 렌더링하지 않고 **미리 만들어둔 HTML을 그대로 서빙**한다.

## 설정

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  async prerender() {
    // 빌드 타임에 pre-render할 URL 목록을 반환
    return ["/", "/about", "/contact"];
  },
} satisfies Config;
```

## 동적 라우트 pre-rendering

```typescript
export default {
  async prerender() {
    // DB나 CMS에서 경로 목록을 가져와서 pre-render
    const products = await fetchAllProducts();
    return [
      "/",
      "/products",
      ...products.map(p => `/products/${p.id}`),
    ];
  },
} satisfies Config;
```

## 동작 방식

```javascript
빌드 타임
    ↓
prerender()가 반환한 URL 목록 순회
    ↓
각 URL에 대해 loader 실행 + HTML 생성
    ↓
정적 HTML 파일 + 클라이언트 네비게이션 데이터 페이로드 저장
    ↓
배포 (CDN, S3 등)

런타임
    ↓
브라우저 요청 → 미리 만들어둔 HTML 즉시 반환
    ↓
React Hydration
    ↓
이후 네비게이션은 클라이언트 사이드로 처리
```

## Next.js와 비교

```typescript
// Next.js: 페이지마다 generateStaticParams 작성
// app/products/[id]/page.tsx
export async function generateStaticParams() {
  const products = await fetchAllProducts();
  return products.map(p => ({ id: p.id }));
}
```

```typescript
// React Router v7: 전역 설정 파일 한 곳에서 관리
// react-router.config.ts
export default {
  async prerender() {
    const products = await fetchAllProducts();
    return products.map(p => `/products/${p.id}`);
  },
};
```

Next.js는 **파일마다 분산**해서 선언하는 반면,
RR v7은 **`react-router.config.ts` 한 곳**에서 모든 pre-render 대상을 관리한다.
전체 사이트맵을 한눈에 파악하기 쉽다는 장점이 있다.

## 언제 사용?

- 자주 변경되지 않는 콘텐츠 (이용약관, FAQ, 브랜드 소개 페이지)
- 서버 인프라 없이 CDN에 배포하고 싶을 때
- 빌드 타임에 데이터가 확정되는 경우

---

# 전략 혼합 — SSR + Pre-rendering 함께 사용

RR v7의 강점 중 하나는 **전략을 혼합**할 수 있다는 점이다.
`ssr: true`로 전체 SSR을 켜면서, 특정 URL만 pre-rendering으로 미리 만들어둘 수 있다.

```typescript
export default {
  ssr: true,
  async prerender() {
    // 이 URL들은 빌드 타임에 미리 생성
    // 그 외 URL은 요청 시 SSR
    return ["/", "/about", "/contact"];
  },
} satisfies Config;
```

## 실전 예시: 글로벌 커머스

```typescript
export default {
  ssr: true, // 기본은 SSR (개인화, 재고/가격 실시간 반영)
  async prerender() {
    return [
      "/",                    // 메인: 정적 pre-render (CDN 캐시)
      "/about",               // 브랜드 소개: 정적
      "/en",                  // 영문 메인
      "/ja",                  // 일문 메인
    ];
    // 상품 상세(/products/:id)는 SSR — 재고/가격이 실시간으로 바뀌므로
  },
} satisfies Config;
```

---

# 전략별 비교 요약

| | CSR (SPA) | SSR | Static Pre-rendering |
|---|---|---|---|
| 설정 | `ssr: false` | `ssr: true` (기본값) | `prerender()` 반환 URL |
| HTML 생성 시점 | 브라우저 (런타임) | 서버 (요청 시) | 빌드 타임 |
| SEO | 불리 | 유리 | 유리 |
| 초기 로딩 | 느림 (JS 실행 후) | 빠름 | 가장 빠름 |
| 실시간 데이터 | 가능 | 가능 | 불가 (빌드 시 고정) |
| 서버 인프라 | 불필요 | 필요 | 불필요 (CDN 가능) |
| Next.js 대응 | `output: 'export'` | App Router 기본 | `generateStaticParams` |

---

# 핵심 포인트

> **"전략은 `react-router.config.ts` 하나에서, 라우트별 예외는 `clientLoader`로"**

- 전역 설정(`ssr`, `prerender`)으로 앱 전체 기본 전략을 잡는다
- 특정 라우트만 다르게 하고 싶으면 해당 라우트에 `clientLoader`를 추가한다
- SSR + Pre-rendering 혼합이 가능해 **실시간 데이터가 필요한 페이지와 정적 페이지를 같은 앱에서 함께 운용**할 수 있다
