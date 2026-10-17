/* oxlint-disable one-var, sort-vars, react/memo-dependencies */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

interface GuestModeContextValue {
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  isGuestMode: boolean;
}

const GuestModeContext = createContext<GuestModeContextValue | null>(null);

export function GuestModeProvider({ children }: { children: ReactNode }) {
  const [isGuestMode, setIsGuestMode] = useState(false),
    enterGuestMode = useCallback(() => {
      setIsGuestMode(true);
    }, []),
    exitGuestMode = useCallback(() => {
      setIsGuestMode(false);
    }, []),
    value = useMemo(
      () => ({
        enterGuestMode,
        exitGuestMode,
        isGuestMode,
      }),
      [enterGuestMode, exitGuestMode, isGuestMode]
    );

  return (
    <GuestModeContext.Provider value={value}>
      {children}
    </GuestModeContext.Provider>
  );
}

export function useGuestMode(): GuestModeContextValue {
  const context = useContext(GuestModeContext);
  if (!context) {
    throw new Error("useGuestMode must be used within a GuestModeProvider");
  }
  return context;
}
