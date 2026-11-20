import { QueueView } from "@/components/QueueView";
import { snapshots } from "@/lib/snapshots";
import { patients } from "@/lib/data/patients";

export const metadata = { title: "Decision queue · OncoAgent" };

export default function QueuePage() {
  const items = patients.flatMap((p) =>
    snapshots[p.id].cards.map((c) => ({ id: c.id, patientId: p.id, patientName: p.displayName, agent: c.agent, kind: c.kind, proposal: c.proposal, confidence: c.confidence, critic: c.critic.verdict, origin: c.origin })),
  );
  return <QueueView items={items} />;
}
