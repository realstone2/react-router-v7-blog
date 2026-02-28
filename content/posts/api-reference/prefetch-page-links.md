---
title: "<PrefetchPageLinks>"
date: "2026-02-22"
description: "페이지 리소스 사전 로딩과 prerender 설정 비교"
tags: ["react-router", "prefetch", "api"]
category: "api-reference"
order: 17
---

> 공식 문서
> - [https://reactrouter.com/api/components/PrefetchPageLinks](https://reactrouter.com/api/components/PrefetchPageLinks)
> - [https://reactrouter.com/how-to/pre-rendering](https://reactrouter.com/how-to/pre-rendering)

---

# `<PrefetchPageLinks>`

**Framework Mode 전용**. `<Link prefetch>`가 내부적으로 사용하는 컴포넌트.
다른 페이지의 **리소스(JS 모듈, CSS, 데이터)를 미리 `<link>` 태그로 등록**해 이동 시 즉시 로드되도록 한다.

```typescript
import { PrefetchPageLinks } from "react-router";

<PrefetchPageLinks page="/absolute/path" />
```

렌더링 시 실제로 삽입되는 HTML:

```html
<link rel="prefetch" href="/assets/routes/product.js" />
<link rel="modulepreload" href="/assets/routes/product-abc123.js" />
<link rel="prefetch" as="fetch" href="/products/123.data" />
```

## Signature

```typescript
function PrefetchPageLinks({
  page,       // string — 프리페치할 절대 경로
  ...linkProps // <link> 태그에 펼칠 추가 props (crossOrigin, integrity 등)
}: PageLinkDescriptor)
```

## `<Link prefetch>`와의 관계

`<Link prefetch>`는 `<PrefetchPageLinks>`를 **내부적으로 호출**한다.

```typescript
// 이 둘은 동등한 효과
const [isHovering, setIsHovering] = useState(false);

<Link to="/products" prefetch="intent">...</Link>
// == 아래와 같음
<a href="/products" onMouseEnter={() => setIsHovering(true)}>
  {isHovering && <PrefetchPageLinks page="/products" />}
  ...
</a>
```

`<PrefetchPageLinks>`는 `<Link>` 없이 **직접 프리페치 타이밍을 컨트롤하고 싶을 때** 쓴다.

---

# 사용 패턴

## 패턴 1: 검색 입력 시 미리 프리페치

공식 문서가 권장하는 대표 예시. 유저가 검색 입력이 멈춰진 시점에 결과 페이지를 미리 로드.

```typescript
function SearchBar() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="상품 검색..."
      />
      {/* 타이핑 멈춰진 시점에 결과 페이지 프리페치 */}
      {debouncedQuery && (
        <PrefetchPageLinks page={`/search?q=${debouncedQuery}`} />
      )}
    </>
  );
}
```

## 패턴 2: 커스텀 호버 로직

```typescript
function ProductCard({ product }) {
  const [isPrefetching, setIsPrefetching] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsPrefetching(true)}
      onMouseLeave={() => setIsPrefetching(false)}
    >
      {isPrefetching && (
        <PrefetchPageLinks page={`/products/${product.id}`} />
      )}
      <Link to={`/products/${product.id}`}>
        {product.name}
      </Link>
    </div>
  );
}
```

## 패턴 3: 다음 스텝이 명확할 때

유저 행동을 파악하는 상황. 예시) 단계별 폼.

```typescript
function CheckoutStep1() {
  return (
    <>
      {/* step2는 거의 넘어가니까 즉시 프리페치 */}
      <PrefetchPageLinks page="/checkout/step2" />
      <form>...</form>
    </>
  );
}
```

---

# `prerender` config

**빌드 타임**에 지정한 URL 목록을 실제 HTML + `.data` 파일로 생성한다.

```typescript
// react-router.config.ts
import type { Config } from "@react-router/dev/config";

export default {
  // boolean: 모든 정적 경로 프리렌더
  prerender: true,

  // 또는 특정 경로만
  prerender: ["/", "/about", "/contact"],

  // 또는 비동기 함수로
  async prerender() {
    const posts = await fetchPostSlugs();
    return ["/", "/blog", ...posts.map(slug => `/blog/${slug}`)];
  },
} satisfies Config;
```

빌드 결과:

```javascript
build/client/
  index.html          ← / 프리렌더 결과 (HTML)
  about.html
  contact.html
  _root.data          ← loader 데이터 (클라이언트 네비게이션용)
  about.data
  contact.data
```

---

# 핵심 차이: `<PrefetchPageLinks>` vs `prerender` config

| 구분 | `<PrefetchPageLinks>` | `prerender` config |
|---|---|---|
| **실행 시점** | 런타임 (브라우저) | 빌드 타임 (CI/CD) |
| **하는 일** | JS/CSS/데이터를 미리 다운로드 | HTML + .data 파일 생성 |
| **데이터** | 네트워크로 미리 가져와서 캐시 관리 | 데이터를 파일로 구워냄 |
| **무엇을 해결** | 네비게이션 지연시간(waterfall) | 초기 로드 시간, 서버 부하 |
| **서버 필요여부** | 서버 있어도 동작 | 서버 없어도 서빙 가능 |
| **동적 데이터** | 프리페치 시점의 실시간 데이터 | 빌드 시점 데이터 (콘텐츠 변경 시 재빌드 필요) |
| **URL 범위** | 특정 경로 1개씩 | 배열로 배치 지정 |

---

# 개념 정리: 시점이 다르다

```javascript
[prerender config]
빌드 타임에 페이지를 "실제로 만들어두기"
  → 마치 페이지가 처음부터 존재하는 것처럼
  → 별도 요청 없이 바로 HTML 제공
  → SEO, CDN 캐싱, 서버리스 배포에 유리

[PrefetchPageLinks]
런타임에 "실제 요청은 나중에 하지만 JS/CSS/data는 미리 가져오기"
  → 유저의 행동으로 언제 프리페치할지 컨트롤
  → 렌더링 안된 데이터는 프리페치 안 됨 (URL 쿼리파라미터, user-specific 등)
  → SPA 네비게이션 UX 개선에 특화
```

## 둘을 함께 쓰는 경우

```typescript
// react-router.config.ts
// 정적 지식 페이지는 빌드 타임에 프리렌더
export default {
  prerender: ["/", "/about", "/blog"],
} satisfies Config;

// 런타임: 유저가 특정 상품 페이지를 클릭하려할 것 같으면 미리 프리페치
<Link to="/products/123" prefetch="intent">
  {/* 내부적으로 PrefetchPageLinks 사용 */}
</Link>
```

---

# 실무 판단 기준

```javascript
UX 상 특정 페이지를 빠르게 이동시키고 싶다
  ↓
  해당 페이지 URL이 환경마다 동일한가? (/, /about 등 정적)
    YES → prerender config (SEO도 잘 되고 빠름)
    NO  ↓
  URL에 동적 파라미터가 있는가? (/products/:id 등)
    슬러그 목록을 빌드 타임에 알 수 있는가?
      YES → prerender config (async 함수로 슬러그 목록 주입)
      NO  → <Link prefetch> 또는 <PrefetchPageLinks> (런타임 프리페치)
  유저 행동(타이핑, 검색 입력)에 반응해서 프리페치하고 싶다
    YES → <PrefetchPageLinks> 직접 제어 (Link prefetch prop 없이)
```

> **핵심 한줄 요약**:
> - `prerender` → 빌드 타임, HTML 파일 생성, SEO 대응
> - `<PrefetchPageLinks>` → 런타임, 네트워크 선행 동작, UX 개선
