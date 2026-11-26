/* App -- root component with router and engine provider. */

import { RouterProvider } from './router';
import { EngineProvider } from './EngineContext';
import { Layout } from './Layout';
import { useRoute } from './router';
import { Home } from './screens/Home';
import { Send } from './screens/Send';
import { Receive } from './screens/Receive';
import { Test } from './screens/Test';
import { Settings } from './screens/Settings';
import { NotFound } from './screens/NotFound';

function ScreenRouter() {
  const { path, isNotFound } = useRoute();

  if (isNotFound) return <NotFound />;

  switch (path) {
    case '/':         return <Home />;
    case '/send':     return <Send />;
    case '/receive':  return <Receive />;
    case '/test':     return <Test />;
    case '/settings': return <Settings />;
    default:          return <NotFound />;
  }
}

export function App() {
  return (
    <RouterProvider>
      <EngineProvider>
        <Layout>
          <ScreenRouter />
        </Layout>
      </EngineProvider>
    </RouterProvider>
  );
}
