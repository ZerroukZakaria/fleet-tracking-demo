import { connect } from "mqtt";
import { DEMO_PLANS, Simulator, encodePosition, positionTopic } from "@fleet/core";

const BROKER_URL = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
/** How much faster than real time the simulation runs. 1 = real time. */
const SPEEDUP = Number(process.env.SIM_SPEED ?? 10);
/** Simulated time between two position reports (a typical GPS interval). */
const REPORT_INTERVAL_MS = 10_000;

if (!Number.isFinite(SPEEDUP) || SPEEDUP <= 0) {
  console.error(`SIM_SPEED must be a positive number, got "${process.env.SIM_SPEED}"`);
  process.exit(1);
}

const sim = new Simulator(DEMO_PLANS, {
  startTime: Date.now(),
  noiseM: 4,
  seed: 1,
});

const client = connect(BROKER_URL);
let timer: NodeJS.Timeout | undefined;
let rounds = 0;

client.on("connect", () => {
  console.log(`Connected to ${BROKER_URL}`);
  if (timer) return; // reconnects should not start a second loop
  const everyMs = REPORT_INTERVAL_MS / SPEEDUP;
  console.log(`Publishing ${DEMO_PLANS.length} vehicles every ${everyMs} ms (speed ${SPEEDUP}x)`);

  timer = setInterval(() => {
    // While the broker is unreachable, pause rather than queue messages
    if (!client.connected) return;
    for (const position of sim.tick(REPORT_INTERVAL_MS)) {
      client.publish(positionTopic(position.vehicleId), encodePosition(position), {
        qos: 0,
      });
    }
    rounds += 1;
    if (rounds % 10 === 0) {
      console.log(`${rounds} rounds published (${rounds * DEMO_PLANS.length} messages)`);
    }
  }, everyMs);
});

client.on("error", (err) => console.error("MQTT error:", err.message));
client.on("close", () => console.log("Connection closed"));

const shutdown = () => {
  if (timer) clearInterval(timer);
  console.log("\nStopping");
  client.end(false, () => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);