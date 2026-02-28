---
title: "<Navigate>"
date: "2026-02-22"
description: "useNavigate의 컴포넌트 버전 — Navigate API"
tags: ["react-router", "navigate", "api"]
category: "api-reference"
order: 14
---

> 공식 문서: [https://reactrouter.com/api/components/Navigate](https://reactrouter.com/api/components/Navigate)

# 개요

`useNavigate`의 **컴포넌트 버전**이다. 훅을 사용할 수 없는 Class 컴포넌트를 위해 존재한다.

> **공식 문서 권장사항**: `<Navigate>` 대신 `useNavigate`를 사용할 것.

```typescript
function Navigate({
  to,
  replace,
  state,
  relative
}: NavigateProps): null
// 렌더링 시 즉시 네비게이션 발생, 반환값 null
```

---

# Props

| Prop | 타입 | 기본값 | 설명 | |
|---|---|---|---|---|
| `to` | string \| Path | (required) | 이동할 경로 | |
| `replace` | boolean | false | history.replace 동작 | |
| `state` | object | - | History 상태 | |
| `relative` | string | `"route"` | 상대 경로 기준 | |

```typescript
<Navigate to="/tasks" />
<Navigate to="/tasks" replace />
<Navigate to="/tasks" state={{ from: "home" }} />
<Navigate to=".." relative="path" />
```

---

# 언제 써야 하나 — 고민 정리

## 결론부터: 거의 쓸 일 없다

`<Navigate>`가 존재하는 이유는 **Class 컴포넌트에서 훅을 못 쓰기 때문**이다.
Function 컴포넌트 기반의 현대 React에서는 `useNavigate`로 대체하는 게 맞다.

```javascript
현대 React (Function Component)
  → useNavigate 사용

레거시 React (Class Component)
  → <Navigate> 사용 (유일한 선택지)
```

## 그럼 `useNavigate`를 쓸 수 없는 상황은?

`useNavigate`도 **이벤트 핸들러 안에서만** 쓰는 게 올바르다.
렌더 중에 `useNavigate`를 직접 호출하면 안 된다.

```typescript
// ❌ 렌더 중 직접 호출 — useNavigate로도 이렇게 쓰면 안 됨
function BadComponent() {
  const navigate = useNavigate();
  navigate("/somewhere"); // 렌더 사이클 중 side effect
  return null;
}

// ✅ 이벤트 핸들러에서 호출
function GoodComponent() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/somewhere")}>이동</button>;
}
```

## `<Navigate>`가 실제로 쓰이는 패턴

### 패턴 1: 조건부 리다이렉트 (가장 흔한 사용처)

렌더 결과로 리다이렉트를 표현할 때. JSX 조건 분기 안에서 자연스럽게 쓸 수 있다.

```typescript
// 인증 가드
function ProtectedPage() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Dashboard />;
}
```

```typescript
// 로드 완료 후 조건 분기
function OrderConfirmPage() {
  const { order } = useLoaderData();

  if (order.status === "cancelled") {
    return <Navigate to="/orders" replace />;
  }

  return <OrderDetail order={order} />;
}
```

### 패턴 2: 인덱스 라우트 리다이렉트

`/settings`에 접근하면 자동으로 `/settings/profile`로 보낼 때.

```typescript
// app/routes.ts
route("settings", "settings/layout.tsx", [
  index("settings/index.tsx"),  // /settings → /settings/profile
  route("profile", "settings/profile.tsx"),
  route("security", "settings/security.tsx"),
]);

// settings/index.tsx
export default function SettingsIndex() {
  return <Navigate to="profile" replace />;
}
```

> **단, Framework Mode에서는 loader의 redirect()가 더 낫다.**
> 렌더 전에 서버에서 처리되므로 불필요한 렌더링이 없다.

```typescript
// 더 나은 방법: loader에서 redirect
export async function loader() {
  return redirect("/settings/profile");
}
```

### 패턴 3: Class 컴포넌트 (레거시)

```typescript
class OldComponent extends React.Component {
  render() {
    if (!this.props.isLoggedIn) {
      return <Navigate to="/login" replace />;
    }
    return <div>...</div>;
  }
}
```

---

# Navigate vs useNavigate vs redirect — 비교

| | `<Navigate>` | `useNavigate` | `redirect()` |
|---|---|---|---|
| 실행 시점 | 렌더 중 | 이벤트/effect | loader/action 실행 중 |
| 사용 위치 | JSX | 이벤트 핸들러 | loader, action |
| Class 컴포넌트 | ✅ | ❌ | ❌ |
| 서버사이드 | ❌ | ❌ | ✅ |
| 권장 여부 | 최소화 | 이벤트 시 권장 | loader/action 시 권장 |

---

# 실무 판단 기준

```javascript
리다이렉트가 필요한 상황
  ↓
  loader/action 안인가?
    YES → redirect() 사용 (Framework Mode 권장)
    NO  ↓
  이벤트 핸들러(클릭, 제출 등) 안인가?
    YES → useNavigate() 사용
    NO  ↓
  JSX 조건 분기로 표현해야 하는가?
    YES → <Navigate> 사용 (인증 가드, 조건부 리다이렉트)
    Class 컴포넌트인가?
      YES → <Navigate> 유일한 선택지
```

> **핵심**: `<Navigate>`는 "렌더 결과로 리다이렉트를 선언적으로 표현"할 때만 쓴다.
> 이벤트 기반이면 `useNavigate`, 서버사이드면 `redirect()`.

---

# 주의사항

## replace를 거의 항상 써야 하는 이유

`<Navigate>`를 쓰는 경우는 대부분 유저가 의도하지 않은 리다이렉트다.
`replace` 없이 push하면 뒤로가기로 다시 리다이렉트 페이지로 돌아오는 무한 루프가 생길 수 있다.

```typescript
// ❌ replace 없으면 뒤로가기 시 다시 /login으로 리다이렉트됨
<Navigate to="/login" />

// ✅ replace로 현재 히스토리 항목을 교체
<Navigate to="/login" replace />
```

## 렌더링 중 side effect 주의

`<Navigate>`는 렌더 중에 네비게이션을 발생시킨다.
비동기 조건이나 상태가 확정되지 않은 시점에 쓰면 예상치 못한 동작을 유발할 수 있다.

```typescript
// ❌ 로딩 중에도 리다이렉트 발생
function Page() {
  const { data, isLoading } = useQuery(...);
  if (!data) return <Navigate to="/empty" />; // isLoading 중에도 실행됨
  return <Content data={data} />;
}

// ✅ 로딩 상태 분리
function Page() {
  const { data, isLoading } = useQuery(...);
  if (isLoading) return <Spinner />;
  if (!data) return <Navigate to="/empty" replace />;
  return <Content data={data} />;
}
```
