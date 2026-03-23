---
title: "사전 렌더링 (Pre-rendering)"
date: "2026-03-23"
description: "React Router prerender 설정으로 SSG 구현 — ssr 옵션 조합, SPA 폴백, 동적 경로 처리"
tags: ["react-router", "pre-rendering", "ssg", "ssr", "static"]
category: "how-to"
order: 8
---

> 공식 문서: [https://reactrouter.com/how-to/pre-rendering](https://reactrouter.com/how-to/pre-rendering)
> React Router v7 기준, Framework Mode 전용

---

# 들어가며

React Router의 `prerender` 설정으로 빌드 시 특정 경로를 정적 HTML로 미리 생성할 수 있다.

기본 `prerender` 옵션(true, 배열, async 함수)은 [react-router.config 가이드](../framework-conventions/react-router-config.md)를 참고하자.

이 글은 세 가지에 집중한다:

1. **ssr 옵션과의 조합** — 어떤 조합이 어떤 출력을 생성하는가
2. **SPA 폴백** — ssr:false일 때 pre-render되지 않은 경로 처리
3. **자식 라우트 처리** — 부모와 자식 라우트 간 데이터 일관성 유지

---

# Next.js와 비교

React Router의 `prerender` 개념을 Next.js와 비교하면:

| 항목 | Next.js | React Router |
|------|---------|--------------|
| 정적 생성 | `generateStaticParams` | `prerender` config |
| 증분 정적 재생성 | `export const revalidate = 60` | `Cache-Control` 헤더 + CDN |
| 서버사이드 렌더링 | 기본 | `ssr: true` (기본) |
| 정적 호스팅 | `output: 'export'` | `ssr: false` |

React Router는 **단일 설정 파일**에서 SSR과 pre-render를 동시에 제어할 수 있다는 점이 특징이다.
Next.js의 하이브리드 모드보다 더 세밀한 제어가 가능하다.

---

# ssr + prerender 조합 패턴

세 가지 조합이 주로 사용된다.

## 패턴 1: ssr:true + 부분 prerender (하이브리드)

**설정:**

```typescript
// react-router.config.ts
export default {
  ssr: true, // 기본값
  prerender: ["/", "/blog", "/blog/popular-post"],
} satisfies Config;
```

**동작:**

- Pre-render된 경로 → 빌드 시 정적 HTML + `.data` 파일 생성
- 나머지 경로 → 런타임 서버에서 SSR

**빌드 출력 예시:**

```
build/client/
├── index.html
├── index.data
├── blog
│   └── index.html
├── blog.data
├── blog
│   └── popular-post
│       └── index.html
└── blog/popular-post.data
```

**언제 사용하는가:**

- 콘텐츠가 자주 변경되는 대규모 사이트
- 자주 접근하는 경로만 미리 생성해서 빌드 시간 단축
- 서버가 필요한 경우 (form action, 로그인 등)

---

## 패턴 2: ssr:false + 전체 prerender (완전 정적)

**설정:**

```typescript
export default {
  ssr: false,
  prerender: true,
} satisfies Config;
```

**동작:**

- 모든 라우트를 빌드 시 정적 HTML로 생성
- 런타임 서버 없음 — Netlify, Vercel, GitHub Pages 같은 정적 호스팅에 배포

**제약사항:**

| 기능 | 가능 여부 | 이유 |
|------|---------|------|
| `loader` | ✅ (빌드 시만) | pre-render 실행 시에만 호출됨 |
| `action` | ❌ | 서버 없음 — form 제출 불가 |
| `headers` 함수 | ❌ | 서버 없음 — 응답 헤더 설정 불가 |

**언제 사용하는가:**

- 블로그, 문서 사이트 같이 콘텐츠가 정적인 경우
- 정적 호스팅만 사용
- 서버 비용 최소화

---

## 패턴 3: ssr:false + 부분 prerender (SPA 폴백)

**설정:**

```typescript
export default {
  ssr: false,
  prerender: ["/", "/about", "/contact"],
  // pre-render 안 된 경로는 SPA로 처리
} satisfies Config;
```

**동작:**

- 지정된 경로만 정적 HTML 생성
- 나머지 경로는 `__spa-fallback.html`로 리다이렉트
- 클라이언트에서 React Router가 라우팅 처리

**빌드 출력:**

```
build/client/
├── index.html
├── about
│   └── index.html
├── contact
│   └── index.html
└── __spa-fallback.html
```

**서버/호스팅 설정:**

Netlify에서:

```
# _redirects
/*    /__spa-fallback.html   200
```

sirv-cli로 로컬 테스트:

```bash
sirv-cli build/client --single __spa-fallback.html
```

**언제 사용하는가:**

- 랜딩 페이지는 정적으로, 동적 기능은 클라이언트에서 처리
- SEO가 필요한 핵심 페이지만 pre-render
- 서버 비용은 최소화하되 클라이언트 상호작용성 유지

---

# 빌드 병렬화 (unstable_concurrency)

경로가 많을 때 빌드 시간을 단축하려면 `unstable_concurrency` 옵션을 사용한다.

> ⚠️ **실험적 API** — React Router 마이너/패치 릴리즈에서 breaking change가 발생할 수 있다.

**설정:**

```typescript
export default {
  prerender: {
    paths: [
      "/",
      "/blog",
      ...slugs.map((s) => `/blog/${s}`),
    ],
    unstable_concurrency: 4, // 4개 경로를 동시에 렌더링
  },
} satisfies Config;
```

**특징:**

- 기본값은 순차 처리(concurrency 1)
- 값이 높을수록 빌드 속도 개선, 메모리 사용량 증가
- 최적값은 앱의 크기와 서버 리소스에 따라 다름
- 블로그처럼 경로가 100개 이상이면 4~8 사이 값 권장

---

# 자식 라우트 처리 주의사항

부모 라우트와 자식 라우트의 pre-render 여부가 다르면 데이터 불일치 문제가 발생한다.

## 문제 상황

```typescript
// react-router.config.ts
export default {
  prerender: ["/blog", "/about"], // /blog는 pre-render, /blog/post-1은 아님
} satisfies Config;

// app/routes.ts
export const route = {
  path: "/blog",
  loader: async () => {
    // 빌드 시: 실행됨 (pre-render)
    // 런타임: 항상 실행됨 (SSR 또는 클라이언트 요청)
    const posts = await fetchBlogIndex();
    return { posts };
  },
  children: [
    {
      path: ":slug",
      loader: async ({ params }) => {
        const post = await fetchPost(params.slug);
        return { post };
      },
    },
  ],
};
```

사용자가 `/blog`에서 `/blog/post-1`로 이동할 때:

- 정적 HTML인 `/blog`를 로드
- React Router가 `/blog/post-1`로 라우팅
- **부모 loader가 다시 실행되면서** 이전 데이터와 새 데이터 간 불일치 발생 가능

## 해결책 1: 자식 경로도 모두 prerender

```typescript
export default {
  prerender: [
    "/blog",
    "/blog/post-1",
    "/blog/post-2",
    "/blog/post-3",
  ],
} satisfies Config;
```

또는 동적으로 생성:

```typescript
export default {
  prerender: async () => {
    const posts = await fetchAllPosts();
    return [
      "/blog",
      ...posts.map((p) => `/blog/${p.slug}`),
    ];
  },
} satisfies Config;
```

---

## 해결책 2: 부모에 clientLoader 사용

부모는 pre-render하되, 자식 라우트만 동적으로 처리하려면:

```typescript
// 부모 라우트
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  // 빌드 시 실행 안 됨
  // 클라이언트에서만 실행됨
  return fetch(`/api/blog`).then((r) => r.json());
}

// 자식 라우트
export async function loader({ params }: Route.LoaderArgs) {
  // 빌드 시 pre-render 시 실행
  // 런타임 SSR 시 실행
  const post = await getPost(params.slug);
  return { post };
}
```

**주의:** `clientLoader`는 빌드 타임에 실행되지 않으므로, 부모 데이터가 없을 수도 있다.
필요하면 자식 loader에서 부모 context를 가정하지 말고 독립적으로 데이터를 fetch하자.

---

# loader와 pre-rendering 동작

pre-render 시 `loader`는 어떻게 실행되는가?

```typescript
export async function loader({ request, params }: Route.LoaderArgs) {
  console.log(request.url); // 빌드 시: "http://localhost/"
  const post = await getPost(params.slug);
  return { post };
}
```

**빌드 타임:**

- React Router가 `new Request('http://localhost' + pathname)`을 생성
- 실제 HTTP 요청이 아님 — 로컬 메모리에서 처리
- `params`는 경로에서 추출한 동적 세그먼트
- 외부 API 호출은 정상 작동

**런타임 (SSR):**

- 서버 요청이 들어오면 일반 SSR처럼 loader 실행
- `request`는 실제 HTTP 요청 객체

**클라이언트 네비게이션:**

- `loader`가 서버로 요청 (SSR)
- `.data` 파일을 응답으로 받음

동일한 `loader` 함수가 세 가지 시나리오 모두에 재사용되므로 순수 함수로 작성해야 한다.

---

# 배포 방식 선택 기준

**ssr:true + 부분 prerender:**

```typescript
export default {
  ssr: true,
  prerender: ["/", "/blog", "/pricing"],
} satisfies Config;
```

- 자주 접근하는 경로만 미리 생성해서 빌드 시간 단축
- 콘텐츠 변경 시 증분 배포 가능
- 서버가 필요한 경우 (form action, 로그인 등)
- **추천:** 중규모 이상의 블로그나 뉴스 사이트

---

**ssr:false + 전체 prerender:**

```typescript
export default {
  ssr: false,
  prerender: true,
} satisfies Config;
```

- 완전 정적 — 정적 호스팅에 배포
- 빌드 시간은 길지만 런타임 비용 최소
- 서버 환경 불필요
- **추천:** 블로그, 문서, 포트폴리오 같이 콘텐츠가 정적인 경우

---

**ssr:false + 부분 prerender (SPA 폴백):**

```typescript
export default {
  ssr: false,
  prerender: ["/", "/about", "/pricing"],
} satisfies Config;
```

- 핵심 페이지는 정적 (SEO 최적화)
- 동적 페이지는 클라이언트 SPA로 처리
- 정적 호스팅 가능하면서 동적 기능 제공
- **추천:** 제품 랜딩 페이지 + 동적 대시보드 조합

---

# 주의사항

## .html과 .data 파일

정적 호스팅에 배포할 때:

```
build/client/
├── index.html    ← 문서 요청
├── index.data    ← 클라이언트 네비게이션
├── blog
│   └── index.html
└── blog.data
```

`.html`과 `.data` 파일 모두 배포되어야 한다.
- 문서 요청(주소 입력, 새로고침) → `.html`
- 클라이언트 네비게이션 → `.data` (JSON)

---

## ssr:false일 때 사용 불가 기능

```typescript
// ❌ 작동 안 함
export async function action({ request }: Route.ActionArgs) {
  // ssr:false면 서버가 없어서 action 호출 불가
}

export async function headers() {
  // 서버가 없으므로 응답 헤더 설정 불가
}
```

Form 제출, 커스텀 HTTP 헤더가 필요하면 `ssr: true`를 사용하자.

---

## SPA 폴백 설정 필수

`ssr:false` + 부분 prerender일 때 정적 호스팅:

```
# Netlify _redirects
/*    /__spa-fallback.html   200
```

설정하지 않으면 pre-render되지 않은 경로 접근 시 404 에러.

---

## unstable_concurrency는 실험적 API

```typescript
prerender: {
  unstable_concurrency: 4,
}
```

마이너 버전에서 이름이 바뀌거나 동작이 변경될 수 있다.
프로덕션에서 사용하기 전에 충분히 테스트하자.

---

# 정리

| 설정 | 특징 |
|------|------|
| `ssr:true` + 부분 prerender | 하이브리드 — 자주 쓰는 경로는 정적, 나머지는 SSR |
| `ssr:false` + 전체 prerender | 완전 정적 — 정적 호스팅, action/headers 불가 |
| `ssr:false` + 부분 prerender | SPA 폴백 — 핵심 페이지 정적, 나머지 클라이언트 라우팅 |
| `unstable_concurrency` | 빌드 병렬화 — 경로가 많을 때 속도 개선 |
| 부모/자식 라우트 | 일관성 유지 — 둘 다 prerender하거나 clientLoader 사용 |
