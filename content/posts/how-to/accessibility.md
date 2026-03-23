---
title: "접근성 (Accessibility)"
date: "2026-03-15"
description: "React Router에서 키보드 사용자와 스크린 리더 사용자를 위한 접근성 구현 방법"
tags: ["react-router", "accessibility", "a11y", "focus-management", "aria"]
category: "how-to"
order: 1
---

> 공식 문서: [https://reactrouter.com/how-to/accessibility](https://reactrouter.com/how-to/accessibility)
> React Router v7 기준

---

# 들어가며

React Router 앱의 접근성은 기본적으로 표준 웹 접근성 지침(WCAG)을 따른다.
그런데 클라이언트 사이드 라우팅(CSR)은 브라우저가 원래 해주던 동작들을 가로채기 때문에, 개발자가 **직접 챙겨야 할 것들**이 생긴다.

React Router는 가능한 부분은 기본값으로 처리하고, 나머지는 API로 지원한다.

---

# 링크

**지원 모드:** Framework / Data / Declarative 모두 사용 가능

## `<Link>`

`<Link>`는 표준 `<a>` 태그를 렌더링한다. 브라우저가 기본 제공하는 접근성 동작을 그대로 얻는다.

- 키보드 포커스 가능
- 스크린 리더가 "링크"로 인식
- `href` 속성이 있어 우클릭 → 새 탭 열기 가능

## `<NavLink>`

`<NavLink>`는 `<Link>`와 동일하게 동작하되, **현재 페이지를 가리키는 링크일 때** 보조 기술에 컨텍스트를 추가로 제공한다.

```tsx
<NavLink to="/about">About</NavLink>
```

현재 라우트와 일치하면 자동으로 `aria-current="page"` 속성이 추가된다.
스크린 리더가 "현재 페이지" 링크임을 사용자에게 알려준다.

내비게이션 메뉴나 브레드크럼처럼 **현재 위치 파악이 중요한 UI**에 적합하다.

---

# 라우팅 접근성

**지원 모드:** Framework Mode 전용

`<Scripts>`를 렌더링하는 앱이라면, 클라이언트 사이드 라우팅을 접근 가능하게 만들기 위해 신경 써야 할 것들이 있다.

## 왜 CSR은 기본적으로 접근성에 불리한가

전통적인 멀티페이지 웹사이트에서는 브라우저가 라우팅을 직접 처리한다.
페이지 이동 시 브라우저가 자동으로:

- 포커스를 페이지 상단으로 초기화
- 스크린 리더에게 새 페이지 진입을 알림
- 새 페이지 제목(`<title>`)을 읽어줌

클라이언트 사이드 라우팅은 React Router가 브라우저 기본 동작을 가로막기 때문에 위 동작들이 **자동으로 일어나지 않는다.**

JavaScript를 비활성화하면 앱이 기본 브라우저 동작으로 되돌아가야 한다(점진적 개선).
하지만 JavaScript가 활성화된 상태에서는 개발자가 직접 챙겨야 한다.

## 챙겨야 할 두 가지

### 1. 포커스 관리 (Focus Management)

라우트가 변경될 때 어떤 엘리먼트가 포커스를 받을지 결정해야 한다.

- 키보드 사용자에게 필수적
- 스크린 리더 사용자에게도 중요한 단서

포커스를 관리하지 않으면 사용자는 이전 페이지의 어딘가에 포커스가 남아 있는 채로 새 페이지를 탐색해야 한다.

### 2. 라이브 리전 공지 (Live-Region Announcements)

스크린 리더 사용자는 라우트 변경 사실을 시각적으로 인지할 수 없다.
`aria-live` 리전을 사용해 라우트 변경 시 스크린 리더에게 변경을 알려야 한다.

전환 중(loading 상태)에도 공지를 고려하고, 변경의 성격과 예상 로딩 시간에 따라 공지 방식을 조정한다.

---

# 배경: Marcy Sutton의 사용자 리서치

React Router 공식 문서가 위 두 가지를 권장하는 데는 근거가 있다.
2019년, Marcy Sutton이 [Fable Tech Labs](https://makeitfable.com/)와 함께 장애를 가진 사용자 5명을 대상으로 클라이언트 사이드 라우팅 기법들을 직접 테스트했다.

> 참고: [What we learned from user testing of accessible client-side routing techniques with Fable Tech Labs](https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/)

당시 테스트한 주요 기법들:

| 기법 | 설명 |
|------|------|
| wrapper 요소에 포커스 이동 | 새 콘텐츠를 감싼 div에 포커스 |
| `<h1>` 헤딩에 포커스 이동 | 새 페이지의 첫 번째 헤딩에 포커스 |
| ARIA Live Region 공지 | `aria-live`로 라우트 변경을 스크린 리더에 알림 |

**주요 발견:**

- **h1 헤딩에 포커스를 보내는 것이 스크린 리더 사용자에게 가장 좋은 경험**이었다 — 짧고 명확하게 새 컨텍스트를 전달함
- wrapper 요소에 포커스를 보내는 것도 작동은 했지만, 뷰포트 밖으로 포커스 아웃라인이 보이지 않는 문제가 있었다
- **포커스 이동 시 눈에 보이는 포커스 아웃라인**은 음성 내비게이션(Voice Control) 사용자에게도 도움이 됐다
- 화면 확대 소프트웨어 사용자도 포커스 아웃라인이 어디로 이동했는지를 보고 컨텍스트를 파악했다
- **초기 페이지 로드 시 포커스를 이동하는 것은 금지** — 내비게이션 등 앞 콘텐츠를 놓치게 됨
- `aria-current`를 링크에 추가해 현재 활성 링크를 표시하는 것이 도움이 됐다 (`<NavLink>`가 자동으로 처리)
- 많은 스크린 리더 사용자가 landmark보다 **헤딩으로 페이지를 탐색**하므로, 내비게이션 같은 주요 섹션에도 헤딩을 추가하는 게 좋다(시각적으로 숨기더라도)

이 리서치 결과가 React Router(그리고 Gatsby, Reach Router)의 접근성 권장사항에 직접 반영됐다.

---

# 정리

| | 내용 |
|---|---|
| `<Link>` | `<a>` 태그 렌더링 — 브라우저 기본 접근성 자동 획득 |
| `<NavLink>` | 현재 라우트 일치 시 `aria-current="page"` 자동 추가 |
| 포커스 관리 | 라우트 변경 시 `<h1>`에 포커스 이동이 가장 좋은 경험 |
| Live Region | `aria-live`로 라우트 변경을 스크린 리더에 공지 |
| 초기 로드 | 포커스 이동 금지 — 앞 콘텐츠를 놓치게 됨 |
