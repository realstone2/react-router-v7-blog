import { NavLink } from "react-router";
import { navigation } from "~/lib/navigation";

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <nav className="py-8 pr-4 space-y-8">
      {navigation.map((category) => (
        <div key={category.label}>
          <h3 className="px-3 mb-3 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
            {category.label}
          </h3>
          <ul className="space-y-1">
            {category.items.map((item) => (
              <li key={item.slug}>
                <NavLink
                  to={`/posts/${item.slug}`}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-red-50/50 dark:bg-red-500/10 text-red-700 dark:text-red-400 font-bold border-l-2 border-red-500 -ml-[2px]"
                        : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-900/50 font-medium"
                    }`
                  }
                >
                  {item.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
