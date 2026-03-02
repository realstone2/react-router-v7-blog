import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('posts/:slug', 'routes/post/posts.$slug.tsx'),
  layout('routes/experiment/_layout.tsx', [
    route('experiment', 'routes/experiment/index.tsx'),
    route('experiment/blocker', 'routes/experiment/Blocker.tsx'),
  ]),
] satisfies RouteConfig;
