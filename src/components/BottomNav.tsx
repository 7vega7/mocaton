import { NavLink } from 'react-router-dom';

export default function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🏠</span><span>Home</span>
      </NavLink>
      <NavLink to="/stake" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🪙</span><span>Stake</span>
      </NavLink>
      <NavLink to="/leaderboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🏆</span><span>Rank</span>
      </NavLink>
      <NavLink to="/referral" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">👥</span><span>Referral</span>
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">⚙️</span><span>Admin</span>
        </NavLink>
      )}
    </nav>
  );
}
