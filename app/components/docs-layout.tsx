import type { ReactNode } from "react";
import { Sidebar } from "~/components/sidebar";
import { TableOfContents } from "~/components/toc";
import type { TocItem } from "~/lib/toc.server";

interface DocsLayoutProps {
  children: ReactNode;
  toc: TocItem[];
}

export function DocsLayout({ children, toc }: DocsLayoutProps) {
  return (
    <div className="max-w-[1400px] mx-auto flex">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-gray-100 dark:border-gray-900 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex">
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-12">
          {children}
        </main>

        {/* ToC — hidden below xl */}
        <aside className="w-64 shrink-0 hidden xl:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-l border-gray-100 dark:border-gray-900">
          <TableOfContents items={toc} />
        </aside>
      </div>
    </div>
  );
}
