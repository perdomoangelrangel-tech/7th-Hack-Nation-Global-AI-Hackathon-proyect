/**
 * Remotion CLI config (studio + render).
 * On the hackathon container Chrome can't be downloaded, so we point at the Playwright Chromium
 * when it exists. On your own machine nothing is found and Remotion downloads its headless shell.
 * Override anytime with REMOTION_BROWSER=/path/to/chrome.
 */
import { Config } from "@remotion/cli/config";
import fs from "node:fs";

const candidates = [
  process.env.REMOTION_BROWSER,
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
].filter(Boolean) as string[];
const browser = candidates.find((p) => fs.existsSync(p));
if (browser) Config.setBrowserExecutable(browser);

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
Config.setEntryPoint("src/index.ts");
