import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Menu } from "lucide-react";
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import BrandingBar from "./components/BrandingBar";
import Dashboard from "./pages/Dashboard";
import Registration from "./pages/Registration";
import UserRegistration from "./pages/UserRegistration";
import Roster from "./pages/Roster";
import MatchManagement from "./pages/MatchManagement";
import RefereeDashboard from "./pages/RefereeDashboard";
import Scoreboard from "./pages/Scoreboard";
import OfficialsManagement from "./pages/OfficialsManagement";
import OfficialScoreSheet from "./pages/OfficialScoreSheet";
import EventManagement from "./pages/EventManagement";
import CompletedGames from "./pages/CompletedGames";
import "./index.css";

function AppRouter() {
  const location = useLocation();
  const hideSidebar = location.pathname === "/";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <>
      <BrandingBar />
      <div className="app-layout">
        {!hideSidebar && mobileSidebarOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        {!hideSidebar && (
          <Sidebar
            isMobileOpen={mobileSidebarOpen}
            onClose={() => setMobileSidebarOpen(false)}
          />
        )}
        <main className="main-content">
          {!hideSidebar && (
            <div className="mobile-nav-bar">
              <button
                type="button"
                className="mobile-nav-toggle btn btn-secondary"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu size={18} />
                Menu
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<UserRegistration />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/events" element={<EventManagement />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/registration" element={<Registration />} />
            <Route path="/matches" element={<MatchManagement />} />
            <Route path="/officials" element={<OfficialsManagement />} />
            <Route path="/official/:role" element={<RefereeDashboard />} />
            <Route path="/scoresheet" element={<OfficialScoreSheet />} />
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/completed-games" element={<CompletedGames />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppRouter />
    </Router>
  );
}

export default App;
