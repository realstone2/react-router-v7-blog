export interface NavItem {
  title: string;
  slug: string;
}

export interface NavCategory {
  label: string;
  items: NavItem[];
}

export const navigation: NavCategory[] = [
  {
    label: "Core Concepts",
    items: [
      { title: "Configuring Routes", slug: "configuring-routes" },
      { title: "Route Module", slug: "route-module" },
      { title: "Rendering Strategies", slug: "rendering-strategies" },
      { title: "Data Loading", slug: "data-loading" },
      { title: "Actions", slug: "actions" },
      { title: "Client Data", slug: "client-data" },
      { title: "Using Fetchers", slug: "using-fetchers" },
      { title: "Navigating", slug: "navigating" },
      { title: "Pending UI", slug: "pending-ui" },
      { title: "Testing", slug: "testing" },
      { title: "Streaming SSR", slug: "streaming-ssr" },
      { title: "SSR 배포 아키텍처", slug: "deployment-architecture" },
    ],
  },
  {
    label: "API Reference",
    items: [
      { title: "<Link>", slug: "link" },
      { title: "<NavLink>", slug: "nav-link" },
      { title: "<Form>", slug: "form" },
      { title: "<Navigate>", slug: "navigate" },
      { title: "<Await>", slug: "await" },
      { title: "<Outlet>", slug: "outlet" },
      { title: "<PrefetchPageLinks>", slug: "prefetch-page-links" },
      { title: "<ScrollRestoration>", slug: "scroll-restoration" },
    ],
  },
];

/** Flat ordered list of all slugs for prev/next navigation */
export const allSlugs: string[] = navigation.flatMap((cat) =>
  cat.items.map((item) => item.slug)
);

/** Get prev/next items relative to a given slug */
export function getPrevNext(slug: string) {
  const idx = allSlugs.indexOf(slug);
  if (idx === -1) return { prev: null, next: null };

  const allItems = navigation.flatMap((cat) => cat.items);
  return {
    prev: idx > 0 ? allItems[idx - 1] : null,
    next: idx < allItems.length - 1 ? allItems[idx + 1] : null,
  };
}
