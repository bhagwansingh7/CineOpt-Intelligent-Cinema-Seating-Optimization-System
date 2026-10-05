import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Theatres from './pages/Theatres.jsx';
import TheatrePage from './pages/TheatrePage.jsx';
import Recommendation from './pages/Recommendation.jsx';
import Comparison from './pages/Comparison.jsx';
import Bookings from './pages/Bookings.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/theatres" element={<Theatres />} />
          <Route path="/theatres/:id" element={<TheatrePage />} />
          <Route path="/theatres/:id/recommendation" element={<ProtectedRoute><Recommendation /></ProtectedRoute>} />
          <Route path="/theatres/:id/compare" element={<ProtectedRoute><Comparison /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute admin><Admin /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-ink/50">CineOpt - seating chosen by algorithms, not by luck.</footer>
    </div>
  );
}
