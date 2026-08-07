import React, { useState } from "react";
import { MyChargersScreen } from "./MyChargersScreen";
import { EditChargerScreen } from "./EditChargerScreen";
import { AddChargerScreen } from "./AddChargerScreen";

type Screen = { name: "overview" } | { name: "edit"; chargerId: number } | { name: "add" };

/**
 * My Chargers isn't a real navigation stack in the web prototype either —
 * it's a single tab that locally switches between overview/edit/add. Kept
 * that way here rather than introducing a nested stack navigator, since
 * there's nothing to deep-link to and it matches the source of truth.
 */
export function MyChargersFlow() {
  const [screen, setScreen] = useState<Screen>({ name: "overview" });

  if (screen.name === "edit") {
    return <EditChargerScreen chargerId={screen.chargerId} onBack={() => setScreen({ name: "overview" })} />;
  }
  if (screen.name === "add") {
    return <AddChargerScreen onBack={() => setScreen({ name: "overview" })} onAdded={() => setScreen({ name: "overview" })} />;
  }
  return (
    <MyChargersScreen
      onAdd={() => setScreen({ name: "add" })}
      onEdit={(chargerId) => setScreen({ name: "edit", chargerId })}
    />
  );
}
