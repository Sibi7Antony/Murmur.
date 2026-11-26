/* Nav -- glass pill navigation bar matching the reference. */

import { useRouter } from '../router';
import { COPY } from '../../copy';
import './Nav.css';

const NAV_ITEMS = [
  {
    path: '/',
    label: COPY.nav.home,
    color: '#FF6738',
    bg: 'rgba(255, 103, 56, 0.18)',
    border: 'rgba(255, 103, 56, 0.45)',
    glow: 'rgba(255, 103, 56, 0.35)',
  },
  {
    path: '/send',
    label: COPY.nav.send,
    color: '#6E7BFF',
    bg: 'rgba(110, 123, 255, 0.20)',
    border: 'rgba(110, 123, 255, 0.50)',
    glow: 'rgba(110, 123, 255, 0.35)',
  },
  {
    path: '/receive',
    label: COPY.nav.receive,
    color: '#00BFA5',
    bg: 'rgba(0, 191, 165, 0.20)',
    border: 'rgba(0, 191, 165, 0.50)',
    glow: 'rgba(0, 191, 165, 0.35)',
  },
  {
    path: '/test',
    label: COPY.nav.test,
    color: '#FFAA00',
    bg: 'rgba(255, 170, 0, 0.20)',
    border: 'rgba(255, 170, 0, 0.50)',
    glow: 'rgba(255, 170, 0, 0.35)',
  },
  {
    path: '/settings',
    label: COPY.nav.settings,
    color: '#B366FF',
    bg: 'rgba(179, 102, 255, 0.20)',
    border: 'rgba(179, 102, 255, 0.50)',
    glow: 'rgba(179, 102, 255, 0.35)',
  },
] as const;

export function Nav() {
  const { path, navigate } = useRouter();

  return (
    <nav className="nav-pill" role="navigation" aria-label="Main navigation">
      <ul className="nav-list">
        {NAV_ITEMS.map((item, i) => {
          const isActive = path === item.path;
          return (
            <li key={item.path} className="nav-item">
              {i === 1 && <span className="nav-divider" aria-hidden="true" />}
              <button
                className={`nav-link ${isActive ? 'nav-link--active' : ''}`}
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                style={
                  isActive
                    ? {
                        background: item.bg,
                        borderColor: item.border,
                        boxShadow: `0 2px 14px ${item.glow}`,
                        color: '#0E0C26',
                      }
                    : undefined
                }
              >
                {isActive && (
                  <span
                    className="nav-dot"
                    style={{
                      backgroundColor: item.color,
                      boxShadow: `0 0 8px ${item.color}`,
                    }}
                    aria-hidden="true"
                  />
                )}
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
