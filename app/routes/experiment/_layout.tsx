import { Outlet } from "react-router";
import { Sidebar } from "~/components/sidebar";

export default function ExperimentLayout() {
  return (
    <div className="max-w-[1400px] mx-auto flex">
      {/* Shared sidebar — same as docs pages */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <Sidebar />
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 px-6 lg:px-12 py-12">
        <Outlet />
      </main>
    </div>
  );
}
