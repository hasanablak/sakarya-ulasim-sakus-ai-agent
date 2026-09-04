import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { setAdminToken } from "../../api";

export function AdminLayout() {
  const nav = useNavigate();
  return (
    <div className="admin">
      <aside>
        <div className="brand compact">
          <span className="mark">S</span>
          <strong>Yönetim</strong>
        </div>
        <nav>
          <NavLink to="/admin" end>
            Hatlar
          </NavLink>
          <NavLink to="/admin/sohbetler">Gelen kutusu</NavLink>
          <div className="nav-group">
            <span>AI Agent ve Tool'lar</span>
            <NavLink to="/admin/agentler">Agent'lar</NavLink>
            <NavLink to="/admin/toollar">Tool'lar</NavLink>
            <NavLink to="/admin/webchatler">Webchat'ler</NavLink>
          </div>
          <NavLink to="/">Siteye dön</NavLink>
        </nav>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setAdminToken(null);
            nav("/admin/login");
          }}
        >
          Çıkış
        </button>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
