---
title: "네비게이션 차단"
date: "2026-03-23"
description: "React Router useBlocker로 미저장 변경사항이 있을 때 페이지 이탈을 방지하는 방법"
tags: ["react-router", "navigation", "useBlocker", "form", "ux"]
category: "how-to"
order: 7
---

> 공식 문서: [https://reactrouter.com/how-to/navigation-blocking](https://reactrouter.com/how-to/navigation-blocking)
> React Router v7 기준

---

# 들어가며

사용자가 폼에 데이터를 입력한 뒤 실수로 페이지를 이탈하면, 입력한 내용이 모두 사라진다.
이는 일반적인 웹 앱의 문제 중 하나다.

`useBlocker` 훅을 사용하면 **미저장 변경사항이 있을 때 네비게이션을 가로채고 사용자에게 확인 UI를 보여줄 수 있다.**

이 문서는 `useBlocker`를 활용해 폼 데이터 손실을 방지하고, 사용자 경험을 개선하는 패턴을 다룬다.

> 참고: `useBlocker` 훅 기본 개념은 [훅 가이드](../hooks/hooks.md)를 참고하세요.

---

# 지원 모드

**Framework Mode / Data Mode** — Declarative Mode는 불가

---

# useBlocker 반환값

`useBlocker`는 네비게이션 상태를 관리하는 객체를 반환한다.

```typescript
import { useBlocker } from "react-router";

const blocker = useBlocker(
  useCallback(() => isDirty, [isDirty])
);
```

## predicate 함수 시그니처

predicate 함수는 인자 없이 `boolean`만 반환할 수도 있지만, `currentLocation`과 `nextLocation`을 받아 **어디서 어디로 이동하는지 기반으로 차단 여부를 결정**할 수 있다.

```typescript
const blocker = useBlocker(
  useMemo(
    () =>
      ({ currentLocation, nextLocation }: {
        currentLocation: { pathname: string };
        nextLocation: { pathname: string };
      }) => {
        if (!isDirty) return false;
        // pathname이 실제로 바뀌는 경우에만 차단
        return currentLocation.pathname !== nextLocation.pathname;
      },
    [isDirty]
  )
);
```

이렇게 하면 같은 페이지 내 해시(#) 이동이나 쿼리스트링 변경은 차단하지 않고, **실제 라우트 변경만 차단**하는 세밀한 제어가 가능하다.

### useMemo vs useCallback

predicate 메모이제이션에는 `useCallback`과 `useMemo` 둘 다 쓸 수 있다. 의미상 차이는 없지만 일반적으로:

| | `useCallback` | `useMemo` |
|---|---|---|
| 반환 | 함수 자체 | 함수 자체 (값으로 반환) |
| 용도 | 함수 레퍼런스 안정화 | 복잡한 계산값 메모이제이션 |
| `useBlocker` 사용 | `useCallback(() => isDirty, [isDirty])` | `useMemo(() => () => isDirty, [isDirty])` |

predicate가 단순한 경우 `useCallback`, location 비교 로직이 들어가는 경우 `useMemo`가 읽기 자연스럽다.

| 속성/메서드 | 설명 |
|---|---|
| `blocker.state` | 차단 상태: `"idle"` \| `"blocked"` \| `"proceeding"` |
| `blocker.location` | 사용자가 이동하려던 목적지 location 객체 |
| `blocker.proceed()` | 차단된 네비게이션을 허용하고 진행 |
| `blocker.reset()` | 차단을 취소하고 현재 페이지에 머물기 |

**상태 의미:**

- `"idle"` — 네비게이션이 차단되지 않음 (정상 상태)
- `"blocked"` — 네비게이션이 차단됨, 사용자 확인 대기
- `"proceeding"` — 사용자가 이동을 승인함, 네비게이션 진행 중

---

# 단계별 구현

## Step 1: 기본 폼 설정

먼저 기본적인 폼 구조를 만든다. `useFetcher`를 사용해 페이지 이동 없이 폼을 전송한다.

```typescript
// routes/contact.tsx
import { useFetcher } from "react-router";
import type { Route } from ".react-router/types/routes/+types.contact";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const message = String(formData.get("message"));

  // 서버에서 처리 (데이터 저장, 이메일 전송 등)
  // ...

  return { ok: true };
}

export default function Contact() {
  const fetcher = useFetcher();

  return (
    <div>
      <h1>문의하기</h1>
      <fetcher.Form method="post">
        <label>
          이메일:
          <input name="email" type="email" required />
        </label>

        <label>
          메시지:
          <textarea name="message" required />
        </label>

        <button type="submit">
          {fetcher.state === "idle" ? "전송" : "전송 중..."}
        </button>
      </fetcher.Form>
    </div>
  );
}
```

## Step 2: dirty 상태 추적

폼 입력 필드의 값을 추적해서 "변경됨" 여부를 판단한다.

```typescript
import { useState } from "react";
import { useFetcher } from "react-router";

export default function Contact() {
  const fetcher = useFetcher();
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const email = e.currentTarget.email.value.trim();
    const message = e.currentTarget.message.value.trim();

    // 둘 다 비어있으면 dirty=false, 하나라도 입력되면 dirty=true
    setIsDirty(Boolean(email || message));
  };

  return (
    <fetcher.Form method="post" onChange={handleChange}>
      <label>
        이메일:
        <input name="email" type="email" required />
      </label>

      <label>
        메시지:
        <textarea name="message" required />
      </label>

      <button type="submit">
        {fetcher.state === "idle" ? "전송" : "전송 중..."}
      </button>
    </fetcher.Form>
  );
}
```

## Step 3: useBlocker로 네비게이션 차단

이제 `useBlocker`를 사용해 `isDirty`가 true일 때 네비게이션을 차단한다.

```typescript
import { useCallback, useState } from "react";
import { useBlocker, useFetcher } from "react-router";

export default function Contact() {
  const fetcher = useFetcher();
  const [isDirty, setIsDirty] = useState(false);

  // isDirty 상태를 predicate 함수로 전달
  // useCallback으로 메모이제이션 필수 (불필요한 재구독 방지)
  const blocker = useBlocker(
    useCallback(() => isDirty, [isDirty])
  );

  const handleChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const email = e.currentTarget.email.value.trim();
    const message = e.currentTarget.message.value.trim();
    setIsDirty(Boolean(email || message));
  };

  return (
    <fetcher.Form method="post" onChange={handleChange}>
      {/* ... 폼 필드 ... */}
    </fetcher.Form>
  );
}
```

**중요:** `useCallback`으로 predicate 함수를 메모이제이션해야 한다. 그렇지 않으면 매 렌더링마다 `blocker`가 새로 구독되어 불필요한 성능 저하가 발생한다.

## Step 4: 차단 UI 표시

`blocker.state === "blocked"`일 때 확인 UI를 표시한다.

```typescript
return (
  <div>
    <h1>문의하기</h1>

    <fetcher.Form method="post" onChange={handleChange}>
      {/* ... 폼 필드 ... */}
    </fetcher.Form>

    {/* 차단 상태일 때만 표시 */}
    {blocker.state === "blocked" && (
      <div style={{ border: "1px solid red", padding: "1rem", marginTop: "1rem" }}>
        <p>
          아직 메시지를 전송하지 않았습니다.
          페이지를 떠나면 입력한 내용이 사라집니다.
        </p>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => blocker.proceed()}
            style={{ backgroundColor: "red", color: "white" }}
          >
            페이지 떠나기
          </button>

          <button
            type="button"
            onClick={() => blocker.reset()}
            style={{ backgroundColor: "green", color: "white" }}
          >
            여기 머물기
          </button>
        </div>
      </div>
    )}
  </div>
);
```

## Step 5: 전송 성공 후 상태 정리

폼 전송이 완료되면 dirty 상태를 리셋하고, 필요시 확인 UI도 초기화한다.

```typescript
import { useEffect, useRef } from "react";

export default function Contact() {
  const fetcher = useFetcher();
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useBlocker(useCallback(() => isDirty, [isDirty]));
  const formRef = useRef<HTMLFormElement>(null);

  // 폼 전송 성공 후 처리
  useEffect(() => {
    if (fetcher.data?.ok) {
      // 폼 입력 필드 초기화
      formRef.current?.reset();
      // dirty 상태 해제
      setIsDirty(false);
      // 차단 상태 해제 (필요시)
      if (blocker.state === "blocked") {
        blocker.reset();
      }
    }
  }, [fetcher.data]);

  return (
    <fetcher.Form method="post" ref={formRef} onChange={handleChange}>
      {/* ... */}
    </fetcher.Form>
  );
}
```

---

# 전체 코드 예제

위 단계들을 모두 합친 완전한 Contact 컴포넌트:

```typescript
// routes/contact.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useFetcher, data } from "react-router";
import type { Route } from ".react-router/types/routes/+types.contact";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const message = String(formData.get("message"));

  if (!email || !message) {
    return data(
      { errors: { general: "모든 필드를 입력해주세요" } },
      { status: 400 }
    );
  }

  // 데이터 저장 (예: 데이터베이스, 이메일 전송 등)
  // await sendEmail({ email, message });

  return { ok: true };
}

export default function Contact() {
  const fetcher = useFetcher<typeof action>();
  const [isDirty, setIsDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const blocker = useBlocker(
    useCallback(() => isDirty, [isDirty])
  );

  const handleChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const email = e.currentTarget.email.value.trim();
    const message = e.currentTarget.message.value.trim();
    setIsDirty(Boolean(email || message));
  };

  useEffect(() => {
    if (fetcher.data?.ok) {
      formRef.current?.reset();
      setIsDirty(false);
      if (blocker.state === "blocked") {
        blocker.reset();
      }
    }
  }, [fetcher.data, blocker]);

  return (
    <div>
      <h1>문의하기</h1>

      <fetcher.Form method="post" ref={formRef} onChange={handleChange}>
        {fetcher.data?.errors?.general && (
          <div style={{ color: "red", marginBottom: "1rem" }}>
            {fetcher.data.errors.general}
          </div>
        )}

        <label style={{ display: "block", marginBottom: "1rem" }}>
          이메일:
          <input
            name="email"
            type="email"
            required
            style={{ display: "block", marginTop: "0.5rem", width: "100%" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "1rem" }}>
          메시지:
          <textarea
            name="message"
            required
            style={{ display: "block", marginTop: "0.5rem", width: "100%" }}
          />
        </label>

        <button type="submit">
          {fetcher.state === "idle" ? "전송" : "전송 중..."}
        </button>
      </fetcher.Form>

      {blocker.state === "blocked" && (
        <div style={{ border: "1px solid red", padding: "1rem", marginTop: "1rem" }}>
          <p>
            아직 메시지를 전송하지 않았습니다.
            페이지를 떠나면 입력한 내용이 사라집니다.
          </p>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => blocker.proceed()}
              style={{ backgroundColor: "red", color: "white", padding: "0.5rem 1rem" }}
            >
              페이지 떠나기
            </button>

            <button
              type="button"
              onClick={() => blocker.reset()}
              style={{ backgroundColor: "green", color: "white", padding: "0.5rem 1rem" }}
            >
              여기 머물기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

# 고급 패턴: 전송 후 자동 이동

보다 나은 사용자 경험을 위해, 사용자가 차단된 상태에서 폼을 전송한 후, 성공하면 **원래 이동하려던 페이지로 자동으로 진행**하게 할 수 있다.

흐름:

```
폼 입력 → 다른 페이지로 이동 시도
  ↓
네비게이션 차단 → 확인 UI 표시
  ↓
사용자가 폼 전송 버튼 클릭
  ↓
전송 성공 (fetcher.data?.ok = true)
  ↓
blocker.proceed() → 원래 목적지로 자동 이동
```

구현:

```typescript
useEffect(() => {
  if (fetcher.data?.ok) {
    if (blocker.state === "blocked") {
      // 차단 상태였다면, 원래 목적지로 진행
      blocker.proceed();
    } else {
      // 일반적인 경우: 폼만 리셋
      formRef.current?.reset();
      setIsDirty(false);
    }
  }
}, [fetcher.data, blocker]);
```

이렇게 하면 사용자 경험이 자연스러워진다:

- 사용자가 메시지를 입력하고 다른 페이지로 이동하려 함
- 확인 UI가 나타남
- 사용자가 "내 메시지를 먼저 전송하고 싶다"면, 폼 전송 버튼(또는 확인 UI와 별도의 전송 버튼)을 클릭
- 전송 성공 → 자동으로 원래 가려던 페이지로 이동

---

# 상태 흐름도

`blocker.state`의 전이 과정:

```
┌─────────────────────────────────────────────────┐
│ idle                                            │
│ (네비게이션 차단 없음, isDirty = false)         │
└────────────────┬────────────────────────────────┘
                 │
       사용자가 페이지 이탈 시도
       (isDirty = true)
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ blocked                                         │
│ (네비게이션 차단, 확인 UI 표시)                 │
└──┬──────────────────────────────────────┬───────┘
   │                                      │
   │ blocker.reset()                      │ blocker.proceed()
   │ (여기 머물기)                        │ (페이지 떠나기)
   │                                      │
   ▼                                      ▼
 idle                                  proceeding
 (차단 취소)                             (이동 진행 중)
                                           │
                                           ▼
                                         (라우트 변경)
```

---

# 주의사항

## 1. useCallback으로 메모이제이션 필수

```typescript
// ❌ 잘못된 예
const blocker = useBlocker(() => isDirty);
// 매 렌더링마다 새로운 함수 → blocker 재구독 → 성능 저하

// ✅ 올바른 예
const blocker = useBlocker(
  useCallback(() => isDirty, [isDirty])
);
// 의존성 배열이 변경될 때만 새로운 함수
```

## 2. proceed() / reset()은 blocked 상태에서만 호출

```typescript
// ❌ 안전하지 않은 예
blocker.proceed(); // blocker.state가 "idle"이면?

// ✅ 안전한 예
if (blocker.state === "blocked") {
  blocker.proceed();
}
```

## 3. Declarative Mode에서는 사용 불가

`useBlocker`는 **Framework Mode** 또는 **Data Mode**에서만 사용할 수 있다.
Declarative Mode(RouteGuard 등)에서는 사용할 수 없다.

## 4. 브라우저 새로고침 / 탭 닫기는 별도 처리

`useBlocker`는 클라이언트 사이드 네비게이션만 차단한다.
브라우저의 새로고침이나 탭 닫기는 JavaScript에서 막을 수 없고, 브라우저 기본 확인 다이얼로그만 띄울 수 있다.

React Router는 이를 위한 전용 훅 `useBeforeUnload`를 제공한다:

```typescript
import { useBeforeUnload } from "react-router";

useBeforeUnload((event) => {
  if (!isDirty) return;
  event.preventDefault();
  event.returnValue = ""; // Chrome 등 일부 브라우저에서 필요
});
```

`window.addEventListener("beforeunload", ...)` 직접 등록과 동일하게 동작하지만, React Router 생명주기에 맞게 마운트/언마운트를 자동으로 처리해준다.

> `useBeforeUnload`와 `useBlocker`는 **서로 다른 이탈 경로를 담당**한다. 완전한 보호를 위해 두 훅을 함께 쓴다:
>
> | 훅 | 차단 대상 |
> |---|---|
> | `useBlocker` | `<Link>`, `navigate()` 등 앱 내부 라우팅 |
> | `useBeforeUnload` | 새로고침, 탭 닫기, 주소창 직접 입력 |

`window.addEventListener` 방식이 필요한 경우:

```typescript
useEffect(() => {
  if (!isDirty) return;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [isDirty]);
```

## 5. async 검증 고려

만약 전송 전 비동기 검증(예: 이메일 중복 확인)이 필요하다면:

```typescript
const [isValidating, setIsValidating] = useState(false);

// 차단은 유효성 검사 중에도 유지
const blocker = useBlocker(
  useCallback(() => isDirty || isValidating, [isDirty, isValidating])
);
```

---

# 정리

| 개념 | 설명 |
|---|---|
| `isDirty` | 폼이 변경되었는지 추적하는 상태 |
| `useBlocker` | isDirty일 때 앱 내부 네비게이션 차단 |
| `blocker.state` | 차단 상태 (`"idle"` \| `"blocked"` \| `"proceeding"`) |
| `blocker.proceed()` | 차단된 네비게이션 허용 |
| `blocker.reset()` | 차단 취소, 현재 페이지 유지 |
| predicate 시그니처 | `({ currentLocation, nextLocation }) => boolean` — 이동 경로 기반 세밀한 차단 가능 |
| `useCallback` / `useMemo` | predicate 함수 메모이제이션 필수 |
| `useBeforeUnload` | 새로고침/탭 닫기 처리 (React Router 제공 훅) |
