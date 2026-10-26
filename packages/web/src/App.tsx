import { useCallback, useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { ActivityProvider } from "./activity";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer } from "./components/Footer";
import { TestnetBanner } from "./components/TestnetBanner";
import { Header } from "./components/Header";
import { LiveColumn } from "./components/LiveColumn";
import { LiveSheet } from "./components/LiveSheet";
import { TabBar } from "./components/TabBar";
import { Ticker } from "./components/Ticker";
import { CreateDrop } from "./pages/CreateDrop";
import { DropPage } from "./pages/DropPage";
import { Drops } from "./pages/Drops";
import { Home } from "./pages/Home";
import { HowItWorks } from "./pages/HowItWorks";
import { Me } from "./pages/Me";
import { NotFound } from "./pages/NotFound";
import { Safety } from "./pages/Safety";

const HOME_KEY = "nabb.live.collapsed.home";
const OTHER_KEY = "nabb.live.collapsed";

function readPreference(key: string): boolean | undefined {
  try {
    const value = localStorage.getItem(key);
    return value === "1" ? true : value === "0" ? false : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the live column is collapsed. On the home page it starts collapsed so the hero and the
 * drop grid get the full width; elsewhere it starts open. Each side remembers the user's own
 * choice. Storage may be unavailable, so it is never relied on.
 */
function useCollapsed(isHome: boolean): [boolean, () => void] {
  const [preferences, setPreferences] = useState(() => ({
    home: readPreference(HOME_KEY),
    other: readPreference(OTHER_KEY),
  }));
  const collapsed = (isHome ? preferences.home : preferences.other) ?? isHome;

  const toggle = useCallback(() => {
    const next = !collapsed;
    setPreferences((current) => ({ ...current, [isHome ? "home" : "other"]: next }));
    try {
      localStorage.setItem(isHome ? HOME_KEY : OTHER_KEY, next ? "1" : "0");
    } catch {
      // Not persisted; the toggle still works for this visit.
    }
  }, [collapsed, isHome]);

  return [collapsed, toggle];
}

export function App() {
  const { pathname } = useLocation();
  const [collapsed, toggleCollapsed] = useCollapsed(pathname === "/");
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <ActivityProvider>
      <div className="app">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <TestnetBanner />
        <div className="chrome">
          <Header />
          <Ticker />
        </div>
        <div className="shell" data-live={collapsed ? "collapsed" : "open"}>
          <main id="main" tabIndex={-1} className="main">
            {/* Keyed by path so navigating away from a crashed page recovers. */}
            <ErrorBoundary key={pathname}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/drops" element={<Drops />} />
                <Route path="/create" element={<CreateDrop />} />
                <Route path="/me" element={<Me />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/safety" element={<Safety />} />
                <Route path="/drop/:dropId" element={<DropPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </main>
          <LiveColumn collapsed={collapsed} onToggle={toggleCollapsed} />
        </div>
        <Footer />
        <TabBar sheetOpen={sheetOpen} onToggleLive={() => setSheetOpen((open) => !open)} />
        {sheetOpen && <LiveSheet onClose={closeSheet} />}
      </div>
    </ActivityProvider>
  );
}
