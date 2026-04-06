/* Writes a minimal valid 1×1 PNG if info-icon.png is missing (replace with your asset). */
const fs = require("fs");
const path = require("path");
const dest = path.join(__dirname, "..", "assets", "info-icon.png");
const minimalPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
if (!fs.existsSync(dest)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, minimalPng);
  console.log("Wrote placeholder apps/mobile/assets/info-icon.png — replace with your PNG.");
}
