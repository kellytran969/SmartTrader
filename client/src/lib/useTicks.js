import { useEffect, useRef, useState } from "react";
import { MARKET_WS_URL } from "./api.js";

/**
 * Subscribe to live price ticks for `symbols` over the market-data
 * WebSocket. Returns a map symbol -> latest tick { price, ts }.
 * Reconnects automatically when the symbol list changes.
 */
export function useTicks(symbols) {
  const [ticks, setTicks] = useState({});
  const key = [...symbols].sort().join(",");
  const wsRef = useRef(null);

  useEffect(() => {
    if (!key) {
      setTicks({});
      return;
    }
    let closed = false;
    let timer = null;
    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(`${MARKET_WS_URL}?symbols=${key}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          setTicks((prev) => {
            const next = { ...prev };
            for (const t of msg.ticks || []) next[t.symbol] = t;
            return next;
          });
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (!closed) timer = setTimeout(connect, 2000); // reconnect
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ticks;
}
