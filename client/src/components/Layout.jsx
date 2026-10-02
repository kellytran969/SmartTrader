import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Auth, getToken, setToken } from "../lib/api.js";

const LINKS = [
  ["/", "Dashboard"],
  ["/trade", "Trade"],
  ["/watchlist", "Watchlist"],
  ["/transactions", "Transactions"],
  ["/funding", "Funding"],
];

export default function Layout() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!getToken()) {
      navigate("/login");
      return;
    }
    Auth.me()
      .then(({ user }) => setEmail(user.email))
      .catch(() => {
        setToken(null);
        navigate("/login");
      });
  }, [navigate]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          Smart<span>Trader</span>
        </div>
        {LINKS.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              "nav-link" + (isActive ? " active" : "")
            }
          >
            {label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="user-chip">{email}</div>
        <button
          className="btn secondary"
          onClick={() => {
            setToken(null);
            navigate("/login");
          }}
        >
          Log out
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
