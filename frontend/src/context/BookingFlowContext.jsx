import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Holds the last optimisation (request + result) so the recommendation and comparison pages can show it.
const KEY = 'cineopt.flow';
const BookingFlowContext = createContext(null);

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch (err) {
    return null;
  }
}

export function BookingFlowProvider({ children }) {
  const [flow, setFlowState] = useState(load);

  const setFlow = useCallback((next) => {
    setFlowState(next);
    try {
      if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
      else sessionStorage.removeItem(KEY);
    } catch (err) { /* storage unavailable: keep in memory only */ }
  }, []);

  const clear = useCallback(() => setFlow(null), [setFlow]);
  const value = useMemo(() => ({ flow, setFlow, clear }), [flow, setFlow, clear]);
  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>;
}

export const useBookingFlow = () => useContext(BookingFlowContext);
