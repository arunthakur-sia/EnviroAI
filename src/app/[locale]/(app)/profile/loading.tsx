// CR08 Phase B: the shape of this page while its data loads.
import { PageSkeleton } from "@/components/nexus/PageSkeleton";

export default function Loading() {
  return <PageSkeleton shape="panel" rows={5} />;
}
