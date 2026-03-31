---
title: 'View Transitions'
date: '2026-03-31'
category: 'how-to'
order: 19
tags: ['react-router', 'view-transitions', 'animation', 'navigation', 'css']
description: 'React Router에서 View Transitions API를 활용한 페이지 전환 애니메이션 — viewTransition prop, CSS 설정, useViewTransitionState'
---

> 공식 문서: [https://reactrouter.com/how-to/view-transitions](https://reactrouter.com/how-to/view-transitions)
> React Router v7 기준

---

# 들어가며

View Transitions API는 페이지 전환 시 **부드러운 애니메이션**을 제공하는 브라우저 API다. React Router는 `Link`, `NavLink`, `Form`, `useNavigate`에서 이를 지원한다. 별도 CSS 없이도 기본 크로스페이드 애니메이션이 적용된다.

**지원 모드:**

| 모드 | 지원 여부 |
|---|---|
| Framework Mode | ✅ |
| Data Mode | ✅ |
| Declarative Mode | ❌ |

---

# 기본 사용법

## Link/NavLink에 viewTransition 추가

```tsx
<Link to="/about" viewTransition>
  About
</Link>
```

이것만으로 페이지 전환 시 기본 크로스페이드 애니메이션이 적용된다.

## 프로그래밍 방식 네비게이션

`useNavigate`에서는 옵션 객체로 전달한다:

```tsx
import { useNavigate } from "react-router";

function NavigationButton() {
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate("/about", { viewTransition: true })}>
      About
    </button>
  );
}
```

---

# 이미지 갤러리 예시

View Transitions의 진가를 보여주는 예시 — 목록에서 상세 페이지로 전환할 때 이미지가 부드럽게 확대된다.

## 갤러리 목록 라우트

```tsx
// routes/image-gallery.tsx
import { NavLink } from "react-router";

export const images = [
  "https://example.com/image1.jpg",
  "https://example.com/image2.jpg",
];

export default function ImageGalleryRoute() {
  return (
    <div className="image-list">
      <h1>Image List</h1>
      <div>
        {images.map((src, idx) => (
          <NavLink key={src} to={`/image/${idx}`} viewTransition>
            <p>Image Number {idx}</p>
            <img className="max-w-full contain-layout" src={src} />
          </NavLink>
        ))}
      </div>
    </div>
  );
}
```

## 상세 라우트

```tsx
// routes/image-details.tsx
import { Link } from "react-router";
import { images } from "./image-gallery";
import type { Route } from "./+types/image-details";

export default function ImageDetailsRoute({ params }: Route.ComponentProps) {
  return (
    <div className="image-detail">
      <Link to="/" viewTransition>Back</Link>
      <h1>Image Number {params.id}</h1>
      <img src={images[Number(params.id)]} />
    </div>
  );
}
```

## CSS — view-transition-name 매칭

핵심은 **출발 요소와 도착 요소에 같은 `view-transition-name`을 부여**하는 것이다. 브라우저가 두 요소를 매칭해서 자동으로 전환 애니메이션을 만든다:

```css
/* 목록 페이지 — 전환 중인 링크의 이미지/제목에 이름 부여 */
.image-list a.transitioning img {
  view-transition-name: image-expand;
}
.image-list a.transitioning p {
  view-transition-name: image-title;
}

/* 상세 페이지 — 같은 이름을 부여하면 브라우저가 매칭 */
.image-detail img {
  view-transition-name: image-expand;
}
.image-detail h1 {
  view-transition-name: image-title;
}
```

`.transitioning` 클래스는 React Router가 전환 중인 `NavLink`에 자동으로 부여한다.

---

# 고급 사용법

## Render Props로 전환 상태 감지

`NavLink`의 render props에서 `isTransitioning`을 사용할 수 있다:

```tsx
<NavLink to={`/image/${idx}`} viewTransition>
  {({ isTransitioning }) => (
    <>
      <p style={{
        viewTransitionName: isTransitioning ? "image-title" : "none",
      }}>
        Image Number {idx}
      </p>
      <img
        src={src}
        style={{
          viewTransitionName: isTransitioning ? "image-expand" : "none",
        }}
      />
    </>
  )}
</NavLink>
```

전환 중일 때만 `view-transition-name`을 부여해서, **여러 항목이 동시에 같은 이름을 갖는 충돌**을 방지한다.

## useViewTransitionState Hook

특정 경로로의 전환 상태를 감지하는 hook이다:

```tsx
function NavImage({ src, idx }: { src: string; idx: number }) {
  const href = `/image/${idx}`;
  const isTransitioning = useViewTransitionState(href);

  return (
    <Link to={href} viewTransition>
      <p style={{
        viewTransitionName: isTransitioning ? "image-title" : "none",
      }}>
        Image Number {idx}
      </p>
      <img
        src={src}
        style={{
          viewTransitionName: isTransitioning ? "image-expand" : "none",
        }}
      />
    </Link>
  );
}
```

---

# 정리

| 항목 | 내용 |
|---|---|
| 기본 사용 | `<Link viewTransition>` 또는 `navigate(path, { viewTransition: true })` |
| 기본 효과 | 크로스페이드 (CSS 없이) |
| 커스텀 애니메이션 | `view-transition-name`으로 출발/도착 요소 매칭 |
| `.transitioning` | React Router가 전환 중인 NavLink에 자동 부여하는 클래스 |
| `isTransitioning` | NavLink render props로 전환 상태 감지 |
| `useViewTransitionState` | 특정 경로로의 전환 상태를 hook으로 감지 |
