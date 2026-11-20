import { QueueView } from "@/components/QueueView";
import { snapshots } from "@/lib/snapshots";
import { patients } from "@/lib/data/patients";

export const metadata = { title: "Decision queue · OncoAgent" };

export default function QueuePage() {
  const stored = Object.fromEntries(patients.map((p) => [p.id, snapshots[p.id].cards]));
  const names = Object.fromEntries(patients.map((p) => [p.id, p.displayName]));
  return <QueueView stored={stored} names={names} />;
}
