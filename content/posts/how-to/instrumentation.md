---
title: "계측 (Instrumentation)"
date: "2026-03-23"
description: "React Router의 Instrumentation API로 로깅, 성능 추적, OpenTelemetry 연동하기"
tags: ["react-router", "instrumentation", "observability", "opentelemetry", "logging"]
category: "how-to"
order: 5
---

> 공식 문서: [https://reactrouter.com/how-to/instrumentation](https://reactrouter.com/how-to/instrumentation)
> React Router v7 기준
>
> ⚠️ **실험적 API** (`unstable_` 접두사) — 마이너/패치 릴리즈에서 breaking change 가능

---

# 들어가며

Instrumentation은 라우트 핸들러를 직접 수정하지 않고도 **로깅, 성능 추적, 에러 리포팅** 같은 횡단 관심사(cross-cutting concerns)를 추가할 수 있는 API이다.

`loader`, `action`, `middleware` 같은 핸들러의 실행을 전후로 감싸서 관찰하는 방식이다.

## 핵심 특징

- **읽기 전용**: 핸들러의 인자나 반환값을 수정할 수 없다. 순수 관찰만 가능하다.
- **배열 조합**: 여러 instrumentation을 배열로 조합할 수 있다.
- **비동기 지원**: async/await로 async 핸들러도 완전히 감쌀 수 있다.
- **에러 안전**: instrumentation 자체의 에러가 앱을 죽이지 않는다.

---

# 지원 범위

| 레벨 | 설명 | 서버 | 클라이언트 | 데이터 접근 |
|------|------|------|----------|-----------|
| **Handler** | 프레임워크가 받는 모든 HTTP 요청 | ✅ Framework Mode | ❌ | ❌ |
| **Router** | 클라이언트 네비게이션과 fetcher | ❌ | ✅ Framework/Data | ✅ |
| **Route** | 개별 라우트의 loader/action/middleware | ✅ Framework/Data | ✅ Framework/Data | ✅ |

---

# 세 가지 계측 레벨

## 1. Handler 레벨 (서버 전체 요청)

**Framework Mode 서버 전용**. 앱으로 들어오는 모든 HTTP 요청을 감싼다.

`entry.server.tsx`에서 `export const unstable_instrumentations`로 설정한다.

```tsx
// entry.server.tsx
export const unstable_instrumentations = [
  {
    handler(handler) {
      handler.instrument({
        async request(callRequest, { request }) {
          console.log(`요청 시작: ${request.method} ${request.url}`);
          await callRequest();
          console.log(`요청 종료: ${request.method} ${request.url}`);
        },
      });
    },
  },
];

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  context: unknown
) {
  // 기존 구현...
}
```

**파라미터:**
- `callRequest`: 실제 핸들러를 실행하는 함수. 호출하면 `Promise<void>`를 반환한다.
- `request`: 들어온 `Request` 객체

---

## 2. Router 레벨 (클라이언트 네비게이션)

클라이언트 사이드 네비게이션과 fetcher 호출을 감싼다.

Framework Mode와 Data Mode 모두 지원한다.

### Framework Mode (entry.client.tsx)

```tsx
// entry.client.tsx
const unstable_instrumentations = [
  {
    router(router) {
      router.instrument({
        async navigate(callNavigate, { to, currentUrl }) {
          console.log(`네비게이션: ${currentUrl} → ${to}`);
          await callNavigate();
        },
        async fetch(callFetch, { href, fetcherKey }) {
          console.log(`Fetcher [${fetcherKey}]: ${href}`);
          await callFetch();
        },
      });
    },
  },
];

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter unstable_instrumentations={unstable_instrumentations} />
    </StrictMode>
  );
});
```

### Data Mode (createBrowserRouter)

```typescript
const router = createBrowserRouter(routes, {
  unstable_instrumentations: [
    {
      router(router) {
        router.instrument({
          async navigate(callNavigate, { to, currentUrl }) {
            console.log(`네비게이션: ${currentUrl} → ${to}`);
            await callNavigate();
          },
          async fetch(callFetch, { href, fetcherKey }) {
            console.log(`Fetcher [${fetcherKey}]: ${href}`);
            await callFetch();
          },
        });
      },
    },
  ],
});
```

**파라미터:**
- `navigate()`: 클라이언트 네비게이션 감시
  - `callNavigate`: 실제 네비게이션 함수
  - `to`: 이동할 URL
  - `currentUrl`: 현재 URL
- `fetch()`: fetcher 호출 감시
  - `callFetch`: 실제 fetcher 함수
  - `href`: fetcher가 요청할 경로
  - `fetcherKey`: fetcher의 고유 ID

---

## 3. Route 레벨 (개별 라우트 핸들러)

`loader`, `action`, `middleware`, 그리고 `lazy` 로딩을 개별 라우트마다 감싼다.

서버/클라이언트 모두 가능하고, Framework/Data 모드 모두 지원한다.

```typescript
// entry.server.tsx 또는 entry.client.tsx
const routeInstrumentation = {
  route(route) {
    // root 라우트는 제외 가능
    if (route.id === "root") return;

    route.instrument({
      async loader(callLoader, { params, request, unstable_pattern }) {
        console.log(`[loader] ${route.id}:`, params);
        await callLoader();
      },

      async action(callAction, { params, request, unstable_pattern }) {
        console.log(`[action] ${route.id}: ${request.method}`);
        await callAction();
      },

      async middleware(callMiddleware, { params, request, unstable_pattern }) {
        console.log(`[middleware] ${route.id}`);
        await callMiddleware();
      },

      async lazy(callLazy) {
        console.log(`[lazy] ${route.id}`);
        await callLazy();
      },
    });
  },
};

export const unstable_instrumentations = [routeInstrumentation];
```

**파라미터:**
- `params`: URL 경로 파라미터 객체 (예: `{ id: "123" }`)
- `request`: `Request` 객체
- `unstable_pattern`: 라우트 패턴 문자열 (예: `"/posts/:id"`)

---

# 에러 처리

handler를 호출한 결과는 **discriminated union**으로 반환된다. 직접 throw되지 않는다.

```typescript
route(route) {
  route.instrument({
    async loader(callLoader) {
      const result = await callLoader();

      if (result.status === "error") {
        const { error } = result;
        console.error("Loader 에러:", error);

        // Sentry, DataDog 등에 전송 가능
        reportToMonitoring(error);
      } else if (result.status === "success") {
        console.log("Loader 성공");
      }
    },
  });
}
```

**반환 형식:**

```typescript
type InstrumentationResult =
  | { status: "success" }
  | { status: "error"; error: Error };
```

## 에러 격리의 의미

- **핸들러 에러가 instrumentation 밖으로 나오지 않음**: 앱의 에러 처리 로직이 정상 작동한다.
- **instrumentation 자체의 에러는 swallow됨**: instrumentation에서 throw가 나도 앱이 죽지 않는다.
- **배열 조합에서 일부 실패해도 계속 실행**: 첫 번째 instrumentation이 실패해도 나머지는 계속 실행된다.

이는 instrumentation이 **순수 관찰**이어야 한다는 원칙 때문이다.

---

# 실전 예시

## 예시 1: 요청 타이밍 로깅 (서버)

```typescript
// entry.server.tsx
async function log(label: string, cb: () => Promise<any>) {
  const start = Date.now();
  console.log(`→ ${label}`);
  try {
    const result = await cb();
    console.log(`← ${label} OK (${Date.now() - start}ms)`);
    return result;
  } catch (error) {
    console.error(`✗ ${label} ERROR (${Date.now() - start}ms)`, error);
    throw error;
  }
}

const logging = {
  handler(handler) {
    handler.instrument({
      request: (fn, { request }) =>
        log(`${request.method} ${request.url}`, fn),
    });
  },

  route(route) {
    if (route.id === "root") return;

    route.instrument({
      loader: (fn) => log(`[loader] ${route.id}`, fn),
      action: (fn) => log(`[action] ${route.id}`, fn),
    });
  },
};

export const unstable_instrumentations = [logging];
```

**출력 예:**
```
→ GET /posts
→ [loader] routes/posts
← [loader] routes/posts OK (45ms)
← GET /posts OK (120ms)
```

---

## 예시 2: OpenTelemetry 연동

```typescript
// instrumentation/otel.ts
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("my-app");

async function otelSpan(
  spanName: string,
  attributes: Record<string, string>,
  cb: () => Promise<{ status: string; error?: Error }>
) {
  return tracer.startActiveSpan(
    spanName,
    { attributes },
    async (span) => {
      try {
        const result = await cb();

        if (result.status === "error" && result.error) {
          span.recordException(result.error);
          span.setStatus({ code: SpanStatusCode.ERROR });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error);
        }
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

export const otelInstrumentation = {
  handler(handler) {
    handler.instrument({
      request: (fn, { request }) =>
        otelSpan("http.request", {
          "http.method": request.method,
          "http.url": request.url,
        }, fn),
    });
  },

  route(route) {
    if (route.id === "root") return;

    route.instrument({
      loader: (fn, { unstable_pattern }) =>
        otelSpan("route.loader", {
          route_id: route.id,
          pattern: unstable_pattern ?? "",
        }, fn),

      action: (fn, { unstable_pattern, request }) =>
        otelSpan("route.action", {
          route_id: route.id,
          pattern: unstable_pattern ?? "",
          method: request.method,
        }, fn),
    });
  },
};
```

**사용:**

```tsx
// entry.server.tsx
import { otelInstrumentation } from "~/instrumentation/otel";

export const unstable_instrumentations = [otelInstrumentation];

export default async function handleRequest(/* ... */) {
  // ...
}
```

---

## 예시 3: 클라이언트 Performance API

```typescript
// entry.client.tsx
async function measure(label: string, cb: () => Promise<any>) {
  performance.mark(`start:${label}`);
  try {
    const result = await cb();
    performance.mark(`end:${label}`);
    performance.measure(label, `start:${label}`, `end:${label}`);
    return result;
  } catch (error) {
    // 에러 발생해도 mark 기록
    performance.mark(`error:${label}`);
    throw error;
  }
}

const perfInstrumentation = {
  router(router) {
    router.instrument({
      navigate: (fn, { to, currentUrl }) =>
        measure(`nav:${currentUrl}→${to}`, fn),

      fetch: (fn, { href, fetcherKey }) =>
        measure(`fetcher:${fetcherKey}:${href}`, fn),
    });
  },

  route(route) {
    if (route.id === "root") return;

    route.instrument({
      loader: (fn) => measure(`loader:${route.id}`, fn),
      action: (fn) => measure(`action:${route.id}`, fn),
    });
  },
};

const unstable_instrumentations = [perfInstrumentation];

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter unstable_instrumentations={unstable_instrumentations} />
    </StrictMode>
  );
});
```

**DevTools에서 Performance 탭 확인:**
```
nav:/posts→/posts/123
└── 125ms

fetcher:form:POST /posts/123
└── 45ms

loader:routes/posts.$id
└── 60ms
```

---

## 예시 4: 환경별 조건부 계측

```typescript
// entry.server.tsx
const devLogging = {
  route(route) {
    if (route.id === "root") return;
    route.instrument({
      loader: async (fn) => {
        const start = performance.now();
        const result = await fn();
        console.log(
          `[${route.id}] loader: ${(performance.now() - start).toFixed(2)}ms`
        );
        return result;
      },
    });
  },
};

const prodOtel = {
  // ... (위의 OpenTelemetry 예시)
};

// 프로덕션에서만 OTEL 활성화
export const unstable_instrumentations =
  process.env.NODE_ENV === "production"
    ? [prodOtel]
    : [devLogging];
```

---

## 예시 5: 특정 라우트만 계측

```typescript
const adminLogging = {
  route(route) {
    // admin 라우트만 계측
    if (!route.id?.startsWith("routes/admin")) return;

    route.instrument({
      action: async (fn, { request, params }) => {
        console.log(`[Admin Action] ${request.method} ${route.id}`, params);
        const result = await fn();

        if (result.status === "error") {
          // 관리자 액션 에러는 별도로 리포팅
          notifyAdmins(`Admin action failed: ${route.id}`, result.error);
        }

        return result;
      },
    });
  },
};
```

---

# Framework Mode 전체 설정 예시

완전한 실전 구성을 보여준다.

### entry.server.tsx

```typescript
import { otelInstrumentation } from "~/instrumentation/otel";

const logging = {
  handler(handler) {
    handler.instrument({
      request: async (fn, { request }) => {
        const start = Date.now();
        console.log(`→ ${request.method} ${request.url}`);
        const result = await fn();
        console.log(`← ${request.method} ${request.url} (${Date.now() - start}ms)`);
        return result;
      },
    });
  },
};

export const unstable_instrumentations = [logging, otelInstrumentation];

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  context: AppContext
) {
  // 기존 구현
  const markup = renderToString(
    <StaticRouterProvider
      router={router}
      context={staticContext}
    />
  );

  responseHeaders.set("Content-Type", "text/html");
  return new Response(`<!DOCTYPE html>${markup}`, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
```

### entry.client.tsx

```typescript
import { perfInstrumentation } from "~/instrumentation/perf";

const unstable_instrumentations = [perfInstrumentation];

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter unstable_instrumentations={unstable_instrumentations} />
    </StrictMode>
  );
});
```

### routes.ts

```typescript
import { type RouteConfig } from "@react-router/dev/routes";
import { layout, index, route } from "@react-router/dev/routes-helpers";

export const routes: RouteConfig = [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("posts", "routes/posts.tsx", [
      route(":id", "routes/posts.$id.tsx"),
    ]),
  ]),
];
```

---

# Data Mode에서의 활용

SPA(Data Mode)에서도 instrumentation을 사용할 수 있다.

```typescript
// src/main.tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes";

const routeInstrumentation = {
  route(route) {
    route.instrument({
      loader: async (fn) => {
        console.log(`Loading ${route.id}`);
        return await fn();
      },
    });
  },
};

const router = createBrowserRouter(routes, {
  unstable_instrumentations: [
    {
      router(router) {
        router.instrument({
          navigate: async (fn, { to }) => {
            console.log(`Navigating to ${to}`);
            await fn();
          },
        });
      },
    },
    routeInstrumentation,
  ],
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);
```

---

# 주의사항

## 1. 실험적 API

`unstable_` 접두사가 붙어 있다. **마이너/패치 릴리즈에서도 breaking change가 가능**하다.

프로덕션 사용 전에 React Router 릴리즈 노트를 항상 확인하자.

## 2. 읽기 전용 API

- 핸들러의 **인자를 수정할 수 없다**.
- 핸들러의 **반환값을 수정할 수 없다**.
- 순수 **관찰만 가능**하다.

값을 변경하려면 `middleware`를 사용해야 한다.

## 3. 에러 처리는 복잡할 수 있다

instrumentation 자체의 에러는 swallow되므로 **디버깅이 어려울 수 있다.**

```typescript
route(route) {
  route.instrument({
    loader: async (fn) => {
      // 이 에러는 swallow됨 (앱 콘솔에 안 보임)
      throw new Error("Oops!");
    },
  });
}
```

명시적인 로깅을 항상 포함하자.

## 4. 성능 오버헤드

모든 요청/네비게이션이 instrumentation을 거친다.

프로덕션에서는 **조건부 활성화**를 권장한다.

```typescript
export const unstable_instrumentations =
  process.env.NODE_ENV === "production"
    ? [productionOtel]
    : [];
```

## 5. 데이터 노출 주의

instrumentation에서 민감한 데이터(API 키, 사용자 정보 등)를 로깅하지 않도록 주의하자.

```typescript
// ❌ 위험
console.log("Request body:", await request.text());

// ✅ 안전
console.log("Request method:", request.method);
```

---

# 정리

| 레벨 | 위치 | 용도 | 데이터 |
|------|------|------|--------|
| **Handler** | `entry.server.tsx` | 서버 전체 요청 감시 | `request` |
| **Router** | `entry.client.tsx` 또는 main.tsx | 클라이언트 네비게이션/fetcher | `to`, `currentUrl`, `href`, `fetcherKey` |
| **Route** | `entry.server.tsx` 또는 `entry.client.tsx` | 개별 loader/action/middleware | `params`, `request`, `unstable_pattern` |

**Error Handling:**
- `result.status === "error"` 형태로 확인
- instrumentation 에러는 swallow됨
- 배열의 일부 실패해도 다른 것은 계속 실행

**Best Practices:**
- 프로덕션에서는 조건부 활성화
- 읽기 전용 규칙 지키기
- 민감한 데이터 로깅 금지
- OpenTelemetry, Sentry 등과 연동하면 강력함
