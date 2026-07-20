import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Detecta se o componente já hidratou no client, sem usar useEffect+setState
 * (evita o re-render síncrono extra que a regra react-hooks/set-state-in-effect
 * aponta). Renderiza `false` no server e na primeira passada do client, `true`
 * depois da hidratação — o mesmo resultado do padrão clássico `useEffect(() =>
 * setMounted(true), [])`, mas sem o efeito.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
