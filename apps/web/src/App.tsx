import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { ChatWidget } from "./components/ChatWidget";
import { getAdminToken } from "./api";
import { HomePage } from "./pages/Home";
import { EmbedPage } from "./pages/Embed";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AgentFormPage } from "./pages/admin/AgentForm";
import { AgentlerPage } from "./pages/admin/Agentler";
import { HatDetayPage } from "./pages/admin/HatDetay";
import { HatlarPage } from "./pages/admin/Hatlar";
import { LoginPage } from "./pages/admin/Login";
import { SohbetlerPage } from "./pages/admin/Sohbetler";
import { ToolFormPage } from "./pages/admin/ToolForm";
import { ToollarPage } from "./pages/admin/Toollar";
import { WebchatFormPage } from "./pages/admin/WebchatForm";
import { WebchatlerPage } from "./pages/admin/Webchatler";

function RequireAdmin({ children }: { children: ReactNode }) {
  if (!getAdminToken()) return <Navigate to="/admin/login" replace />;
  return children;
}

export function App() {
  const location = useLocation();
  const showChat = !location.pathname.startsWith("/admin") && !location.pathname.startsWith("/embed/");
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/embed/:slug" element={<EmbedPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<HatlarPage />} />
          <Route path="hatlar/:slug" element={<HatDetayPage />} />
          <Route path="sohbetler" element={<SohbetlerPage />} />
          <Route path="sohbetler/:id" element={<SohbetlerPage />} />
          <Route path="agentler" element={<AgentlerPage />} />
          <Route path="agentler/yeni" element={<AgentFormPage />} />
          <Route path="agentler/:id" element={<AgentFormPage />} />
          <Route path="toollar" element={<ToollarPage />} />
          <Route path="toollar/yeni" element={<ToolFormPage />} />
          <Route path="toollar/:id" element={<ToolFormPage />} />
          <Route path="webchatler" element={<WebchatlerPage />} />
          <Route path="webchatler/yeni" element={<WebchatFormPage />} />
          <Route path="webchatler/:id" element={<WebchatFormPage />} />
        </Route>
      </Routes>
      {showChat && <ChatWidget />}
    </>
  );
}
