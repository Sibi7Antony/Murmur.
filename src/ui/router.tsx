/* ===================================================================
 * Minimal client-side router.
 * Hash-based for static hosting compatibility. ~60 lines, no deps.
 * =================================================================== */

import { useState, useEffect, useCallback, useContext } from 'react';
import React from 'react';

type Route = '/' | '/send' | '/receive' | '/test' | '/settings';

function getPath(): string {
  const hash = window.location.hash.slice(1);
  return hash || '/';
}

function isValidRoute(path: string): path is Route {
  return ['/', '/send', '/receive', '/test', '/settings'].includes(path);
}

interface RouterContext {
  path: string;
  navigate: (to: string) => void;
}

const RouterCtx = React.createContext<RouterContext>({
  path: '/',
  navigate: () => {},
});

export function useRouter() {
  return useContext(RouterCtx);
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const onHashChange = () => setPath(getPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return (
    <RouterCtx.Provider value={{ path, navigate }}>
      {children}
    </RouterCtx.Provider>
  );
}

export function useRoute(): { path: string; isNotFound: boolean } {
  const { path } = useRouter();
  return {
    path,
    isNotFound: !isValidRoute(path),
  };
}
