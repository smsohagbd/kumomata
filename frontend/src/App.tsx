import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import IPManager from "./pages/IPManager";
import DomainRules from "./pages/DomainRules";
import DKIMPage from "./pages/DKIMPage";
import ConfigPreview from "./pages/ConfigPreview";
import SettingsPage from "./pages/SettingsPage";
import LogsPage from "./pages/LogsPage";
import SuppressionList from "./pages/SuppressionList";
import SmtpUsers from "./pages/SmtpUsers";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ips" element={<IPManager />} />
          <Route path="/domains" element={<DomainRules />} />
          <Route path="/dkim" element={<DKIMPage />} />
          <Route path="/config" element={<ConfigPreview />} />
          <Route path="/logs" element={<LogsPage />} />
              <Route path="/suppressions" element={<SuppressionList />} />
              <Route path="/smtp-users" element={<SmtpUsers />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
