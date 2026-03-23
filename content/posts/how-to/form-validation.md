---
title: "폼 유효성 검사"
date: "2026-03-23"
description: "React Router에서 서버사이드 폼 유효성 검사 — data() + HTTP 400 패턴과 에러 표시"
tags: ["react-router", "form", "validation", "action"]
category: "how-to"
order: 3
---

> 공식 문서: [https://reactrouter.com/how-to/form-validation](https://reactrouter.com/how-to/form-validation)
> React Router v7 기준

---

# 들어가며

React Router에서 폼 유효성 검사는 **서버에서 수행**하는 것이 원칙이다.
클라이언트에서만 검사하면 우회 가능하기 때문이다.

action에서 데이터를 검증하고, 실패 시 에러를 반환한 후, 컴포넌트에서 표시한다.
이 문서는 그 핵심 패턴을 다룬다.

> 참고: `useFetcher`와 `fetcher.Form`의 기본 개념은 [fetcher 가이드](./using-fetchers.md)를 참고하세요.
> 이 글은 **서버 validation + HTTP 400 패턴**에 집중합니다.

> **전제: 풀스택 구조**
> 이 패턴은 React Router의 `action`(서버 함수)을 직접 사용하는 **풀스택 구조** 기준이다.
> 백엔드 API 서버가 분리된 구조라면 `action`보다 **RHF + `useMutation`으로 API를 직접 호출**하고,
> 서버 validation 에러는 API 응답에서 받아 RHF의 `setError()`로 처리하는 패턴이 더 자연스럽다.
> 관련 내용은 [Actions 가이드](../core-concepts/actions.md)의 "백엔드 분리 구조" 섹션을 참고.

---

# 지원 모드

**Framework Mode / Data Mode** — Declarative Mode는 불가

---

# 핵심 패턴: `data()` + HTTP 400

## 왜 HTTP 400인가?

React Router에서 **2xx 상태 코드로 응답하면 모든 loader를 재검증(revalidation)한다.**

validation 실패 시를 생각해보자:

```typescript
// ❌ 이렇게 하면 안 된다
if (!email.includes("@")) {
  return { errors: { email: "유효하지 않은 이메일 주소입니다" } };
  // 200으로 응답됨 → 불필요한 loader 재검증 발생
}
```

200 상태로 반환하면:
- action 완료 후 모든 loader가 다시 실행됨
- 데이터베이스 조회, API 호출 등이 불필요하게 반복됨
- 사용자 입력이 유효하지 않은데 페이지 상태가 리셋됨

**HTTP 400은 "이 요청은 아직 처리되지 않았다"는 의미.**
400으로 응답하면 loader 재검증이 발생하지 않는다.

```typescript
// ✅ 올바른 패턴
if (!email.includes("@")) {
  return data(
    { errors: { email: "유효하지 않은 이메일 주소입니다" } },
    { status: 400 }
  );
  // 400으로 응답 → loader 재검증 없음
}
```

---

# 기본 예제: `<fetcher.Form>` 방식

`useFetcher`를 사용하면 **페이지 이동 없이** validation 결과를 받을 수 있다.

## Action 구현

```typescript
import { data, redirect } from "react-router";
import type { Route } from ".react-router/types/routes/+types.signup";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const errors: Record<string, string> = {};

  if (!email.includes("@")) {
    errors.email = "유효하지 않은 이메일 주소입니다";
  }
  if (password.length < 12) {
    errors.password = "비밀번호는 12자 이상이어야 합니다";
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 });
  }

  // validation 성공
  await createUser({ email, password });
  return redirect("/dashboard");
}
```

## 컴포넌트 구현

```typescript
import { useFetcher } from "react-router";

export default function SignupPage() {
  const fetcher = useFetcher<typeof action>();

  return (
    <div>
      <h1>회원가입</h1>
      <fetcher.Form method="post">
        <div>
          <label htmlFor="email">이메일</label>
          <input type="email" id="email" name="email" required />
          {fetcher.data?.errors?.email ? (
            <em style={{ color: "red" }}>{fetcher.data.errors.email}</em>
          ) : null}
        </div>

        <div>
          <label htmlFor="password">비밀번호 (12자 이상)</label>
          <input type="password" id="password" name="password" required />
          {fetcher.data?.errors?.password ? (
            <em style={{ color: "red" }}>{fetcher.data.errors.password}</em>
          ) : null}
        </div>

        <button type="submit">가입하기</button>
      </fetcher.Form>
    </div>
  );
}
```

## 흐름 정리

```
┌─ 사용자가 폼 제출
│
├─ fetcher.Form → action 호출
│
├─ validation 실패
│  └─ data({ errors }, { status: 400 }) 반환
│     └─ 상태: 400 → loader 재검증 없음
│
├─ fetcher.data.errors로 컴포넌트 업데이트
│  └─ 에러 메시지 표시 (같은 페이지)
│
└─ validation 성공
   └─ redirect("/dashboard")
      └─ 페이지 이동
```

---

# `<Form>` + `useActionData()` 방식

form 제출 후 다른 페이지로 이동하거나, 같은 페이지에 머물 예정이라면 `<Form>`을 사용할 수 있다.

```typescript
import { Form, useActionData } from "react-router";

export default function SignupPage() {
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;

  return (
    <div>
      <h1>회원가입</h1>
      <Form method="post">
        <div>
          <label htmlFor="email">이메일</label>
          <input type="email" id="email" name="email" required />
          {errors?.email ? (
            <em style={{ color: "red" }}>{errors.email}</em>
          ) : null}
        </div>

        <div>
          <label htmlFor="password">비밀번호 (12자 이상)</label>
          <input type="password" id="password" name="password" required />
          {errors?.password ? (
            <em style={{ color: "red" }}>{errors.password}</em>
          ) : null}
        </div>

        <button type="submit">가입하기</button>
      </Form>
    </div>
  );
}
```

| 측면 | `<Form>` | `<fetcher.Form>` |
|------|------|---|
| 네비게이션 | 발생함 | 발생 안 함 |
| 에러 읽기 | `useActionData()` | `fetcher.data` |
| 페이지 리셋 | 발생함 | 발생 안 함 |
| 적합한 경우 | 제출 후 페이지 이동 | 같은 페이지에서 에러 표시 |

---

# 실전: Zod로 validation 강화

매번 if문을 작성하는 것은 번거롭다. **Zod 스키마**를 사용하면 검증을 선언적으로 작성할 수 있다.

```typescript
import { z } from "zod";
import { data, redirect } from "react-router";
import type { Route } from ".react-router/types/routes/+types.signup";

const SignupSchema = z.object({
  email: z
    .string()
    .email("유효하지 않은 이메일 주소입니다")
    .min(1, "이메일을 입력해주세요"),
  password: z
    .string()
    .min(12, "비밀번호는 12자 이상이어야 합니다")
    .min(1, "비밀번호를 입력해주세요"),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const input = Object.fromEntries(formData);

  const result = SignupSchema.safeParse(input);

  if (!result.success) {
    // fieldErrors: { email: ["..."], password: ["..."] }
    const errors = result.error.flatten().fieldErrors;
    return data({ errors }, { status: 400 });
  }

  // result.data는 타입 안전
  await createUser(result.data);
  return redirect("/dashboard");
}
```

## Zod `fieldErrors` 처리

`SafeParseError`의 `flatten().fieldErrors`는 각 필드마다 **에러 배열**을 반환한다.

```typescript
// errors의 구조
{
  email: ["유효하지 않은 이메일 주소입니다"],
  password: ["비밀번호는 12자 이상이어야 합니다"]
}
```

컴포넌트에서는 **첫 번째 에러**를 표시하면 된다:

```typescript
{errors?.email?.[0] ? (
  <em style={{ color: "red" }}>{errors.email[0]}</em>
) : null}
```

또는 **모든 에러를 리스트로** 표시할 수도 있다:

```typescript
{errors?.email ? (
  <ul style={{ color: "red" }}>
    {errors.email.map((err, i) => (
      <li key={i}>{err}</li>
    ))}
  </ul>
) : null}
```

---

# `<Form>` + Zod 완전한 예제

```typescript
// route.tsx
import { z } from "zod";
import { data, redirect } from "react-router";
import type { Route } from ".react-router/types/routes/+types.signup";

const SignupSchema = z.object({
  email: z
    .string()
    .email("유효하지 않은 이메일 주소입니다")
    .min(1, "이메일을 입력해주세요"),
  password: z
    .string()
    .min(12, "비밀번호는 12자 이상이어야 합니다")
    .min(1, "비밀번호를 입력해주세요"),
  confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["confirmPassword"],
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const input = Object.fromEntries(formData);

  const result = SignupSchema.safeParse(input);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    return data({ errors }, { status: 400 });
  }

  const { email, password } = result.data;
  await createUser({ email, password });
  return redirect("/dashboard");
}

export default function SignupPage() {
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;

  return (
    <Form method="post">
      <div>
        <label htmlFor="email">이메일</label>
        <input type="email" id="email" name="email" required />
        {errors?.email?.[0] && (
          <em style={{ color: "red" }}>{errors.email[0]}</em>
        )}
      </div>

      <div>
        <label htmlFor="password">비밀번호 (12자 이상)</label>
        <input type="password" id="password" name="password" required />
        {errors?.password?.[0] && (
          <em style={{ color: "red" }}>{errors.password[0]}</em>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword">비밀번호 확인</label>
        <input type="password" id="confirmPassword" name="confirmPassword" required />
        {errors?.confirmPassword?.[0] && (
          <em style={{ color: "red" }}>{errors.confirmPassword[0]}</em>
        )}
      </div>

      <button type="submit">가입하기</button>
    </Form>
  );
}
```

---

# 주의사항

## 1. `data()` import 확인

`data` 함수는 `react-router`에서 import하세요:

```typescript
import { data, redirect } from "react-router";
```

## 2. errors 객체 구조 유지

에러 객체는 **flat한 구조**를 유지하는 것이 권장된다:

```typescript
// ✅ Good
{ email: "...", password: "..." }

// ❌ Bad
{ fields: { email: "...", password: "..." } }
```

Zod를 사용하면 `flatten().fieldErrors`로 자동으로 정리된다.

## 3. Zod `fieldErrors`는 배열

```typescript
// fieldErrors는 배열
{
  email: ["유효하지 않은 이메일 주소입니다"],
  password: ["비밀번호는 12자 이상이어야 합니다", "다른 에러..."]
}
```

컴포넌트에서는 `[0]`으로 **첫 번째 에러**를 접근하거나, 모든 에러를 리스트로 표시하세요.

## 4. Zod 크로스 필드 validation

두 개 이상의 필드를 함께 검증해야 할 때는 `.refine()`을 사용하세요:

```typescript
const schema = z.object({
  password: z.string().min(12),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["confirmPassword"], // 어느 필드에 에러를 표시할지
});
```

---

# 정리

| 항목 | 설명 |
|------|------|
| **HTTP 상태** | validation 실패 시 **400**, 성공 시 **redirect** |
| **왜 400?** | loader 재검증 방지 → 성능 향상 |
| **에러 전달** | `data({ errors }, { status: 400 })` |
| **폼 선택** | 같은 페이지: `<fetcher.Form>` / 페이지 이동: `<Form>` |
| **에러 읽기** | `fetcher.data` 또는 `useActionData()` |
| **Zod 사용** | `.safeParse()` → `flatten().fieldErrors` |
| **Zod 에러 구조** | 배열 — `errors.email[0]`으로 첫 번째 접근 |
