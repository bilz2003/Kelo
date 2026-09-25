import { EarningsView } from "@/components/EarningsView";

export const metadata = { title: "Earnings" };

export default function EarningsPage() {
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Dashboard</span>
        <h1 className="display h2">Earnings</h1>
      </div>
      <EarningsView />
    </>
  );
}
