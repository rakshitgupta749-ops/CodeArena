const { spawn } = require("child_process");
const path = require("path");
const { listInputDevices } = require("./audioDevices");
const { transcribeAudio } = require("../services/localVoiceService");

require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env"),
  quiet: true,
});

const SAMPLE_RATE = 16_000;
const BYTES_PER_FLOAT = 4;

function parseArgs(argv) {
  const args = {
    chunkSeconds: 5,
    calibrateSeconds: 2,
    energyMultiplier: 3,
    minSpeechSeconds: 0.9,
    ffmpegBin: process.env.FFMPEG_BIN || "ffmpeg",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];

    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--list-devices") args.listDevices = true;
    else if (arg === "--mic") args.mic = next();
    else if (arg === "--model") args.model = next();
    else if (arg === "--device") args.device = next();
    else if (arg === "--chunk-seconds") args.chunkSeconds = Number(next());
    else if (arg === "--calibrate-seconds") args.calibrateSeconds = Number(next());
    else if (arg === "--energy-multiplier") args.energyMultiplier = Number(next());
    else if (arg === "--min-speech-seconds") args.minSpeechSeconds = Number(next());
    else if (arg === "--ffmpeg-bin") args.ffmpegBin = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Live microphone transcription with local Whisper.

Usage:
  npm run voice:devices
  npm run voice:live -- --mic 0 --chunk-seconds 5

Options:
  --mic <index|name>              Input device from voice:devices, or an exact device name.
  --model <model-or-path>         Override WHISPER_MODEL for this run.
  --chunk-seconds <seconds>       Audio chunk size. Default: 5.
  --calibrate-seconds <seconds>   Room-noise calibration time. Default: 2.
  --energy-multiplier <number>    Noise RMS multiplier. Default: 3.
  --min-speech-seconds <seconds>  Required speech inside a chunk. Default: 0.9.
  --ffmpeg-bin <path>             ffmpeg binary. Defaults to FFMPEG_BIN or ffmpeg.
  --list-devices                  List devices and exit.
`);
}

function assertPositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
}

function resolveMic(devices, mic) {
  if (mic === undefined || mic === null || mic === "") {
    return devices[0] || { index: 0, name: "default", input: "default" };
  }

  if (/^\d+$/.test(String(mic))) {
    const match = devices.find((device) => device.index === Number(mic));
    if (!match) {
      throw new Error(`No input device found for index ${mic}. Run npm run voice:devices.`);
    }
    return match;
  }

  const text = String(mic);
  return {
    index: null,
    name: text,
    input: process.platform === "win32" ? `audio=${text}` : text,
  };
}

function ffmpegCaptureArgs(device) {
  const commonOutput = [
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-f",
    "f32le",
    "pipe:1",
  ];

  if (process.platform === "win32") {
    return ["-hide_banner", "-loglevel", "warning", "-f", "dshow", "-i", device.input, ...commonOutput];
  }

  if (process.platform === "darwin") {
    return [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-f",
      "avfoundation",
      "-i",
      device.input,
      ...commonOutput,
    ];
  }

  return ["-hide_banner", "-loglevel", "warning", "-f", "alsa", "-i", device.input, ...commonOutput];
}

function floatsFromBuffer(buffer) {
  const alignedLength = buffer.length - (buffer.length % BYTES_PER_FLOAT);
  const sampleCount = alignedLength / BYTES_PER_FLOAT;
  const audio = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    audio[index] = buffer.readFloatLE(index * BYTES_PER_FLOAT);
  }

  return {
    audio,
    rest: buffer.subarray(alignedLength),
  };
}

function concatFloat32(left, right) {
  if (left.length === 0) return right;
  if (right.length === 0) return left;

  const combined = new Float32Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
}

function splitChunk(audio, sampleCount) {
  return {
    chunk: audio.slice(0, sampleCount),
    rest: audio.slice(sampleCount),
  };
}

function rms(audio) {
  if (audio.length === 0) return 0;

  let sum = 0;
  for (const sample of audio) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / audio.length);
}

function hasSpeech(audio, { threshold, minSpeechSeconds }) {
  if (audio.length === 0) return false;

  const windowSize = Math.max(1, Math.floor(SAMPLE_RATE * 0.03));
  const completeSamples = audio.length - (audio.length % windowSize);
  if (completeSamples <= 0) return false;

  let speechFrames = 0;
  for (let start = 0; start < completeSamples; start += windowSize) {
    let sum = 0;
    for (let index = start; index < start + windowSize; index += 1) {
      sum += audio[index] * audio[index];
    }
    if (Math.sqrt(sum / windowSize) > threshold) {
      speechFrames += 1;
    }
  }

  return (speechFrames * windowSize) / SAMPLE_RATE >= minSpeechSeconds;
}

function wavFromFloat32(audio) {
  const bytesPerSample = 2;
  const dataSize = audio.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < audio.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, audio[index]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    buffer.writeInt16LE(Math.round(int16), 44 + index * bytesPerSample);
  }

  return buffer;
}

function timestamp() {
  return new Date().toTimeString().slice(0, 8);
}

function waitForEnoughAudio(queue, state, sampleCount) {
  if (state.buffer.length >= sampleCount || state.ended || state.error) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    queue.push(resolve);
  });
}

function wake(waiters) {
  while (waiters.length > 0) {
    waiters.shift()();
  }
}

function startFfmpeg(ffmpegBin, device) {
  const child = spawn(ffmpegBin, ffmpegCaptureArgs(device), {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8").trim();
    if (text) console.error(`[ffmpeg] ${text}`);
  });

  return child;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }

  if (args.model) process.env.WHISPER_MODEL = args.model;
  if (args.device) process.env.WHISPER_DEVICE = args.device;

  assertPositiveNumber(args.chunkSeconds, "--chunk-seconds");
  assertPositiveNumber(args.calibrateSeconds, "--calibrate-seconds");
  assertPositiveNumber(args.energyMultiplier, "--energy-multiplier");
  assertPositiveNumber(args.minSpeechSeconds, "--min-speech-seconds");

  if (args.chunkSeconds < 1) {
    throw new Error("--chunk-seconds should be at least 1.");
  }

  const devices = await listInputDevices({ ffmpegBin: args.ffmpegBin });
  if (args.listDevices) {
    console.log("Input devices:");
    for (const device of devices) {
      const defaultMark = device.index === 0 ? "  <-- default" : "";
      console.log(`${device.index}: ${device.name}${defaultMark}`);
    }
    return 0;
  }

  const selectedDevice = resolveMic(devices, args.mic);
  const selectedIndex = selectedDevice.index === null ? "custom" : selectedDevice.index;
  console.log(`Mic: ${selectedIndex} - ${selectedDevice.name}`);
  console.log(`Calibrating room noise for ${args.calibrateSeconds.toFixed(1)}s. Stay quiet...`);

  const ffmpeg = startFfmpeg(args.ffmpegBin, selectedDevice);
  const waiters = [];
  const state = {
    buffer: new Float32Array(0),
    rawRest: Buffer.alloc(0),
    ended: false,
    error: null,
    stopping: false,
  };

  ffmpeg.stdout.on("data", (chunk) => {
    const raw = state.rawRest.length > 0 ? Buffer.concat([state.rawRest, chunk]) : chunk;
    const parsed = floatsFromBuffer(raw);
    state.rawRest = parsed.rest;
    state.buffer = concatFloat32(state.buffer, parsed.audio);
    if (parsed.audio.length > 0) wake(waiters);
  });

  ffmpeg.on("error", (err) => {
    state.error = err;
    wake(waiters);
  });

  ffmpeg.on("close", (exitCode) => {
    state.ended = true;
    if (exitCode !== 0 && !state.error && !state.stopping) {
      state.error = new Error(`ffmpeg stopped with exit code ${exitCode}.`);
    }
    wake(waiters);
  });

  process.on("SIGINT", () => {
    state.stopping = true;
    ffmpeg.kill("SIGTERM");
    wake(waiters);
  });

  const calibrateSamples = Math.floor(SAMPLE_RATE * args.calibrateSeconds);
  await waitForEnoughAudio(waiters, state, calibrateSamples);
  if (state.error) throw state.error;

  let split = splitChunk(state.buffer, calibrateSamples);
  const noiseRms = rms(split.chunk);
  state.buffer = split.rest;

  const threshold = Math.max(0.004, noiseRms * args.energyMultiplier);
  console.log(`Noise RMS: ${noiseRms.toFixed(5)} | speech threshold: ${threshold.toFixed(5)}`);
  console.log(`Loading Whisper engine: ${process.env.WHISPER_ENGINE || "whispercpp"}`);
  console.log("Listening. Press Ctrl+C to stop.");

  const chunkSamples = Math.floor(SAMPLE_RATE * args.chunkSeconds);
  const gate = { threshold, minSpeechSeconds: args.minSpeechSeconds };

  while (!state.ended) {
    await waitForEnoughAudio(waiters, state, chunkSamples);
    if (state.stopping) {
      console.log("\nStopped.");
      return 0;
    }
    if (state.error) throw state.error;
    if (state.buffer.length < chunkSamples) continue;

    split = splitChunk(state.buffer, chunkSamples);
    state.buffer = split.rest;

    if (!hasSpeech(split.chunk, gate)) {
      process.stdout.write(".");
      continue;
    }

    const startedAt = timestamp();
    const result = await transcribeAudio({
      audioBuffer: wavFromFloat32(split.chunk),
      mimeType: "audio/wav",
    });

    if (result.text) {
      console.log(`\n[${startedAt}] ${result.text}`);
    } else {
      process.stdout.write(".");
    }
  }

  return 0;
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}
