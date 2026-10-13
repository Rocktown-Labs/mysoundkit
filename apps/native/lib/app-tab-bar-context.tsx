/* eslint-disable one-var, sort-vars */
import { createContext, useContext } from "react";

export interface TabBarVisibility {
  setIsAppTabBarHidden: (hidden: boolean) => void;
}

const noop = (): undefined => undefined;

export const AppTabBarContext = createContext<TabBarVisibility>({
  setIsAppTabBarHidden: noop,
});

export const useAppTabBar = () => useContext(AppTabBarContext);
