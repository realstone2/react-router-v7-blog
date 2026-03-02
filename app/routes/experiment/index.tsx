import { Link } from "react-router";

const experiments = [
  {
    path: "/experiment/blocker",
    label: "Navigation Blocker",
    description:
      "useBlocker와 useBeforeUnload를 활용한 네비게이션 차단 동작 실험",
  },
];

export default function ExperimentIndexPage() {
  return (
    <div>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
        Experiments
      </h1>
      <p className="mt-3 text-gray-500 dark:text-gray-400">
        React Router, React 19 등 기능을 직접 실험하는 공간입니다.
      </p>

      <ul className="mt-10 space-y-4">
        {experiments.map((e) => (
          <li key={e.path}>
            <Link
              to={e.path}
              className="block rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-red-300 dark:hover:border-red-500/50 hover:bg-red-50/40 dark:hover:bg-red-500/5 transition-colors group"
            >
              <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                {e.label}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {e.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
