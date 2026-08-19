import "dotenv/config";
import { runCalibrationDueEmails } from "../src/lib/calibrationDueEmail";

async function main() {
  const startedAt = new Date();
  const result = await runCalibrationDueEmails(startedAt);
  console.log(JSON.stringify({ startedAt: startedAt.toISOString(), ...result }));
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Calibration digest failed:", error);
  process.exitCode = 1;
});
