---
title: '미들웨어'
date: '2026-03-23'
category: 'how-to'
order: 6
tags: ['react-router', 'middleware', 'context', 'auth', 'logging']
description: 'React Router 미들웨어의 Context API, 중첩 실행 흐름, 실전 패턴 — 인증·로깅·CMS 리다이렉트'
---

> 공식 문서: [https://reactrouter.com/how-to/middleware](https://reactrouter.com/how-to/middleware)
> React Router v7 기준

---

# 들어가며

미들웨어는 loader/action 실행 전후에 요청을 가로채서 처리하는 기능이다.
기본적인 미들웨어 작성(`middleware`, `clientMiddleware` export)은 [라우트 모듈 가이드](../core-concepts/route-module.md) 섹션 6·7에서 다뤘다.

이 글은 세 가지에 집중한다:

1. **중첩 실행 흐름** — 라우트 계층 구조에 따라 미들웨어가 어떻게 겹겹이 실행되는가
2. **Context API** — 타입 안전하게 라우트 간 데이터를 공유하는 방법
3. **실전 패턴** — 인증, 로깅, CMS 리다이렉트, 응답 헤더, 데이터 공유

Framework Mode 사용 시 `v8_middleware: true` 플래그를 활성화해야 한다([설정 가이드](../framework-conventions/react-router-config.md) 참고).

---

# 중첩 실행 흐름

미들웨어는 라우트 계층 순서대로 감싸면서 실행된다.

```
Root middleware 시작
  Parent middleware 시작
    Child middleware 시작
      loader/action 실행 → HTML Response 생성
    Child middleware 종료
  Parent middleware 종료
Root middleware 종료
```

가장 바깥 라우트(Root)의 미들웨어가 가장 먼저 시작되고 가장 나중에 종료된다.

예를 들어, `/dashboard/profile` 라우트 구조가 있다면:

```typescript
// app/routes/root.tsx
export const middleware = [globalLoggingMiddleware];

// app/routes/dashboard.tsx
export const middleware = [authMiddleware];

// app/routes/dashboard.profile.tsx
export const middleware = [profileLoadingMiddleware];
```

실행 순서:

```
globalLoggingMiddleware 시작
  authMiddleware 시작
    profileLoadingMiddleware 시작
      loader/action 실행
    profileLoadingMiddleware 종료
  authMiddleware 종료
globalLoggingMiddleware 종료
```

---

# 서버 미들웨어 실행 시점

서버 미들웨어가 실행되는 시점은 요청 유형에 따라 다르다.

| 요청 유형 | 실행 조건 |
|---|---|
| 문서 요청 (`GET /route`) | 항상 실행 |
| 데이터 요청 (`GET /route.data`) | 해당 라우트에 loader/action이 있을 때만 실행 |

**클라이언트 미들웨어**는 모든 클라이언트 네비게이션에서 항상 실행된다(SPA 전환).

---

# Context API — 타입 안전 컨텍스트

미들웨어의 핵심 기능이다. 라우트 간 데이터를 타입 안전하게 공유한다.

## createContext로 컨텍스트 정의

```typescript
// app/context.ts
import { createContext } from "react-router";
import type { User } from "~/types";

export const userContext = createContext<User | null>(null);
export const requestIdContext = createContext<string>();
```

`createContext`는 TypeScript 제네릭을 받아 타입을 강제한다.

## 미들웨어에서 set, loader에서 get

```typescript
// app/routes/dashboard.tsx
import { redirect } from "react-router";
import { userContext } from "~/context";
import type { Route } from "./+types/dashboard";

async function authMiddleware({ request, context }: Route.MiddlewareArgs) {
  const user = await getUserFromSession(request);
  if (!user) throw redirect("/login");
  context.set(userContext, user); // User 타입 강제
}

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext); // User | null 타입으로 반환
  const profile = await getProfile(user!);
  return { profile };
}
```

## RouterContextProvider로 초기 컨텍스트 설정

Framework Mode에서 `getLoadContext` 업데이트:

```typescript
// server.ts 또는 express adapter
import { createContext, RouterContextProvider } from "react-router";

const dbContext = createContext<Database>();

function getLoadContext(req: Request) {
  const context = new RouterContextProvider();
  context.set(dbContext, createDb());
  return context;
}
```

Data Mode에서 `getContext`:

```typescript
const router = createBrowserRouter(routes, {
  getContext() {
    const context = new RouterContextProvider();
    context.set(sessionContext, getSession());
    return context;
  },
});
```

---

# next() 동작 상세

```typescript
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    // ① next() 호출 전: 요청 처리 전 로직
    console.log("Before");

    const response = await next(); // ② 다음 미들웨어 또는 loader/action 실행

    // ③ next() 호출 후: 응답 후처리
    console.log("After", response.status);

    return response; // 서버 미들웨어는 반드시 반환
  },
];
```

**규칙:**

- `next()`는 미들웨어당 **한 번만** 호출 가능
- 서버 미들웨어는 `next()`가 반환한 Response를 **반드시 return**
- 클라이언트 미들웨어는 return 불필요

---

# 실전 패턴

## 패턴 1: 인증 + 컨텍스트 전달

```typescript
// app/middleware/auth.ts
import { redirect } from "react-router";
import { userContext } from "~/context";

export const authMiddleware = async ({ request, context }: any, next: any) => {
  const session = await getSession(request);
  const userId = session.get("userId");

  if (!userId) throw redirect("/login");

  const user = await getUserById(userId);
  context.set(userContext, user);

  return next();
};
```

```typescript
// app/routes/dashboard.tsx
import { authMiddleware } from "~/middleware/auth";

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext); // 인증 보장
  return { user };
}
```

## 패턴 1-b: httpOnly 쿠키 기반 인증

프로덕션에서 권장하는 방식. `createCookieSessionStorage`로 httpOnly 쿠키를 사용하면 JS로 세션 토큰에 접근할 수 없어 XSS 공격을 방어한다.

```typescript
// app/session.server.ts
import { createCookieSessionStorage } from "react-router";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,                                      // JS 접근 차단
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET!],             // 서명용 시크릿
    maxAge: 60 * 60 * 24 * 30,                          // 30일
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}
```

```typescript
// app/middleware/auth.ts
import { redirect } from "react-router";
import { getSession } from "~/session.server";
import { userContext } from "~/context";

export const authMiddleware = async ({ request, context }: any, next: any) => {
  const session = await getSession(request);
  const userId = session.get("userId");

  if (!userId) throw redirect("/login");

  const user = await getUserById(userId);
  context.set(userContext, user);

  return next();
};
```

로그인 action에서 쿠키 발급:

```typescript
// app/routes/login.tsx
import { sessionStorage } from "~/session.server";
import { data, redirect } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const user = await verifyLogin(
    String(formData.get("email")),
    String(formData.get("password")),
  );

  if (!user) {
    return data({ error: "이메일 또는 비밀번호가 틀렸습니다" }, { status: 400 });
  }

  const session = await sessionStorage.getSession();
  session.set("userId", user.id);

  return redirect("/dashboard", {
    headers: {
      // httpOnly 쿠키 자동 발급 — 브라우저 JS로 접근 불가
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}
```

로그아웃 action에서 쿠키 삭제:

```typescript
export async function action({ request }: Route.ActionArgs) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie"),
  );
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
```

> 참고: [Sessions and Cookies | React Router 공식 문서](https://reactrouter.com/explanation/sessions-and-cookies), [Cookie-based Authentication in Remix | Tiger Abrodi](https://tigerabrodi.blog/cookie-based-authentication-in-remix)

---

## 패턴 2: 요청 로깅 + requestId

```typescript
import { requestIdContext } from "~/context";

export const loggingMiddleware = async ({ request, context }: any, next: any) => {
  const requestId = crypto.randomUUID();
  context.set(requestIdContext, requestId);

  const start = performance.now();
  console.log(`[${requestId}] → ${request.method} ${request.url}`);

  const response = await next();

  console.log(
    `[${requestId}] ← ${response.status} (${(performance.now() - start).toFixed(1)}ms)`
  );

  return response;
};
```

## 패턴 3: CMS 리다이렉트 (404 처리)

404 응답을 잡아서 CMS 리다이렉트로 폴백하는 패턴.

**서버:**

```typescript
import { redirect } from "react-router";

export const cmsFallbackMiddleware = async ({ request }: any, next: any) => {
  const response = await next();

  if (response.status === 404) {
    const cmsRedirect = await checkCMSRedirects(request.url);
    if (cmsRedirect) {
      throw redirect(cmsRedirect, 302);
    }
  }

  return response;
};
```

**클라이언트:**

```typescript
import { isRouteErrorResponse } from "react-router";

async function cmsFallbackMiddleware({ request }: any, next: any) {
  const results = await next();

  const found404 = Object.values(results as Record<string, any>).some(
    (r) => isRouteErrorResponse(r.result) && r.result.status === 404
  );

  if (found404) {
    const cmsRedirect = await checkCMSRedirects(request.url);
    if (cmsRedirect) throw redirect(cmsRedirect, 302);
  }
}
```

## 패턴 4: 응답 헤더 추가

```typescript
export const securityHeadersMiddleware = async (_: any, next: any) => {
  const response = await next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
};
```

## 패턴 5: action/loader 간 비싼 데이터 공유

같은 요청에서 action과 loader가 동일한 데이터가 필요할 때, 미들웨어에서 한 번만 fetch:

```typescript
const sharedDataContext = createContext<ExpensiveData>();

export const middleware: Route.MiddlewareFunction[] = [
  async ({ context }, next) => {
    // 아직 없을 때만 fetch (중복 방지)
    if (!context.get(sharedDataContext)) {
      context.set(sharedDataContext, await getExpensiveData());
    }
    return next();
  },
];

export async function action({ context }: Route.ActionArgs) {
  const data = context.get(sharedDataContext); // 이미 fetch됨
  // ...
}

export async function loader({ context }: Route.LoaderArgs) {
  const data = context.get(sharedDataContext); // 동일 데이터
  // ...
}
```

> ⚠️ 서버에서는 **문서 POST 요청**일 때만 작동.
> SPA 방식(fetch 제출)은 action/loader가 별도 요청이므로 공유 안 됨.

## 패턴 6: 조건부 미들웨어

```typescript
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    // POST 요청에만 인증
    if (request.method === "POST") {
      await ensureAuthenticated(request, context);
    }
    return next();
  },
];
```

---

# AppLoadContext 마이그레이션

v7 이전 방식에서 마이그레이션하는 방법.

**기존 코드:**

```typescript
declare module "react-router" {
  interface AppLoadContext {
    db: Database;
    user: User;
  }
}

function getLoadContext() {
  return { db: createDb(), user: getUser() };
}
```

**마이그레이션 후:**

```typescript
// app/context.ts
import { createContext } from "react-router";

export const dbContext = createContext<Database>();
export const userContext = createContext<User>();

// server.ts
function getLoadContext() {
  const context = new RouterContextProvider();
  context.set(dbContext, createDb());
  context.set(userContext, getUser());
  return context;
}

// 라우트에서
export async function loader({ context }: Route.LoaderArgs) {
  const db = context.get(dbContext);
  const user = context.get(userContext);
}
```

---

# 에러 처리

미들웨어에서 발생한 에러는 항상 Response 형태로 반환되며 ErrorBoundary에서 처리된다:

```typescript
export const middleware: Route.MiddlewareFunction[] = [
  async (_, next) => {
    const response = await next();
    // response.status가 500이어도 throw되지 않음
    // ErrorBoundary가 처리
    return response;
  },
];
```

---

# 주의사항

- `next()`는 미들웨어당 **한 번만** 호출
- 서버 미들웨어는 Response를 **반드시 return**
- 클라이언트 미들웨어는 Response 객체 없음
- action/loader 컨텍스트 공유는 **문서 POST 요청에서만** 작동
- Framework Mode 사용 시 `v8_middleware: true` 플래그 필수 ([설정 가이드](../framework-conventions/react-router-config.md) 참고)
