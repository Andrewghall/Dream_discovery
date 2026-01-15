import { NextRequest } from 'next/server';
import { subscribeWorkshopEvents } from '@/lib/realtime/workshop-events';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workshopId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };

      // Initial event so the client knows the stream is alive.
      send(`event: open\n`);
      send(`data: {}\n\n`);

      const unsubscribe = subscribeWorkshopEvents(workshopId, (evt) => {
        send(`event: ${evt.type}\n`);
        send(`data: ${JSON.stringify(evt)}\n\n`);
      });

      const ping = setInterval(() => {
        // Comment line keeps some proxies from closing the connection.
        send(`: ping\n\n`);
      }, 15000);

      const onAbort = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      if (request.signal.aborted) {
        onAbort();
        return;
      }

      request.signal.addEventListener('abort', onAbort);
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
