import { Injectable } from "@nestjs/common";
import { Charger, computeSessionFinancials } from "@kelo/core";

// A representative charger shape, not real data — this exists purely to
// exercise @kelo/core's types and pricing logic from the backend. If the
// workspace link between apps/backend and packages/core is ever broken,
// this is what fails (at both type-check and runtime), not something
// discovered later once real charger data exists.
const SAMPLE_CHARGER: Charger = {
  id: 0,
  host: "Sample",
  initials: "SM",
  postcode: "SM5",
  title: "Sample Charger",
  power: "7.4kW",
  powerNum: 7.4,
  cable: "Tethered cable",
  connector: "Type 2",
  rate: 0.35,
  overstayRate: 1.0,
  idleRate: 0.15,
  noShowFee: 3.0,
  distance: "0 mi",
  rating: null,
  sessions: 0,
  available: true,
};

@Injectable()
export class AppService {
  getHealth() {
    // seconds=10 stays under the idle-charge threshold, so this is pure
    // energy cost: 5 kWh at £0.35/kWh = £1.75.
    const sample = computeSessionFinancials(SAMPLE_CHARGER, 5, 10);
    return {
      status: "ok",
      core: {
        // Proves @kelo/core's pricing logic actually ran, not just that
        // the types resolved.
        sampleTotalCost: sample.totalCost,
      },
    };
  }
}
