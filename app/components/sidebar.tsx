import { NavLink, useRouteLoaderData } from 'react-router';
import type { NavCategory } from '~/lib/navigation.server';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const data = useRouteLoaderData('root') as { navigation: NavCategory[] } | undefined;
  const navigation = data?.navigation ?? [];

  return (
    <nav className="py-8 pr-4 space-y-8">
      {navigation.map(category => (
        <div key={category.label}>
          <h3 className="px-3 mb-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {category.label}
          </h3>
          <ul className="space-y-1">
            {category.items.map(item => (
              <li key={item.slug}>
                <NavLink
                  to={`/posts/${item.slug}`}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      isActive
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 font-bold border-l-2 border-red-500 dark:border-red-400 -ml-[2px]'
                        : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-900 font-medium'
                    }`
                  }
                >
                  {({ isPending }) => {
                    return isPending ? (
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">Loading...</span>
                    ) : (
                      item.title
                    );
                  }}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Experiments */}
      <div>
        <h3 className="px-3 mb-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Experiments
        </h3>
        <ul className="space-y-1">
          {[{ to: '/experiment/blocker', label: 'Navigation Blocker' }].map(e => (
            <li key={e.to}>
              <NavLink
                to={e.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 font-bold border-l-2 border-red-500 dark:border-red-400 -ml-[2px]'
                      : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-900 font-medium'
                  }`
                }
              >
                {e.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
