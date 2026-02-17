import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { subscribeSalesEvents } from '@/lib/sales/sales-events';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { workshopId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // Stream closed
        }
      };

      // Send initial open event
      send(`event: open\ndata: {"workshopId":"${workshopId}"}\n\n`);

      // Subscribe to sales events
      const unsubscribe = subscribeSalesEvents(workshopId, (evt) => {
        send(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
      });

      // Heartbeat every 15s
      const pingInterval = setInterval(() => {
        send(`: ping\n\n`);
      }, 15000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(pingInterval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
