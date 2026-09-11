const { spawn } = require("child_process");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env"),
  quiet: true,
});

function stripOuterQuotes(value) {
  const text = String(value || "").trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function runCommand(command, args, { acceptNonZero = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode !== 0 && !acceptNonZero) {
        reject(new Error(stderr.trim() || stdout.trim() || `Exit code ${exitCode}`));
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

function parseWindowsDshowDevices(output) {
  const devices = [];
  const devicePattern = /"([^"]+)"\s+\(audio\)/i;

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(devicePattern);
    if (match) {
      devices.push({ index: devices.length, name: match[1], input: `audio=${match[1]}` });
    }
  }

  return devices;
}

function parseAvfoundationDevices(output) {
  const devices = [];
  let inAudioSection = false;

  for (const line of output.split(/\r?\n/)) {
    if (/AVFoundation audio devices:/i.test(line)) {
      inAudioSection = true;
      continue;
    }
    if (/AVFoundation video devices:/i.test(line)) {
      inAudioSection = false;
      continue;
    }

    if (!inAudioSection) continue;
    const match = line.match(/\[(\d+)\]\s+(.+)$/);
    if (match) {
      devices.push({ index: Number(match[1]), name: match[2].trim(), input: `:${match[1]}` });
    }
  }

  return devices;
}

function parseAlsaDevices(output) {
  const devices = [];
  const pattern = /^card\s+(\d+):\s+([^\s]+).+device\s+(\d+):\s+([^[]+)/i;

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(pattern);
    if (match) {
      devices.push({
        index: devices.length,
        name: `${match[2]} ${match[4].trim()}`,
        input: `hw:${match[1]},${match[3]}`,
      });
    }
  }

  return devices;
}

async function listInputDevices({ ffmpegBin = process.env.FFMPEG_BIN || "ffmpeg" } = {}) {
  const platform = process.platform;

  if (platform === "win32") {
    const result = await runCommand(stripOuterQuotes(ffmpegBin), [
      "-hide_banner",
      "-list_devices",
      "true",
      "-f",
      "dshow",
      "-i",
      "dummy",
    ], { acceptNonZero: true });
    return parseWindowsDshowDevices(`${result.stdout}\n${result.stderr}`);
  }

  if (platform === "darwin") {
    const result = await runCommand(stripOuterQuotes(ffmpegBin), [
      "-hide_banner",
      "-f",
      "avfoundation",
      "-list_devices",
      "true",
      "-i",
      "",
    ], { acceptNonZero: true });
    return parseAvfoundationDevices(`${result.stdout}\n${result.stderr}`);
  }

  try {
    const result = await runCommand("arecord", ["-l"]);
    const devices = parseAlsaDevices(`${result.stdout}\n${result.stderr}`);
    if (devices.length > 0) return devices;
  } catch {
    // Fall through to the default ALSA device below.
  }

  return [{ index: 0, name: "default", input: "default" }];
}

async function main() {
  try {
    const devices = await listInputDevices();
    console.log("Input devices:");
    for (const device of devices) {
      const defaultMark = device.index === 0 ? "  <-- default" : "";
      console.log(`${device.index}: ${device.name}${defaultMark}`);
    }
  } catch (err) {
    console.error(`Could not list input devices: ${err.message}`);
    console.error("Make sure ffmpeg is installed and available as FFMPEG_BIN or on PATH.");
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  listInputDevices,
};
