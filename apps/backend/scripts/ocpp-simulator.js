#!/usr/bin/env node
/**
 * A scripted OCPP 1.6-J charge point, for testing OcppCentralSystem
 * locally — no real hardware, no public deployment. See
 * OCPP-INTEGRATION.md for why this is built directly on ocpp-rpc's
 * RPCClient (the same library the real central system uses) rather than
 * a separate simulator tool: it keeps both ends of every test on the
 * same well-tested wire implementation, focusing verification on Kelo's
 * own message handling rather than on incidental differences between two
 * independent OCPP-J stacks.
 *
 * Usage:
 *   node scripts/ocpp-simulator.js <identity> [--endpoint ws://localhost:9220] [--power 7]
 *
 * Control (via stdin, one command per line):
 *   unplug   - sends a real, unsolicited StopTransaction (simulates a
 *              driver physically unplugging, with no RemoteStopTransaction
 *              behind it)
 *   status   - prints current internal state to stdout as JSON, prefixed
 *              "SIM_STATUS:" (used by verify-ocpp.js to poll state)
 *   quit     - closes the connection and exits
 */

const readline = require("readline");
const { RPCClient } = require("ocpp-rpc");

function parseArgs(argv) {
  const identity = argv[2];
  if (!identity || identity.startsWith("--")) {
    console.error("Usage: node ocpp-simulator.js <identity> [--endpoint ws://localhost:9220] [--power 7]");
    process.exit(1);
  }
  let endpoint = "ws://localhost:9220";
  let powerKw = 7;
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--endpoint") endpoint = argv[++i];
    if (argv[i] === "--power") powerKw = Number(argv[++i]);
  }
  return { identity, endpoint, powerKw };
}

const { identity, endpoint, powerKw } = parseArgs(process.argv);

const METER_INTERVAL_MS = 2000;

const state = {
  connectorStatus: "Available",
  transactionId: null,
  idTag: null,
  meterWh: 0, // cumulative energy register, Wh — matches real OCPP semantics
  meterTimer: null,
};

function log(...args) {
  console.log(`[sim ${identity}]`, ...args);
}

const cli = new RPCClient({
  endpoint,
  identity,
  protocols: ["ocpp1.6"],
  strictMode: true,
});

function wattsPerTick() {
  // powerKw kW over METER_INTERVAL_MS, converted to Wh added per tick.
  return (powerKw * 1000 * (METER_INTERVAL_MS / 1000)) / 3600;
}

async function sendStatus(status) {
  state.connectorStatus = status;
  await cli.call("StatusNotification", { connectorId: 1, errorCode: "NoError", status });
  log(`StatusNotification -> ${status}`);
}

async function beginTransaction(idTag) {
  state.idTag = idTag;
  state.meterWh = 0;
  const res = await cli.call("StartTransaction", {
    connectorId: 1,
    idTag,
    meterStart: Math.round(state.meterWh),
    timestamp: new Date().toISOString(),
  });
  state.transactionId = res.transactionId;
  log(`StartTransaction confirmed, transactionId=${state.transactionId}, idTagInfo.status=${res.idTagInfo?.status}`);

  await sendStatus("Charging");

  state.meterTimer = setInterval(async () => {
    state.meterWh += wattsPerTick();
    try {
      await cli.call("MeterValues", {
        connectorId: 1,
        transactionId: state.transactionId,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [{ value: String(Math.round(state.meterWh)), unit: "Wh", measurand: "Energy.Active.Import.Register" }],
          },
        ],
      });
      log(`MeterValues -> ${Math.round(state.meterWh)} Wh`);
    } catch (err) {
      log("MeterValues failed:", err.message);
    }
  }, METER_INTERVAL_MS);
}

async function endTransaction() {
  if (!state.transactionId) return;
  if (state.meterTimer) {
    clearInterval(state.meterTimer);
    state.meterTimer = null;
  }
  const transactionId = state.transactionId;
  const meterStop = Math.round(state.meterWh);
  state.transactionId = null;
  state.idTag = null;

  await cli.call("StopTransaction", {
    transactionId,
    meterStop,
    timestamp: new Date().toISOString(),
    reason: "Local",
  });
  log(`StopTransaction sent, transactionId=${transactionId}, meterStop=${meterStop}`);

  await sendStatus("Available");
}

cli.handle("RemoteStartTransaction", async ({ params }) => {
  log(`RemoteStartTransaction received: connectorId=${params.connectorId} idTag=${params.idTag}`);
  if (state.transactionId) {
    return { status: "Rejected" };
  }
  // Respond first (RemoteStartTransaction's own response only means "ok,
  // I'll try") then, a moment later — simulating a relay physically
  // closing — send the real StartTransaction as its own separate call.
  setTimeout(() => {
    beginTransaction(params.idTag).catch((err) => log("beginTransaction failed:", err.message));
  }, 300);
  return { status: "Accepted" };
});

cli.handle("RemoteStopTransaction", async ({ params }) => {
  log(`RemoteStopTransaction received: transactionId=${params.transactionId}`);
  if (!state.transactionId || state.transactionId !== params.transactionId) {
    return { status: "Rejected" };
  }
  setTimeout(() => {
    endTransaction().catch((err) => log("endTransaction failed:", err.message));
  }, 300);
  return { status: "Accepted" };
});

cli.handle(({ method }) => {
  log(`Unhandled incoming method (ignored): ${method}`);
  return {};
});

async function main() {
  log(`Connecting to ${endpoint} ...`);
  await cli.connect();
  log("Connected.");

  const bootRes = await cli.call("BootNotification", {
    chargePointVendor: "Kelo",
    chargePointModel: "ocpp-simulator",
  });
  log(`BootNotification -> status=${bootRes.status} currentTime=${bootRes.currentTime} interval=${bootRes.interval}`);

  await sendStatus("Available");

  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const cmd = line.trim();
    if (cmd === "unplug") {
      log("Received local unplug command — sending unsolicited StopTransaction.");
      endTransaction().catch((err) => log("unplug failed:", err.message));
    } else if (cmd === "status") {
      console.log(
        "SIM_STATUS:" +
          JSON.stringify({
            connectorStatus: state.connectorStatus,
            transactionId: state.transactionId,
            meterWh: Math.round(state.meterWh),
          }),
      );
    } else if (cmd === "quit") {
      cli.close().finally(() => process.exit(0));
    } else if (cmd) {
      log(`Unknown command: ${cmd}`);
    }
  });
}

main().catch((err) => {
  console.error(`[sim ${identity}] fatal:`, err);
  process.exit(1);
});
