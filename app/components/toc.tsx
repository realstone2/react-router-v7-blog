import { useEffect, useState } from "react";
import type { TocItem } from "~/lib/toc.server";

interface TocProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TocProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className="py-8 pl-4">
      <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
        On this page
      </h4>
      <ul className="space-y-2 text-[13px] border-l border-gray-100 dark:border-gray-900">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block py-1 transition-all duration-200 border-l-2 -ml-px ${
                item.level === 3 ? "pl-6" : "pl-3"
              } ${
                activeId === item.id
                  ? "border-red-500 text-red-700 dark:text-red-400 font-bold bg-red-50/20 dark:bg-red-500/5"
                  : "border-transparent text-gray-500 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 font-medium"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
