import { getPatient } from "@/lib/data/patients";
import { runPipeline } from "@/lib/agents/pipeline";

// Runs the agent pipeline for one patient and streams each finished step as a line of JSON.
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { patientId?: string; useClaude?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const p = body.patientId ? getPatient(body.patientId) : undefined;
  if (!p) return Response.json({ error: "Unknown patientId" }, { status: 404 });

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await runPipeline(p, { useClaude: body.useClaude !== false, onStep: (step) => send({ type: "step", step }) });
        send({ type: "result", result });
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
