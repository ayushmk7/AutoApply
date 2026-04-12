import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiSession } from '../../context/ApiSessionContext';
import { apiFetchJson, apiUrl } from '../../lib/api';

type FeedWire = {
  type: 'application_event';
  data: {
    application_id?: string;
    company: string;
    role: string;
    action: string;
    detail: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  };
  id: string;
  created_at?: unknown;
};

/**
 * Phase 20.5 — REST feed + WebSocket (`/ws/feed?token=`).
 */
export default function ApiLiveFeedPanel() {
  const { accessToken } = useApiSession();
  const [events, setEvents] = useState<FeedWire[]>([]);
  const [wsStatus, setWsStatus] = useState<'off' | 'connecting' | 'open' | 'error'>('off');
  const wsRef = useRef<WebSocket | null>(null);

  const poll = useCallback(async () => {
    if (!accessToken) return;
    const body = await apiFetchJson<{ events?: FeedWire[] }>('/api/feed?limit=30', {
      accessToken,
    }).catch(() => ({ events: [] }));
    setEvents(body.events ?? []);
  }, [accessToken]);

  useEffect(() => {
    void poll();
    const id = window.setInterval(() => void poll(), 15_000);
    return () => window.clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (!accessToken) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${proto}//${host}/ws/feed?token=${encodeURIComponent(accessToken)}`;
    setWsStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setWsStatus('open');
    ws.onerror = () => setWsStatus('error');
    ws.onclose = () => setWsStatus('off');
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as FeedWire;
        if (msg?.type === 'application_event' && msg.data) {
          const id =
            msg.data.application_id ??
            `${msg.data.timestamp}:${msg.data.action}:${msg.data.detail.slice(0, 24)}`;
          setEvents((prev) => [{ ...msg, id }, ...prev]);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [accessToken]);

  if (!accessToken) return null;

  return (
    <div className="glass-panel mb-8 p-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 style={{ fontWeight: 800, fontFamily: 'var(--font-display)' }}>Live activity (API)</h2>
        <span className="mono text-xs" style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
          WS: {wsStatus}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-sm" style={{ fontWeight: 200, color: 'var(--text-secondary)' }}>
          No feed events yet.
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id + e.data.timestamp} className="rounded-md border border-white/20 p-3 text-sm">
              <div style={{ fontWeight: 600 }}>
                {e.data.company} — {e.data.role}
              </div>
              <div className="mono text-xs" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                {e.data.action}
              </div>
              <div style={{ fontWeight: 200 }}>{e.data.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
