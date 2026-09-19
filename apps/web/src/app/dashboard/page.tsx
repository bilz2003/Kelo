import Link from "next/link";
import { AvailabilitySwitch } from "@/components/AvailabilitySwitch";
import { apiGet } from "@/lib/serverApi";
import { gbp } from "@/lib/money";
import type { AuthUser, OwnerCharger } from "@/lib/types";

export const metadata = { title: "My chargers" };

const ROUTE_LABEL = { OCPP: "OCPP", ENODE: "Enode", MOCK: "Demo" } as const;

export default async function MyChargersPage() {
  const [me, chargers] = await Promise.all([apiGet<AuthUser>("/users/me"), apiGet<OwnerCharger[]>("/chargers")]);

  return (
    <>
      <div className="page-head">
        <span className="label">Dashboard</span>
        <h1 className="display h2">My chargers</h1>
      </div>

      {chargers.length === 0 ? (
        <div className="empty">
          <h3>No chargers yet</h3>
          <p>
            Chargers are added in the Kelo app, where your charger&rsquo;s connection is set up and verified. Once it&rsquo;s added it appears
            here, ready to edit.
          </p>
        </div>
      ) : (
        <>
          {chargers.map((c) => (
            <div className="charger-row" key={c.id}>
              <div className="charger-thumb">
                {c.photos[0] ? (
                  // Presigned S3 URL — a plain <img>, not next/image (URLs are short-lived and per-request).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photos[0]} alt="" />
                ) : (
                  <span className="label">No photo</span>
                )}
              </div>
              <div>
                <h3>{c.listingName ?? `${me.name}'s driveway`}</h3>
                <div className="meta">
                  <span>{c.title}</span>
                  <span>{c.powerKw} kW</span>
                  <span>{gbp(c.rate)}/kWh</span>
                  <span>{c.postcode}</span>
                  <span className="badge">{ROUTE_LABEL[c.connectionRoute]}</span>
                </div>
              </div>
              <div className="charger-actions">
                <AvailabilitySwitch chargerId={c.id} initial={c.available} />
                <Link href={`/dashboard/chargers/${c.id}`} prefetch={false} className="btn btn-ghost btn-sm">Edit</Link>
              </div>
            </div>
          ))}
          <p className="boundary-note">To add another charger, use the Kelo app.</p>
        </>
      )}
    </>
  );
}
