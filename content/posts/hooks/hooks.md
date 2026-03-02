---
title: "React Router v7 Hooks 전체 정리"
date: "2026-03-03"
description: "React Router v7의 모든 Hook을 카테고리별로 정리한 레퍼런스"
tags: ["react-router", "hooks", "api"]
category: "hooks"
order: 1
---

> 공식 문서: [https://reactrouter.com/api/hooks](https://reactrouter.com/api/hooks)
> React Router v7 기준 (v7.13.1)

---

## 1. 데이터 패칭 & 폼 제출 (Data Fetching & Submission)

| Hook | 설명 |
|------|------|
| `useLoaderData` | 현재 매칭된 route의 `loader` / `clientLoader` 반환값에 접근 |
| `useActionData` | 가장 최근 POST 탐색 `action`의 반환값에 접근 |
| `useRouteLoaderData` | 특정 route ID의 loader 데이터에 접근 |
| `useFetcher` | 탐색 없이 독립적으로 loader/action 호출 (비동기 UI, 낙관적 업데이트에 활용) |
| `useFetchers` | 현재 진행 중인 모든 fetcher 목록 반환 (전역 로딩 인디케이터에 활용) |
| `useSubmit` | 코드에서 명령형으로 폼 데이터를 제출 (`<Form>`의 훅 버전) |
| `useRevalidator` | 현재 페이지의 route 데이터를 수동으로 재검증 (포커스 복귀, 폴링 등) |

---

## 2. 탐색 & URL 제어 (Navigation & URL Control)

| Hook | 설명 |
|------|------|
| `useNavigate` | 프로그래밍 방식의 경로 이동 함수 반환 |
| `useNavigation` | 현재 탐색 상태 반환 (`idle` / `submitting` / `loading` 및 제출 데이터 포함) |
| `useNavigationType` | 현재 location이 어떻게 도달했는지 반환 (`POP` / `PUSH` / `REPLACE`) |
| `useLocation` | 현재 location 객체 반환 (pathname, search, hash, state) |
| `useSearchParams` | URL 쿼리스트링을 `URLSearchParams`로 읽고 업데이트하는 setter 반환 |
| `useHref` | 목적지를 href 문자열로 해석 |
| `useResolvedPath` | 목적지를 Path 객체(pathname/search/hash)로 해석 |
| `useFormAction` | 가장 가까운 route를 기준으로 폼 action URL을 해석 |
| `useLinkClickHandler` | 커스텀 Link 컴포넌트 제작을 위한 Link 클릭 동작 반환 |

---

## 3. 라우트 매칭 & 렌더링 컨텍스트 (Route Matching & Context)

| Hook | 설명 |
|------|------|
| `useParams` | 현재 매칭된 route의 동적 파라미터 객체 반환 |
| `useMatch` | 특정 패턴이 현재 URL과 매칭되면 매칭 정보 반환 |
| `useMatches` | 현재 route 계층의 모든 활성 매칭 배열 반환 |
| `useRoutes` | `<Routes>`의 훅 버전 — JS 객체로 라우트 정의 |
| `useOutlet` | 현재 중첩 레벨의 자식 route 엘리먼트 반환 |
| `useOutletContext` | 부모 `<Outlet>`이 제공한 context 읽기 |
| `useInRouterContext` | 컴포넌트가 Router 컨텍스트 내부에 있는지 여부 반환 |

---

## 4. 에러 처리 & 비동기 경계 (Errors & Async Boundaries)

| Hook | 설명 |
|------|------|
| `useRouteError` | loader / action / 렌더링에서 throw된 route 레벨 에러에 접근 |
| `useAsyncError` | 가장 가까운 `<Await>` 내부에서 프로미스 reject 값 반환 |
| `useAsyncValue` | 가장 가까운 `<Await>` 내부에서 프로미스 resolve 값 반환 |
| `useViewTransitionState` | 특정 location으로의 View Transition 활성 여부 반환 |

---

## 5. 탐색 차단 & 생명주기 (Navigation Blocking & Lifecycle)

| Hook | 설명 |
|------|------|
| `useBlocker` | 인앱 탐색을 차단하고 `proceed` / `reset` 제어권 제공 (미저장 변경사항 경고 등) — [실험 데모](/experiment/blocker) |
| `useBeforeUnload` | 브라우저 `beforeunload` 이벤트 콜백 등록 |
| `usePrompt` | `useBlocker` 기반 실험적 훅 — `window.confirm` 프롬프트 사용 |
