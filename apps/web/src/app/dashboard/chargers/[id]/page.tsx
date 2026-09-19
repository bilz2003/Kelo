import Link from "next/link";
import { notFound } from "next/navigation";
import { EditChargerForm } from "@/components/EditChargerForm";
import { apiGet } from "@/lib/serverApi";
import type { AuthUser, OwnerCharger } from "@/lib/types";

export const metadata = { title: "Edit charger" };

export default async function EditChargerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Only real charger ids exist here — "/dashboard/chargers/new" and friends are simply not pages.
  if (!/^\d+$/.test(id)) notFound();
  const [me, charger] = await Promise.all([apiGet<AuthUser>("/users/me"), apiGet<OwnerCharger>(`/chargers/${Number(id)}`)]);

  return (
    <>
      <div className="page-head">
        <Link href="/dashboard" prefetch={false} className="label link">← My chargers</Link>
        <h1 className="display h2">Edit charger</h1>
        <p className="soft mono" style={{ fontSize: 13, marginTop: 8 }}>
          {charger.title} · {charger.powerKw} kW · {charger.postcode}
        </p>
      </div>
      <EditChargerForm charger={charger} ownerName={me.name} />
    </>
  );
}
