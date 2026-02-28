---
title: "Testing"
date: "2026-02-22"
description: "React Router v7 컴포넌트 테스트 방법과 createRoutesStub"
tags: ["react-router", "testing"]
category: "core-concepts"
order: 10
---

> 공식 문서: [https://reactrouter.com/start/framework/testing](https://reactrouter.com/start/framework/testing)

# 개요

`useLoaderData`, `useActionData` 등 RR v7 훅을 사용하는 컴포넌트는 **React Router 컨텍스트 안에서** 렌더링되어야 한다.
`createRoutesStub`을 사용하면 실제 앱을 마운트하지 않고 컴포넌트를 단독으로 테스트할 수 있다.

---

# createRoutesStub

## 기본 사용법

`useActionData`에 의존하는 `LoginForm` 컴포넌트 예시:

```typescript
// LoginForm.tsx
import { useActionData } from "react-router";

export function LoginForm() {
  const actionData = useActionData();
  const errors = actionData?.errors;

  return (
    <form>
      <button type="submit">Login</button>
      {errors?.username && <p>{errors.username}</p>}
      {errors?.password && <p>{errors.password}</p>}
    </form>
  );
}
```

```typescript
// LoginForm.test.tsx
import { createRoutesStub } from "react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

test("LoginForm renders error messages", async () => {
  const USER_MESSAGE = "Username is required";
  const PASSWORD_MESSAGE = "Password is required";

  const Stub = createRoutesStub([
    {
      path: "/login",
      Component: LoginForm,
      action() {
        // 실제 action을 가짜로 대체
        return {
          errors: {
            username: USER_MESSAGE,
            password: PASSWORD_MESSAGE,
          },
        };
      },
    },
  ]);

  // 스터브 렌더링
  render(<Stub initialEntries={["/login"]} />);

  // 상호작용 시뮬레이션
  userEvent.click(screen.getByText("Login"));

  await waitFor(() => screen.findByText(USER_MESSAGE));
  await waitFor(() => screen.findByText(PASSWORD_MESSAGE));
});
```

**`createRoutesStub`에 전달하는 객체는 route module과 동일한 구조:**

- `path`: 스터브 경로
- `Component`: 테스트할 컴포넌트
- `loader()`: `useLoaderData` 모크
- `action()`: `useActionData` 모크

---

# Framework Mode 타입과의 호환성 문제

## 작동 안 하는 패턴

```typescript
// routes/login.tsx
export default function Login({
  actionData, // Route.ComponentProps 타입 사용
}: Route.ComponentProps) {
  return <form>...</form>;
}
```

```typescript
// routes/login.test.tsx
import LoginRoute from "./login";

test("...", async () => {
  const Stub = createRoutesStub([
    {
      path: "/login",
      Component: LoginRoute,
      // 타입 충돌 발생!
      // Route.ComponentProps는 실제 앱의 loader/action 반환값과
      // 라우트 트리 구조에서 타입을 추론하는데,
      // createRoutesStub는 해당 타입을 제공 불가능
    },
  ]);
});
```

## 이유

`Route.*` 타입은 **실제 앱의 loader/action 함수 + 라우트 트리 구조**에서 자동 추론된다.
`createRoutesStub`는 다른 라우트 트리를 제공하므로 두 타입이 맞지 않는다.
`matches` 타입도 문제가 된다. 실제론 `root` + 모든 조상 라우트가 있어야 하는데 스터브에서는 테스트 라우트만 존재하기 때문이다.

---

# 언제 무엇을 써야 하나?

| 대상 | 권장 도구 | 이유 |
|---|---|---|
| **재사용 컴포넌트** (`LoginForm`, `SearchBox` 등) | `createRoutesStub` + 유닛 테스트 | RR 컨텍스트만 제공하면 됨 |
| **Route 컴포넌트** (`Route.ComponentProps` 사용) | Playwright / Cypress E2E | 타입 추론 한계, 실제 앱 기반 필요 |

> 공식 문서 권장사항:
> Route 레벨 컴포넌트 테스트는 **Integration/E2E 테스트(Playwright, Cypress)**로 진행하라.
> 런닝 앱 대상 테스트이므로 유닛 테스트 영역을 벗어난다.

---

# 정리

```javascript
유닛 테스트 대상
  └ useLoaderData / useActionData 등 RR 훅 사용 컴포넌트
  └ createRoutesStub로 loader/action 모킹
  └ 타입: Route.* 사용하지 말 것 (generic useLoaderData 등 사용)

E2E 테스트 대상
  └ Route 컴포넌트 (Route.ComponentProps 사용)
  └ loader/action과 라우트 트리 통합 테스트
  └ Playwright, Cypress 등 런닝 앱 대상
```

> **핵심**
> `createRoutesStub` = 재사용 컴포넌트 유닛 테스트용
> `Route.*` 타입 사용 Route 컴포넌트 테스트 → E2E로
