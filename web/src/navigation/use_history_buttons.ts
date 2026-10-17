import { useEffect, useState } from 'react';

type NavigationApi = EventTarget & { canGoBack: boolean; canGoForward: boolean };

const navigation = (window as unknown as { navigation?: NavigationApi }).navigation;

export function use_history_buttons() {
  const [state, set_state] = useState({ back: navigation?.canGoBack ?? false, forward: navigation?.canGoForward ?? false });

  useEffect(() => {
    if (!navigation) return;
    const update = () => set_state({ back: navigation.canGoBack, forward: navigation.canGoForward });
    update();
    navigation.addEventListener('currententrychange', update);
    return () => navigation.removeEventListener('currententrychange', update);
  }, []);

  return { ...state, supported: navigation !== undefined };
}
