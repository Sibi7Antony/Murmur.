/* Layout -- shared shell wrapping every screen. */

import { Background } from './components/Background';
import { GrainOverlay } from './components/GrainOverlay';
import { Logo } from './components/Logo';
import { Nav } from './components/Nav';
import { StatusPill } from './components/StatusPill';
import { Footer } from './components/Footer';
import { useEngine } from './EngineContext';
import { COPY } from '../copy';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isMock } = useEngine();

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <Background />
      <GrainOverlay />
      <Logo />
      <Nav />
      <StatusPill />

      {isMock && (
        <div className="demo-banner" role="alert">
          {COPY.demoWarning}
        </div>
      )}

      {children}

      <Footer />

      {/* Live region for status announcements */}
      <div className="announcer" aria-live="polite" aria-atomic="true" />
    </>
  );
}
