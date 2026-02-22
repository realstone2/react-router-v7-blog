---
title: "SSR 배포 아키텍처"
date: "2026-02-22"
description: "React Router 7의 빌드 결과물, CDN 캐시, AWS 배포 아키텍처"
tags: ["react-router", "deployment", "aws", "cdn", "ssr"]
category: "core-concepts"
order: 12
---

> React Router 7으로 블로그를 만들면서 자연스럽게 생긴 질문들을 정리했다.
> "SSR이랑 SSG 차이가 뭐지?", "CDN 캐시는 어떻게 동작하지?", "빌드하면 파일이 어떻게 구성되지?", "AWS에 배포하면 인프라가 어떻게 생기지?"

이 글에서는 React Router 7의 빌드 결과물 구조부터 CDN 캐시 플로우, AWS 배포 아키텍처까지 전체 흐름을 다룬다.

---

# 1. SSR + Cache Headers vs SSG

## SSG (Static Site Generation)

- **빌드 타임**에 HTML을 미리 생성해서 파일로 저장
- 요청 시 서버 로직 없이 정적 파일을 그대로 서빙
- 콘텐츠 변경 시 **재빌드 + 재배포** 필요

```typescript
// react-router.config.ts
export default {
  ssr: true,
  prerender: ["/", "/posts/my-first-post"],
}
```

## SSR + Cache Headers

- **매 요청마다** 서버에서 loader 실행 후 HTML 렌더링
- `headers` export로 CDN/브라우저 캐시를 제어

```typescript
export function headers(): HeadersInit {
  return {
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
  };
}
```

- 첫 요청은 서버가 처리하고, 이후 요청은 **CDN이 캐시된 응답을 반환**
- 콘텐츠 변경 시 캐시 만료 후 자동 갱신 (재배포 불필요)

## 핵심 차이 비교

| | SSG | SSR + Cache Headers |
|---|---|---|
| HTML 생성 시점 | 빌드 타임 | 첫 요청 시 (이후 캐시) |
| 콘텐츠 업데이트 | 재빌드 + 재배포 | 캐시 만료 시 자동 갱신 |
| 서버 필요 | 없음 (정적 호스팅) | 있음 (Node 서버) |
| 동적 데이터 | 불가 | 가능 (캐시 시간만큼 지연) |
| 새 콘텐츠 추가 | 재빌드 필요 | 즉시 반영 |

---

# 2. 빌드 출력 구조

`npm run build` 실행 시 생성되는 파일 구조:

```javascript
build/
├── client/                          <- 정적 파일
│   ├── index.html                   <- "/" 프리렌더된 HTML
│   ├── _root.data                   <- "/" 클라이언트 네비게이션용 데이터
│   ├── posts/
│   │   ├── hello-world/
│   │   │   └── index.html           <- 프리렌더된 HTML
│   │   ├── hello-world.data         <- 클라이언트 네비게이션용 데이터
│   │   └── ...
│   └── assets/                      <- 해시된 정적 에셋
│       ├── chunk-EPOLDU6W-xxxxx.js  <- React Router 런타임
│       ├── entry.client-xxxxx.js    <- 클라이언트 엔트리
│       ├── home-xxxxx.js            <- 홈 라우트 모듈
│       ├── root-xxxxx.css           <- Tailwind CSS
│       └── manifest-xxxxx.js        <- 라우트 매니페스트
│
└── server/
    └── index.js                     <- SSR 서버 번들
```

## 각 파일의 역할

### `.html` 파일 — 프리렌더된 완성 HTML

`react-router.config.ts`의 `prerender()`가 반환한 경로들이 빌드 시 HTML로 생성된다. loader 데이터가 이미 HTML에 인라인되어 있어서 서버 없이도 페이지가 보인다.

### `.data` 파일 — 클라이언트 네비게이션용

첫 페이지는 HTML로 로드되지만, 이후 **링크 클릭 시에는 `.data` 파일만 fetch**한다.

1. 사용자가 `/` 접속 → `index.html` 전체 로드 (SSG)
2. "Hello World" 링크 클릭 → `/posts/hello-world.data`만 fetch
3. JS가 데이터 받아서 클라이언트에서 렌더링 (SPA 전환)

### `assets/` — 해시된 정적 에셋

파일명에 콘텐츠 해시가 포함되어 있어 **영구 캐시(immutable)**가 가능하다. 파일이 변경되면 해시가 바뀌어 새 URL이 되므로 캐시가 자동 무효화된다.

---

# 3. 프리렌더 vs 비프리렌더 요청 플로우

## 프리렌더된 페이지

```javascript
브라우저 → CDN → 정적 HTML 즉시 반환
                 (서버 개입 없음)
```

- HTML도 정적, .data도 정적 → 서버가 아예 개입하지 않음
- 캐시 전략: 파일이 있으면 항상 서빙
- 갱신: 재빌드 + 재배포 시에만

## 프리렌더 안 된 페이지

```javascript
브라우저 → CDN (MISS) → Node 서버 → loader() → HTML 렌더링 → 응답
```

- 매 요청마다 서버 실행
- `headers()` export로 CDN 캐시를 설정하면 첫 요청 이후 캐시됨

## Cache-Control 헤더 해부

```typescript
export function headers(): HeadersInit {
  return {
    "Cache-Control": "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600",
  };
}
```

| 디렉티브 | 대상 | 의미 |
|---|---|---|
| `max-age=60` | 브라우저 | 60초간 로컬 캐시 사용 |
| `s-maxage=86400` | CDN | 24시간 캐시 (브라우저와 독립) |
| `stale-while-revalidate=3600` | CDN | 만료 후 1시간은 오래된 캐시 주고, 백그라운드 갱신 |

---

# 4. CDN → Origin 폴백은 누가 설정하나?

React Router가 자동으로 해주는 게 아니라, **배포 환경에서 명시적으로 설정**해야 한다.

## Nginx + Node 서버

```nginx
server {
    root /app/build/client;

    location / {
        try_files $uri $uri/index.html @ssr;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location @ssr {
        proxy_pass http://localhost:3000;
    }
}
```

`try_files`가 핵심이다. "파일 있으면 서빙, 없으면 프록시"를 결정하는 지점이다.

## Vercel (자동 처리)

빌드 결과물의 파일 구조를 분석해서 라우팅 테이블을 자동 생성한다.

## Docker 단독

Node 서버가 `express.static` + SSR handler로 모두 처리한다.

---

# 5. AWS CloudFront + ECS 배포 아키텍처

## 전체 구조

```
사용자 브라우저
    ↓
Route 53 (DNS)
    ↓
CloudFront (CDN)
    ├── /assets/* → S3 버킷
    └── /* Default → ALB
                      ├── ECS Task 1 (Node)
                      └── ECS Task 2 (Node)
```

## CloudFront Behavior 설정

**Behavior 1: `/assets/*` → S3**

- TTL: 1년 (31536000초)
- `Cache-Control: public, max-age=31536000, immutable`
- 파일명에 해시 포함 → 영구 캐시 안전

**Behavior 2: `/*` (Default) → ALB → Node 서버**

- TTL: Origin 응답의 Cache-Control 헤더를 따름
- Node 서버가 `headers()` export로 캐시 정책 결정

## 요청 플로우 상세

**프리렌더된 페이지 (캐시 MISS → HIT):**

1. 첫 요청: CloudFront → ALB → Node (`express.static`이 HTML 반환) → CloudFront 캐시 저장
2. 이후 요청: CloudFront 캐시 HIT → 즉시 반환 (Node 서버 안 감)

**프리렌더 안 된 페이지:**

1. CloudFront → ALB → Node (loader 실행 → SSR → HTML 반환)
2. `headers()`의 `s-maxage`에 따라 CloudFront 캐시 저장

**클라이언트 네비게이션 (.data 요청):**

1. 브라우저 JS가 `/posts/hello-world.data` fetch
2. 프리렌더된 경우 정적 .data 파일 반환
3. 아닌 경우 Node 서버가 loader 실행 후 JSON 반환

## 배포 파이프라인

```bash
npm run build
    |
    |-- aws s3 sync build/client/assets/ s3://blog-assets/assets/
    |   (해시된 JS/CSS -> S3 직행)
    |
    |-- docker build -> ECR push -> ECS 배포
    |   (server/index.js + client/*.html + client/*.data)
    |
    |-- CloudFront invalidation (선택)
        aws cloudfront create-invalidation --paths "/*"
```

## ECS 구성

- Launch Type: Fargate
- Desired Count: 2 (가용성)
- Health Check: `GET /`
- Auto Scaling: CPU > 70% → Task 추가

---

# 6. 정적 파일 분리의 이점

JS/CSS를 S3로 분리하면 Node 서버의 부하가 줄어든다.

| 요청 | 처리 | Node 서버 부하 |
|---|---|---|
| `/assets/*.js` | S3 → CloudFront | 없음 |
| `/*.html` (프리렌더) | Node static → CloudFront 캐시 | 첫 요청만 |
| `/*.html` (SSR) | Node loader → CloudFront 캐시 | 캐시 MISS 시 |

---

# 마무리

React Router 7은 빌드 결과물을 만들어줄 뿐, "어떤 요청을 정적으로 서빙하고 어떤 걸 서버로 보낼지"는 인프라의 책임이다.

- **Vercel/Netlify**: 자동 처리 (가장 간편)
- **Nginx + Node**: `try_files`로 정적/SSR 분기
- **AWS CloudFront + ECS**: Behavior 규칙으로 S3/ALB 분기

현재 블로그처럼 모든 페이지가 프리렌더되는 경우, 실질적으로 정적 사이트처럼 동작하되 서버가 새 경로에 대한 폴백 역할을 한다.
