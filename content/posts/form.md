---
title: "<Form>"
date: "2026-02-22"
description: "React Router v7의 Form 컴포넌트 API와 Progressive Enhancement"
tags: ["react-router", "form", "api"]
category: "api-reference"
order: 13
---

> 공식 문서: [https://reactrouter.com/api/components/Form](https://reactrouter.com/api/components/Form)

# 개요

`<Form>`은 HTML `<form>`을 **Progressive Enhancement** 방식으로 확장한 컴포넌트다.

- JavaScript 로드 전: 브라우저가 폼 제출을 직접 관리 (기본 HTML form 동작)
- JavaScript 로드 후: React Router가 제어를 이어받아 fetch 기반 SPA 경험 제공

제출이 완료되면 **페이지의 모든 데이터가 자동 재검증**되어 UI와 서버 상태가 동기화된다.

> **`<Form>`** vs **`<fetcher.Form>`**
> - `<Form>` → 네비게이션 발생, History 스택에 항목 추가
> - `<fetcher.Form>` → 네비게이션 없음, History 스택 변경 없음

```typescript
import { Form } from "react-router";

function NewEvent() {
  return (
    <Form action="/events" method="post">
      <input name="title" type="text" />
      <input name="description" type="text" />
    </Form>
  );
}
```

---

# Props 전체 정리

## `action`

폼 데이터를 제출할 URL. 생략하면 컨텍스트상 가장 가까운 라우트로 제출된다.

```typescript
<Form action="/events" method="post" />
<Form method="post" /> // 현재 라우트의 action 호출
```

## `method`

제출 시 사용할 HTTP 메서드. `"get"`, `"post"`, `"put"`, `"patch"`, `"delete"` 지원.

```typescript
<Form method="get" />   // loader 호출, URLSearchParams로 전달
<Form method="post" />  // action 호출, FormData로 전달
<Form method="delete" /> // action 호출
```

> 네이티브 `<form>`은 `get`과 `post`만 지원한다. Progressive Enhancement가 필요하면 이 두 가지만 사용할 것.

## `encType`

폼 데이터 인코딩 방식.

```typescript
<Form encType="application/x-www-form-urlencoded" /> // 기본값
<Form encType="multipart/form-data" />               // 파일 업로드 시
<Form encType="text/plain" />
```

## `navigate`

`false`로 설정하면 네비게이션 없이 fetcher를 통해 제출된다.
`useFetcher` + `<fetcher.Form>` 조합의 축약 표현이지만, 결과 데이터를 이 컴포넌트에서 읽을 필요 없을 때 사용.

```typescript
<Form method="post" navigate={false} />
// = fetcher.Form과 동일하지만 fetcher 상태를 이 컴포넌트에서 읽지 않을 때
```

## `fetcherKey`

`navigate={false}` 사용 시 특정 fetcherKey를 지정해 다른 컴포넌트에서 `useFetcher(key)`로 상태를 읽을 수 있다.

```typescript
<Form method="post" navigate={false} fetcherKey="my-form" />

// 다른 컴포넌트에서
const fetcher = useFetcher({ key: "my-form" });
fetcher.state; // 상태 접근 가능
```

## `replace`

제출 후 History 스택을 교체한다. 유저가 "뒤로가기"로 폼 페이지로 돌아오지 못하게 할 때 사용.

```typescript
<Form method="post" replace />
// history.push 대신 history.replace 동작
```

## `preventScrollReset`

`<ScrollRestoration>`을 사용할 때, 제출 완료 후 스크롤이 맨 위로 초기화되는 것을 방지한다.

```typescript
<Form method="post" preventScrollReset />
```

## `state`

History 스택 항목에 추가할 상태 객체. `useLocation().state`로 접근 가능.

```typescript
<Form method="post" state={{ from: "modal" }} />

// 이동 후
const location = useLocation();
location.state; // { from: "modal" }
```

## `relative`

action URL의 기준을 라우트 계층(`"route"`, 기본) 또는 URL 경로(`"path"`)로 설정한다.

```typescript
<Form action="../edit" relative="path" /> // 슬래시 기준 상대 경로
<Form action="../edit" relative="route" /> // 라우트 계층 기준 (기본값)
```

## `reloadDocument`

client-side routing 없이 전체 문서 네비게이션을 강제한다. (SPA 비활성화)

```typescript
<Form method="post" reloadDocument />
// 브라우저 기본 폼 제출처럼 동작
```

## `viewTransition`

이 네비게이션에 [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)를 활성화한다.

```typescript
<Form method="post" viewTransition />
// 전환 중 특정 스타일 적용은 useViewTransitionState 참조
```

## `discover`

Lazy Route Discovery 동작을 설정한다.

```typescript
<Form />                  // 기본값: "render" - 렌더링 시 라우트 미리 탐색
<Form discover="none" />  // 제출 시에만 탐색
```

## `unstable_defaultShouldRevalidate`

제출 후 기본 재검증 동작을 지정한다. 검색 파라미터 업데이트 시 불필요한 재검증을 막을 때 유용.

---

# Props 한눈에 보기

| Prop | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `action` | string | 현재 라우트 | 제출 URL |
| `method` | string | `"get"` | HTTP 메서드 |
| `encType` | string | `"application/x-www-form-urlencoded"` | 인코딩 방식 |
| `navigate` | boolean | `true` | `false` 시 fetcher로 제출 |
| `fetcherKey` | string | - | 외부에서 fetcher 상태 접근용 키 |
| `replace` | boolean | `false` | history.replace 동작 |
| `preventScrollReset` | boolean | `false` | 스크롤 초기화 방지 |
| `state` | object | - | History 상태 |
| `relative` | string | `"route"` | 상대 경로 기준 |
| `reloadDocument` | boolean | `false` | 전체 문서 리로드 |
| `viewTransition` | boolean | `false` | View Transition 활성화 |
| `discover` | string | `"render"` | Lazy Route Discovery 시점 |
| `onSubmit` | function | - | 제출 이벤트 핸들러 |

---

# `navigate={false}` 패턴 상세

`<Form navigate={false}>`는 내부적으로 fetcher를 사용하지만, fetcher 상태를 **같은 컴포넌트에서 읽을 필요가 없을 때** 쓰는 축약 패턴이다.

```typescript
// 아래 두 가지는 동일하게 동작

// 방법 1: navigate={false}
<Form method="post" action="/like" navigate={false} />

// 방법 2: useFetcher
const fetcher = useFetcher();
<fetcher.Form method="post" action="/like" />

// fetcher 상태가 필요하다면 fetcherKey 활용
<Form method="post" action="/like" navigate={false} fetcherKey="like-form" />
const fetcher = useFetcher({ key: "like-form" }); // 다른 컴포넌트에서 상태 접근
```

---

# Progressive Enhancement 동작 흐름

```javascript
[JS 로드 전]
  유저 제출 → 브라우저가 직접 form submit → 전체 페이지 리로드
  (기본 HTML form 동작, 스피닝 파비콘)

[JS 로드 후]
  유저 제출 → React Router가 가로챔 → fetch()로 action 호출
  → useNavigation 상태 업데이트 → 완료 시 loader 자동 재검증
```

> **핵심**: JS 없이도 동작하고, JS 로드 후엔 SPA 경험을 제공한다.

---

# RHF + RR v7 Form + TanStack Query 비교

## 핵심: action은 BFF 레이어다

> **백엔드 API 서버가 따로 있다면 `action`은 대부분 불필요하다.**

`action`이 진짜 필요한 경우는 세 가지뿐이다.

- **DB/시크릿 키 보호**: action은 클라이언트 번들에서 자동 제거 → 서버에서만 실행
- **세션/쿠키 직접 세팅**: 로그인, 인증 토큰 처리
- **Progressive Enhancement**: JS 없이도 폼이 동작해야 하는 환경

```javascript
[BFF 구조 — action이 가치 있음]
브라우저 → RR v7 action → DB 직접 접근

[백엔드 분리 구조 — action이 무의미한 프록시]
브라우저 → RR v7 action → 백엔드 API → DB
           (이 중간 레이어가 왜 있지?)
```

백엔드 분리 구조에서 action을 억지로 쓰면 이렇게 된다.

```typescript
// ❌ action이 그냥 API 프록시 — 의미 없음
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  await fetch("https://api.myserver.com/products", {
    method: "POST",
    body: JSON.stringify(Object.fromEntries(formData)),
  });
  return redirect("/products");
}

// ✅ useMutation으로 직접 호출하는 게 맞음
const mutation = useMutation({
  mutationFn: (data) => api.createProduct(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
});
```

---

## 세 가지 레이어

세 도구는 경쟁 관계가 아니라 각자 담당하는 레이어가 다르다.

```javascript
[입력 상태 / 유효성]     [제출 / 라우팅]         [서버 뮤테이션 / 캐시]
  React Hook Form    +   RR v7 <Form>      +    TanStack Query useMutation
```

| | RHF | RR v7 `<Form>` | TQ `useMutation` |
|---|---|---|---|
| 관심사 | 입력 상태, 유효성 | 네트워크 제출, 라우팅 | 서버 뮤테이션, 캐시 무효화 |
| 재검증 방식 | - | loader 자동 재검증 | `invalidateQueries` 수동 |
| Pending 상태 | `formState.isSubmitting` | `useNavigation.state` | `mutation.isPending` |
| 에러 상태 | `formState.errors` | `actionData.errors` | `mutation.error` |
| 낙관적 UI | - | `fetcher.formData` | `onMutate` • rollback |
| Progressive Enhancement | ❌ | ✅ | ❌ |

---

## 백엔드 분리 구조에서의 실전 패턴

백엔드 API가 따로 있다면 **TQ 중심**으로 가는 게 자연스럽다. RR v7은 라우팅만 담당.

### 패턴 1: RHF + useMutation (기본)

```typescript
export default function NewProductPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: ProductInput) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/products");
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <input {...register("title")} />
      {errors.title && <p>{errors.title.message}</p>}
      {mutation.error && <p>저장 실패</p>}
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
// RR v7 <Form> 아님. 일반 <form> + useNavigate로 직접 이동.
```

### 패턴 2: RHF + useMutation (낙관적 UI + 롤백)

빠른 인터랙션이 필요할 때. 서버 응답 전에 UI를 먼저 업데이트하고, 실패 시 롤백.

```typescript
const mutation = useMutation({
  mutationFn: (data: ProductInput) => api.createProduct(data),
  onMutate: async (newProduct) => {
    await queryClient.cancelQueries({ queryKey: ["products"] });
    const previous = queryClient.getQueryData(["products"]);
    queryClient.setQueryData(["products"], (old: Product[]) => [...old, newProduct]);
    return { previous };
  },
  onError: (_, __, context) => {
    queryClient.setQueryData(["products"], context?.previous); // 롤백
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["products"] }); // 서버와 동기화
  },
});
```

---

## BFF 구조에서의 실전 패턴 (action 사용)

### 패턴 3: RR v7 Form + RHF (BFF or SSR 환경)

DB 직접 접근, 서버 시크릿 필요, Progressive Enhancement가 필요할 때.

```typescript
export default function NewProductPage({ actionData }: Route.ComponentProps) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <Form method="post" onSubmit={handleSubmit(() => {})}>
      <input {...register("title")} />
      {errors.title && <p>{errors.title.message}</p>}            {/* 클라이언트 에러 */}
      {actionData?.errors?.title && <p>{actionData.errors.title}</p>} {/* 서버 에러 */}
      <button type="submit">등록</button>
    </Form>
  );
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { errors: result.error.flatten().fieldErrors };
  await db.create(result.data); // DB 직접 접근 (클라이언트에 노출 안 됨)
  return redirect("/products");
}
```

### 패턴 4: RR v7 action + TQ 캐시 동기화

action은 쓰면서 TQ 캐시도 함께 운용할 때. clientAction으로 연결.

```typescript
export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  const result = await serverAction(); // 서버 action 실행
  queryClient.invalidateQueries({ queryKey: ["products"] }); // TQ 캐시 무효화
  return result;
}
// action의 자동 재검증(loader)과 TQ invalidate를 둘 다 실행
```

---

## 선택 기준

```javascript
백엔드 API 분리 + 단순 뮤테이션    → RHF + useMutation
백엔드 API 분리 + 낙관적 UI 필요   → RHF + useMutation (onMutate 롤백)
페이지 이동 없는 인라인 뮤테이션   → fetcher 또는 useMutation
BFF 구조 / 서버 시크릿 / SSR 필요  → RR v7 action + RHF + (clientAction + invalidateQueries)
```

> **Olive Young 글로벌팀처럼 백엔드 분리 구조라면** → TQ 중심, RR v7은 라우팅만 담당하는 구조가 자연스럽다.
