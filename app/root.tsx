import { useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Link,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { getNavigation } from "~/lib/navigation.server";
import { ThemeToggle } from "~/components/theme-toggle";
import { MobileNav } from "~/components/mobile-nav";
import "./app.css";

export function loader() {
  return { navigation: getNavigation() };
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <html lang="ko" className="antialiased" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(t===null&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-white dark:bg-black text-gray-900 dark:text-gray-200 min-h-screen flex flex-col font-sans">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-900">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link
                to="/"
                className="text-xl font-heading font-extrabold tracking-tighter hover:opacity-70 transition-opacity"
              >
                realstone<span className="text-red-600">.</span>
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1">
          {children}
        </div>
        <footer className="border-t border-gray-100 dark:border-gray-900 py-8 bg-gray-50/50 dark:bg-gray-950/50">
          <div className="max-w-[1400px] mx-auto px-6 text-sm text-gray-500 dark:text-gray-500 text-center font-medium">
            © {new Date().getFullYear()} realstone blog
          </div>
        </footer>
        <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{message}</h1>
      <p className="text-gray-600 dark:text-gray-400">{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto mt-4 bg-gray-100 dark:bg-gray-900 rounded text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
