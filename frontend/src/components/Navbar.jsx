import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const link = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    toast.info('You have been logged out');
    navigate('/');
  };

  return (
    <header className="bg-velvet-dark text-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-4 font-display text-xl font-bold tracking-tight">
          Cine<span className="text-beam">Opt</span>
        </Link>
        <NavLink to="/theatres" className={link}>Book seats</NavLink>
        {user && <NavLink to="/bookings" className={link}>My bookings</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-white/80 sm:inline">{user.name}</span>
              <button type="button" onClick={onLogout} className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/10">Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={link}>Log in</NavLink>
              <Link to="/register" className="rounded-md bg-beam px-3 py-1.5 text-sm font-semibold text-ink hover:brightness-95">Register</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
