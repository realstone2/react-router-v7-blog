---
title: "<Outlet>"
date: "2026-02-22"
description: "자식 라우트 렌더링과 useOutletContext 패턴"
tags: ["react-router", "outlet", "api"]
category: "api-reference"
order: 16
---

> 공식 문서
> - [https://reactrouter.com/api/components/Outlet](https://reactrouter.com/api/components/Outlet)
> - [https://reactrouter.com/api/hooks/useOutletContext](https://reactrouter.com/api/hooks/useOutletContext)

# `<Outlet>`

부모 라우트에서 **매칭된 자식 라우트를 렌더링하는 자리표시자**다.
자식 라우트가 없으면 `null`을 반환한다.

```typescript
import { Outlet } from "react-router";

export default function DashboardLayout() {
  return (
    <div>
      <Sidebar />
      <main>
        <Outlet /> {/* 여기에 /dashboard/*, /dashboard/orders 등이 렌더링됨 */}
      </main>
    </div>
  );
}
```

## Signature

```typescript
function Outlet(props: OutletProps): React.ReactElement | null

type OutletProps = {
  context?: unknown; // 자식 라우트에 전달할 컨텍스트 값
};
```

## Props

### `context`

`<Outlet>` 아래 자식 라우트에게 값을 내려줄 때 사용한다.
자식이 `useOutletContext()`로 접근한다.

```typescript
<Outlet context={myContextValue} />
```

---

# `useOutletContext`

가장 가까운 부모 `<Outlet context={...} />`의 컨텍스트 값을 반환하는 훅이다.

```typescript
function useOutletContext<Context = unknown>(): Context
```

## 기본 사용법

```typescript
// 부모 라우트
import { Outlet } from "react-router";

function Parent() {
  const [count, setCount] = React.useState(0);
  return <Outlet context={[count, setCount]} />;
}

// 자식 라우트
import { useOutletContext } from "react-router";

function Child() {
  const [count, setCount] = useOutletContext();
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

---

# TypeScript 타입 안전하게 쓰기 — 공식 권장 패턴

공식 문서는 **부모가 컨텍스트용 custom hook을 노출하는 방식**을 권장한다.
타입이 명확해지고, 누가 소비하는지 파악이 쉽다.

```typescript
// dashboard.tsx — 부모 라우트
import { useState } from "react";
import { Outlet, useOutletContext } from "react-router";
import type { User } from "./types";

type ContextType = { user: User | null };

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);

  return (
    <div>
      <h1>Dashboard</h1>
      <Outlet context={{ user } satisfies ContextType} />
    </div>
  );
}

// 컨텍스트 custom hook 노출 — 자식이 이걸 가져다 씀
export function useUser() {
  return useOutletContext<ContextType>();
}
```

```typescript
// dashboard/messages.tsx — 자식 라우트
import { useUser } from "../dashboard"; // 컨텍스트 직접 가져다 쓰지 않고 hook 사용

export default function DashboardMessages() {
  const { user } = useUser(); // 타입 자동 추론
  return <p>Hello, {user?.name}</p>;
}
```

---

# `<Outlet context>` vs React `createContext` — 비교

| | `<Outlet context>` • `useOutletContext` | React `createContext` • `useContext` |
|---|---|---|
| 설정 복잡도 | 낮음 (별도 Provider 불필요) | 상대적 복잡 (Context, Provider 생성 필요) |
| 범위 | 부모 → 직접 자식까지만 | 어떤 컴포넌트든 접근 가능 |
| 깊은 중첩 | 각 층에서 따로 주지 않으면 불가 | 상위 Provider로 한 번 세팅으로 고정 가능 |
| 라우트 연계성 | 자연스럽게 라우트와 결합 | 라우트와 독립적 |
| 사용 상황 | 레이아웃 → 자식 라우트 데이터 전달 | 앱 전역 상태 (auth, theme 등) |

> **가이드라인**:
> - 레이아웃 라우트가 자식에게 **라우트 특화된 데이터**를 내려줄 때 → `Outlet context`
> - **앱 전역 공유 상태** (user, theme, language) → `createContext`

---

# 실전 패턴

## 패턴 1: 레이아웃에서 loader 데이터 내려주기

부모가 loader로 가져온 데이터를 자식에게 주는 시나리오.

```typescript
// routes/product-layout.tsx
import { useLoaderData, Outlet } from "react-router";
import type { Product } from "./types";

export async function loader({ params }) {
  return await getProduct(params.productId);
}

type ContextType = { product: Product };

export default function ProductLayout() {
  const product = useLoaderData<typeof loader>();

  return (
    <div>
      <ProductHeader product={product} />
      <Outlet context={{ product } satisfies ContextType} />
    </div>
  );
}

export function useProduct() {
  return useOutletContext<ContextType>();
}
```

```typescript
// routes/product-reviews.tsx
import { useProduct } from "./product-layout";

export default function ProductReviews() {
  const { product } = useProduct(); // 로더 다시 안 해도 됨
  return <ReviewList productId={product.id} />;
}
```

## 패턴 2: 레이아웃에서 인증 상태 + 콜백 내리기

```typescript
// routes/dashboard-layout.tsx
type ContextType = {
  user: User;
  onLogout: () => void;
};

export default function DashboardLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div>
      <Header user={user} onLogout={handleLogout} />
      <Outlet context={{ user, onLogout: handleLogout } satisfies ContextType} />
    </div>
  );
}

export function useDashboard() {
  return useOutletContext<ContextType>();
}
```

## 패턴 3: 중첩 Outlet

컨텍스트는 **가장 가까운 부모**만 접근할 수 있다.
여러 레벨이 중첩된 라우트에서는 각 층에서 따로 내리지 않으면 접근 불가.

```typescript
// 라우트 구조
// /app → AppLayout (context: { theme })
//   /app/dashboard → DashboardLayout (context: { user })
//     /app/dashboard/orders → OrdersPage

// OrdersPage에서는 useOutletContext가 DashboardLayout의 { user }를 반환
// AppLayout의 { theme }에 접근하려면 DashboardLayout이 다시 내려줘야 함
// 또는 createContext 사용
```

---

# 주의사항: `useOutletContext`를 쓰면 안 되는 경우

`<Outlet>` 없는 컴포넌트에서 `useOutletContext`를 호출하면 오류가 발생한다.

```typescript
// ❌ Outlet이 없는 컴포넌트에서 호출 — 런타임 오류
function StandaloneComponent() {
  const context = useOutletContext(); // ❌ 부모 Outlet이 없으면 null
}

// ✅ 항상 자식 라우트 컴포넌트에서만 호출
function ChildRoute() {
  const context = useOutletContext<ContextType>(); // ✅
}
```

---

# 이 컨텍스트를 쓸지 vs `useLoaderData`를 다시 쓸지

자식 라우트가 부모의 loader 데이터를 필요로 할 때 두 가지 방법이 있다.

```typescript
// 방법 1: 자식이 useRouteLoaderData로 직접 접근
function ChildRoute() {
  // 라우트 ID를 알아야 함
  const data = useRouteLoaderData("product-layout");
}

// 방법 2: Outlet context로 내려주기 (권장)
function ProductLayout() {
  const product = useLoaderData();
  return <Outlet context={{ product }} />;
  // 자식은 useProduct() 훅 하나로 가져다 쓸 수 있음
  // 라우트 ID를 몰라도 됨, 타입 안전
}
```

`Outlet context` 방식이 **라우트 ID 의존성을 없애고 타입을 직접 제어**할 수 있어 더 낫다.
