// src/components/BottomNav.tsx
import { NavLink } from 'react-router-dom';

interface BottomNavProps {
  isAdmin: boolean;
}

export default function BottomNav({ isAdmin }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🏠</span>
        <span>Home</span>
      </NavLink>
      <NavLink to="/stake" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">🪙</span>
        <span>Stake</span>
      </NavLink>
      <NavLink to="/referral" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">👥</span>
        <span>Referral</span>
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">⚙️</span>
          <span>Admin</span>
        </NavLink>
      )}
    </nav>
  );
}
