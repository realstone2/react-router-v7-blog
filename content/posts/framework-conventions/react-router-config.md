---
title: "react-router.config.ts — 앱 설정 파일"
date: "2026-03-08"
description: "React Router Framework Mode의 빌드·렌더링 전략을 제어하는 설정 파일 전체 옵션 정리"
tags: ["react-router", "framework-conventions", "config"]
category: "framework-conventions"
order: 3
---

> 공식 문서: [https://reactrouter.com/api/framework-conventions/react-router.config.ts](https://reactrouter.com/api/framework-conventions/react-router.config.ts)
> React Router v7 기준 (Framework Mode 전용)

---

# 들어가며

`react-router.config.ts`는 Framework Mode의 **빌드·렌더링 전략을 제어하는 설정 파일**이다.
필수 파일은 아니지만, SSR/SPA 전환·사전 렌더링·번들 분리 등 렌더링 전략이 달라지는 경우 반드시 알아야 한다.

```typescript
import type { Config } from "@react-router/dev/config";

export default {
  // 옵션들...
} satisfies Config;
```

---

# 1. appDirectory

앱 소스 디렉토리 경로. 기본값은 `"app"`.

```typescript
export default {
  appDirectory: "src",
} satisfies Config;
```

---

# 2. buildDirectory

빌드 출력 디렉토리 경로. 기본값은 `"build"`.

```typescript
export default {
  buildDirectory: "dist",
} satisfies Config;
```

---

# 3. basename

앱 베이스 경로. 서브경로에 배포할 때 사용한다. 기본값은 `"/"`.

```typescript
export default {
  basename: "/my-app",
} satisfies Config;
// https://example.com/my-app 에서 앱이 동작
```

---

# 4. ssr

서버 사이드 렌더링 활성화 여부. 기본값은 `true`.

- **`true`**: 요청마다 서버에서 HTML 생성
- **`false`**: 빌드 시 `index.html` 하나만 생성 (SPA 모드)

```typescript
// SSR 모드 (기본)
export default {
  ssr: true,
} satisfies Config;
```

```typescript
// SPA 모드 — 서버 없이 정적 호스팅 가능
export default {
  ssr: false,
} satisfies Config;
```

`ssr: false`이면 `loader`는 `clientLoader`로, `action`은 `clientAction`으로 대체해야 한다.

---

# 5. prerender

빌드 타임에 특정 경로를 HTML 파일로 미리 생성한다.
생성된 HTML은 SSR 서버 없이 CDN에서 정적으로 서빙할 수 있다.

### 정적 경로 배열

```typescript
export default {
  prerender: ["/", "/about", "/contact"],
} satisfies Config;
```

### 동적 경로 — 빌드 시 경로 목록을 생성하는 함수

```typescript
export default {
  prerender: async ({ getStaticPaths }) => {
    const slugs = await fetchAllPostSlugs();
    return ["/", ...slugs.map(slug => `/posts/${slug}`)];
  },
} satisfies Config;
```

`ssr: true`와 함께 사용하면 사전 렌더링된 경로는 정적 HTML로, 나머지는 SSR로 처리한다.

---

# 6. routeDiscovery

클라이언트에서 라우트 매니페스트를 가져오는 전략을 설정한다.

### manifest가 필요한 이유

React Router는 페이지 이동 시 HTML을 새로 받지 않고 **SPA처럼 JS 모듈을 직접 로드**한다.

```
일반 MPA:
  /dashboard 클릭 → GET /dashboard → 서버가 HTML 전체 응답 → 페이지 새로고침

React Router (SPA):
  /dashboard 클릭 → 새로고침 없음 → 클라이언트가 직접 JS 모듈 로드 → 렌더링
```

클라이언트가 JS 모듈을 로드하려면 **"이 URL에 해당하는 JS 파일이 어디 있는지"** 를 알아야 한다. manifest는 이 매핑 정보다.

```
manifest 없으면: /dashboard → 어떤 JS 파일을 로드해야 하지? → 모름
manifest 있으면: /dashboard → chunks/dashboard-abc123.js 로드 → loader 실행 → 렌더링
```

manifest에는 실제 컴포넌트 코드가 아니라 아래 정보만 담긴다.

- 각 라우트의 JS/CSS 파일 경로
- loader / action 존재 여부
- 라우트 설정 정보

### `lazy` (기본값)

앱 시작 시 현재 페이지에 필요한 라우트 정보만 받고, 이후 탐색 시 필요한 것만 추가로 요청한다.

```
앱 시작 (/)    → 최소 manifest 수신
/dashboard 이동 → /__manifest?paths=/dashboard 요청 → 추가 정보 수신
/settings 이동  → /__manifest?paths=/settings 요청 → 추가 정보 수신
```

`manifestPath`는 이 추가 요청을 보낼 URL이다. `lazy` 모드에서만 사용된다.

```typescript
export default {
  routeDiscovery: {
    mode: "lazy",
    manifestPath: "/__manifest", // 기본값, 커스텀 가능
  },
} satisfies Config;
```

같은 도메인에서 React Router 앱을 여러 개 운영할 때 경로가 충돌할 수 있으므로 커스텀한다.

```typescript
// 앱마다 다른 manifest 경로 지정
export default {
  routeDiscovery: {
    mode: "lazy",
    manifestPath: "/my-app/__manifest",
  },
} satisfies Config;
```

### `initial`

앱 시작 시 모든 라우트 manifest를 한 번에 받는다. 이후 추가 요청 없음. `manifestPath` 무의미.

```typescript
export default {
  routeDiscovery: { mode: "initial" },
} satisfies Config;
```

| | `lazy` | `initial` |
|---|---|---|
| 초기 번들 크기 | 작음 | 큼 |
| 탐색 시 추가 요청 | 있음 | 없음 |
| `manifestPath` 사용 | O | X |
| 적합한 경우 | 라우트가 많은 대형 앱 | 라우트가 적은 소형 앱 |

---

# 7. serverBuildFile

서버 빌드 출력 파일명. 기본값은 `"index.js"`. 반드시 `.js`로 끝나야 한다.

```typescript
export default {
  serverBuildFile: "server.js",
} satisfies Config;
```

---

# 8. serverModuleFormat

서버 번들의 모듈 형식. 기본값은 `"esm"`.

```typescript
// CommonJS 형식으로 출력 (일부 Node.js 환경에서 필요)
export default {
  serverModuleFormat: "cjs",
} satisfies Config;
```

---

# 9. serverBundles

라우트를 여러 서버 번들로 분리한다. `branch`는 현재 라우트까지의 라우트 트리 경로다.
반환값(번들 ID)이 서버 번들 디렉토리명이 된다.

```typescript
export default {
  serverBundles: ({ branch }) => {
    return branch.some((route) => route.id === "admin")
      ? "admin"
      : "main";
  },
} satisfies Config;
// 결과: build/server/admin/, build/server/main/
```

어드민/일반 사용자를 다른 서버(또는 엣지 함수)에 배포할 때 활용한다.

---

# 10. allowedActionOrigins

UI 라우트의 action 제출을 허용할 오리진 화이트리스트. **기본값은 미설정(undefined)으로 모든 오리진 허용**이다.

CSRF 공격 방어를 위해 사용한다. 외부 악성 사이트가 사용자 브라우저를 통해 내 서버 action을 몰래 호출하는 것을 차단한다.

| 설정값 | 동작 |
|---|---|
| 미설정 (undefined) | 모든 오리진 허용 |
| `["example.com"]` | 명시된 오리진만 허용 |

Micromatch glob 패턴을 지원한다.

```typescript
export default {
  allowedActionOrigins: [
    "example.com",
    "*.example.com",   // sub.example.com (서브도메인 1단계)
    "**.example.com",  // sub.domain.example.com (서브도메인 다단계)
  ],
} satisfies Config;
```

단일 도메인 앱이라면 별도 설정이 필요 없다. 아래 경우에 필요하다.

- 여러 서브도메인에서 같은 서버 action을 호출할 때
- 마이크로프론트엔드처럼 다른 오리진에서 action을 호출해야 할 때

환경별로 동적 설정도 가능하다.

```typescript
export default {
  allowedActionOrigins:
    process.env.NODE_ENV === "development"
      ? undefined  // 개발환경: 모든 오리진 허용
      : ["staging.example.com", "www.example.com"], // 프로덕션: 명시된 것만 허용
} satisfies Config;
```

---

# 11. buildEnd

전체 빌드가 완료된 후 실행되는 콜백. 빌드 후처리(파일 복사, 알림 등)에 활용한다.

```typescript
export default {
  buildEnd: async ({ buildManifest, reactRouterConfig, viteConfig }) => {
    console.log("빌드 완료!");
    // 빌드 결과물 후처리, 외부 서비스 알림 등
  },
} satisfies Config;
```

---

# 12. future

> 참고 문서: [https://reactrouter.com/upgrading/future](https://reactrouter.com/upgrading/future)

v8에서 도입될 breaking change를 **v7에서 미리 opt-in**하는 플래그다.
플래그를 하나씩 켜가며 커밋하는 방식으로, 메이저 버전 업그레이드를 점진적으로 준비할 수 있다.

```typescript
export default {
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
```

현재 v7에서 사용 가능한 플래그는 3가지다. 모두 Framework Mode 전용이다.

---

### v8_middleware

라우터 수준의 미들웨어 기능을 활성화한다. loader/action 실행 전후에 공통 로직(인증, 로깅 등)을 끼워넣을 수 있다.

기존에는 인증 처리를 라우트마다 반복하거나, 공통 함수를 호출하는 방식으로 해결해야 했다. 미들웨어를 사용하면 라우트 트리 단위로 한 번만 선언할 수 있다.

```typescript
// react-router.config.ts
export default {
  future: { v8_middleware: true },
} satisfies Config;
```

`react-router-serve`를 사용하는 경우 코드 변경 불필요. 커스텀 서버에서 `getLoadContext`를 쓰는 경우만 마이그레이션이 필요하다.

---

### v8_splitRouteModules

`clientLoader`, `clientAction`, `HydrateFallback`을 컴포넌트 코드와 **별도 청크로 분리**해서 병렬로 로드한다.

기존엔 라우트 모듈 전체가 하나의 청크라서, 컴포넌트 코드가 다 받아져야 `clientLoader`도 실행될 수 있었다. 분리하면 컴포넌트 다운로드 중에 `clientLoader`를 먼저 실행할 수 있어 TTI(Time to Interactive)가 줄어든다.

코드 변경 없이 설정만으로 동작한다.

```typescript
export default {
  future: {
    v8_splitRouteModules: true,       // 가능한 경우 분리
    // v8_splitRouteModules: "enforce" // 분리 불가한 라우트는 빌드 실패로 감지
  },
} satisfies Config;
```

`"enforce"` 옵션을 쓰면 분리가 불가능한 라우트 구조를 빌드 시 감지해서 알려준다.

---

### v8_viteEnvironmentApi

Vite 6+의 실험적 Environment API를 활성화한다. SSR/클라이언트 빌드 환경을 더 세밀하게 구성할 수 있다.

커스텀 Vite 설정이 없으면 코드 변경 불필요. Vite 6 미만이면 사용 불가.

```typescript
export default {
  future: { v8_viteEnvironmentApi: true },
} satisfies Config;
```

---

| 플래그 | 목적 | 코드 변경 필요 |
|---|---|---|
| `v8_middleware` | 라우트 미들웨어 지원 | 커스텀 서버만 |
| `v8_splitRouteModules` | 클라이언트 청크 분리 (성능) | 불필요 |
| `v8_viteEnvironmentApi` | Vite 6 Environment API | 커스텀 Vite 설정만 |

---

# 13. presets

`react-router.config.ts`에 들어가는 설정값들을 미리 묶어서 npm 패키지로 배포한 것이다.
Vercel, Netlify 같은 플랫폼이 자기 환경에 맞는 설정을 preset으로 제공하면, 사용자는 직접 설정을 몰라도 한 줄만 추가하면 된다.

```typescript
// preset 없이 — Vercel 설정을 직접 작성
export default {
  serverBundles: ...,  // Vercel 관련 설정
  buildEnd: ...,       // Vercel 관련 설정
  // ...
} satisfies Config;

// preset 사용 — 위 설정들이 preset 안에 포함됨
import { vercelPreset } from "@vercel/react-router";

export default {
  presets: [vercelPreset()],
} satisfies Config;
```

빌드 타임에만 동작하며, 여러 preset을 배열로 조합할 수 있다. 사용자 config가 항상 preset보다 우선순위가 높다.

대부분의 앱 개발자는 preset을 만들 일은 없고, 플랫폼 배포 시 해당 플랫폼 문서에서 안내하는 경우에만 추가하면 된다.

---

# 전체 옵션 요약

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `appDirectory` | `"app"` | 앱 소스 디렉토리 |
| `buildDirectory` | `"build"` | 빌드 출력 디렉토리 |
| `basename` | `"/"` | 앱 베이스 경로 |
| `ssr` | `true` | SSR 활성화 여부 |
| `prerender` | — | 빌드 타임 사전 렌더링 경로 |
| `routeDiscovery` | `{ mode: "lazy" }` | 라우트 탐색 전략 |
| `serverBuildFile` | `"index.js"` | 서버 빌드 출력 파일명 |
| `serverModuleFormat` | `"esm"` | 서버 번들 모듈 형식 |
| `serverBundles` | — | 라우트별 서버 번들 분리 |
| `allowedActionOrigins` | — | action 허용 오리진 |
| `buildEnd` | — | 빌드 완료 후 콜백 |
| `future` | — | 향후 기능 플래그 |
| `presets` | — | 플랫폼 통합 프리셋 |
