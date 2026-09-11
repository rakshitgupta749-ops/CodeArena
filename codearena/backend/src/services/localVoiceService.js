const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const BACKEND_ROOT = path.join(__dirname, "..", "..");

require("dotenv").config({
  path: path.join(BACKEND_ROOT, ".env"),
  override: true,
  quiet: true,
});

class VoiceServiceError extends Error {
  constructor(message, { code = "VOICE_SERVICE_ERROR", status = 503, details = "" } = {}) {
    super(message);
    this.name = "VoiceServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function readPositiveNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBooleanEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function readPlatformEnv(name, fallback = "") {
  const platformName = {
    win32: "WIN32",
    darwin: "DARWIN",
    linux: "LINUX",
  }[process.platform];
  const platformValue = platformName ? process.env[`${name}_${platformName}`] : undefined;

  if (platformValue !== undefined && platformValue !== null && platformValue !== "") {
    return platformValue;
  }

  return process.env[name] || fallback;
}

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

function resolveConfiguredPath(value) {
  const text = stripOuterQuotes(value);
  if (!text) return text;
  if (path.isAbsolute(text)) return text;
  if (!/[\\/]/.test(text) && !text.startsWith(".")) return text;
  return path.resolve(BACKEND_ROOT, text);
}

function splitArgs(value) {
  const text = String(value || "").trim();
  if (!text) return [];

  const args = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    args.push(match[1] ?? match[2] ?? match[3]);
  }
  return args;
}

function hasCliArg(args, ...names) {
  const normalized = new Set(names);
  return args.some((arg) => normalized.has(String(arg || "").trim()));
}

function hasAnyCliArg(args, names) {
  return args.some((arg) => names.includes(String(arg || "").trim()));
}

function runLocalCommand(command, args, { stdin, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(stripOuterQuotes(command), args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(
        new VoiceServiceError("Local voice command timed out.", {
          code: "VOICE_COMMAND_TIMEOUT",
          details: `Command exceeded ${Math.round(timeoutMs / 1000)}s.`,
        })
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(
        new VoiceServiceError("Local voice binary could not be started.", {
          code: "VOICE_BINARY_UNAVAILABLE",
          details: err.message,
        })
      );
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (exitCode !== 0) {
        reject(
          new VoiceServiceError("Local voice command failed.", {
            code: "VOICE_COMMAND_FAILED",
            details: stderr.trim() || stdout.trim() || `Exit code ${exitCode}`,
          })
        );
        return;
      }

      resolve({ stdout, stderr });
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "codearena-voice-"));
}

async function removeTempDir(dir) {
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

function getVoiceStatus() {
  const whisperEngine = String(process.env.WHISPER_ENGINE || "whispercpp").toLowerCase();
  const piperBin = readPlatformEnv("PIPER_BIN");
  const piperModel = readPlatformEnv("PIPER_MODEL");
  const whisperBin = readPlatformEnv("WHISPER_BIN");
  const whisperModel = readPlatformEnv("WHISPER_MODEL");
  return {
    piper: {
      configured: Boolean(piperBin && piperModel),
      binary: Boolean(piperBin),
      model: Boolean(piperModel),
    },
    whisper: {
      engine: whisperEngine,
      configured:
        whisperEngine === "openai-whisper" || whisperEngine === "faster-whisper"
          ? Boolean(whisperBin || whisperModel)
          : Boolean(whisperBin && whisperModel),
      binary: whisperEngine === "faster-whisper"
        ? Boolean(readPlatformEnv("WHISPER_PYTHON", process.platform === "win32" ? "python" : "python3"))
        : Boolean(whisperBin),
      model: Boolean(whisperModel),
    },
    fallbacks: {
      tts: "browser_speech_synthesis",
      transcription: "typed_answer",
    },
  };
}

function requireConfig(value, code, message) {
  if (!value) {
    throw new VoiceServiceError(message, { code });
  }
  return resolveConfiguredPath(value);
}

function sanitizeTextForSpeech(text) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    throw new VoiceServiceError("Text is required for speech synthesis.", {
      code: "PIPER_EMPTY_TEXT",
      status: 400,
    });
  }

  return clean.slice(0, 4000);
}

async function synthesizeSpeech({ text }) {
  const piperBin = requireConfig(
    readPlatformEnv("PIPER_BIN"),
    "PIPER_NOT_CONFIGURED",
    "Local Piper is not configured. Set PIPER_BIN and PIPER_MODEL."
  );
  const piperModel = requireConfig(
    readPlatformEnv("PIPER_MODEL"),
    "PIPER_NOT_CONFIGURED",
    "Local Piper is not configured. Set PIPER_BIN and PIPER_MODEL."
  );
  const cleanText = sanitizeTextForSpeech(text);
  const timeoutMs = readPositiveNumber("PIPER_TIMEOUT_SECONDS", 30) * 1000;
  let tempDir;

  try {
    tempDir = await createTempDir();
    const outputPath = path.join(tempDir, "question.wav");
    const args = [
      ...splitArgs(readPlatformEnv("PIPER_EXTRA_ARGS")),
      "--model",
      piperModel,
      "--output_file",
      outputPath,
    ];

    const piperConfig = readPlatformEnv("PIPER_CONFIG");
    if (piperConfig) {
      args.push("--config", resolveConfiguredPath(piperConfig));
    }
    if (process.env.PIPER_SPEAKER) {
      args.push("--speaker", process.env.PIPER_SPEAKER);
    }
    if (process.env.PIPER_LENGTH_SCALE) {
      args.push("--length_scale", process.env.PIPER_LENGTH_SCALE);
    }

    await runLocalCommand(piperBin, args, { stdin: cleanText, timeoutMs });
    const audio = await fs.readFile(outputPath);
    return { audio, mimeType: "audio/wav" };
  } finally {
    await removeTempDir(tempDir);
  }
}

function extensionForMimeType(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("wav")) return ".wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return ".mp3";
  if (normalized.includes("ogg")) return ".ogg";
  if (normalized.includes("mp4")) return ".m4a";
  if (normalized.includes("webm")) return ".webm";
  return ".audio";
}

async function convertToWhisperWav(inputPath, outputPath) {
  const ffmpegBin = resolveConfiguredPath(readPlatformEnv("FFMPEG_BIN", "ffmpeg"));
  const timeoutMs = readPositiveNumber("FFMPEG_TIMEOUT_SECONDS", 30) * 1000;
  const silenceFilter = process.env.WHISPER_SILENCE_FILTER ||
    "silenceremove=start_periods=1:start_duration=0.15:start_threshold=-45dB:stop_periods=1:stop_duration=0.25:stop_threshold=-45dB";
  const args = [
    "-y",
    "-i",
    inputPath,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
  ];

  if (readBooleanEnv("WHISPER_TRIM_SILENCE", true) && silenceFilter.trim()) {
    args.push("-af", silenceFilter);
  }

  args.push(outputPath);

  await runLocalCommand(ffmpegBin, args, { timeoutMs });
  return outputPath;
}

async function isWavFile(inputPath) {
  let handle;
  try {
    handle = await fs.open(inputPath, "r");
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return (
      bytesRead === header.length &&
      header.subarray(0, 4).toString("ascii") === "RIFF" &&
      header.subarray(8, 12).toString("ascii") === "WAVE"
    );
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function maybePrepareAudioForWhisper(inputPath, tempDir, mimeType) {
  const isWavInput = String(mimeType || "").toLowerCase().includes("wav") || await isWavFile(inputPath);
  if (isWavInput && !readBooleanEnv("WHISPER_TRIM_SILENCE", true)) {
    return inputPath;
  }

  const wavPath = path.join(tempDir, "answer.wav");
  try {
    return await convertToWhisperWav(inputPath, wavPath);
  } catch (err) {
    console.warn(
      `[Voice] ffmpeg conversion/trim unavailable; passing original audio to Whisper. ${err.message}`
    );
    return inputPath;
  }
}

function normalizeTranscript(text) {
  let normalized = String(text || "")
    .replace(/\[[^\]]*-->\s*[^\]]*\]/g, " ")
    .replace(/\[(?:inaudible|music|noise|silence|applause|laughter)[^\]]*\]/gi, " ")
    .replace(/\((?:sing(?:s|ing)? in foreign language|inaudible|music|noise|silence|applause|laughter)[^)]*\)/gi, " ")
    .replace(/\b(?:sing(?:s|ing)? in foreign language|inaudible)\b/gi, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const repeatedNonSpeech = /^(?:\W*(?:inaudible|music|noise|silence)\W*)+$/i;
  if (repeatedNonSpeech.test(normalized)) {
    normalized = "";
  }

  return normalized;
}

function hasConsecutiveRepeatedWords(words, minRepeats = 4) {
  let previous = "";
  let runLength = 0;

  for (const word of words) {
    if (word === previous) {
      runLength += 1;
    } else {
      previous = word;
      runLength = 1;
    }

    if (runLength >= minRepeats) return true;
  }

  return false;
}

function hasConsecutiveRepeatedPhrase(words, phraseSize, minRepeats) {
  if (words.length < phraseSize * minRepeats) return false;

  for (let index = 0; index <= words.length - phraseSize * minRepeats; index += 1) {
    const phrase = words.slice(index, index + phraseSize).join(" ");
    let repeats = 1;

    for (let next = index + phraseSize; next <= words.length - phraseSize; next += phraseSize) {
      const candidate = words.slice(next, next + phraseSize).join(" ");
      if (candidate !== phrase) break;
      repeats += 1;
      if (repeats >= minRepeats) return true;
    }
  }

  return false;
}

function buildWhisperInitialPrompt(promptContext) {
  const configuredPrompt = String(process.env.WHISPER_INITIAL_PROMPT || "").trim();
  const defaultPrompt =
    "Java programming interview answer. Common words: Java, method, function, parameter, argument, variable, value, copy, pass by value, pass by reference, primitive, object, array, class, loop, return, number, integer, string, boolean, constructor, inheritance.";
  const contextText = String(promptContext || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  const expectedTerms = extractExpectedTechnicalTerms(promptContext);
  const prompt = [
    contextText ? `Question context: ${contextText}` : "",
    expectedTerms.length > 0 ? `Expected Java terms: ${expectedTerms.join(", ")}.` : "",
    configuredPrompt || defaultPrompt,
  ]
    .filter(Boolean)
    .join(" ");

  return prompt.slice(0, readPositiveNumber("WHISPER_INITIAL_PROMPT_MAX_CHARS", 900));
}

function hasWhisperInitialPrompt(promptContext) {
  return Boolean(
    String(process.env.WHISPER_INITIAL_PROMPT || "").trim() ||
      String(promptContext || "").trim()
  );
}

function extractExpectedTechnicalTerms(promptContext) {
  const context = String(promptContext || "").toLowerCase();
  if (!context) return [];

  const termChecks = [
    ["arraylist", /\barray\s*list\b|\barraylist\b/],
    ["array", /\barray\b|\barrays\b/],
    ["method", /\bmethod\b|\bmethods\b/],
    ["variable", /\bvariable\b|\bvariables\b/],
    ["number", /\bnumber\b|\bnumbers\b|\binteger\b|\bint\b/],
    ["copy", /\bcopy\b|\bcopies\b|\bcopied\b/],
    ["value", /\bvalue\b|\bvalues\b|\bpass by value\b/],
    ["reference", /\breference\b|\breferences\b/],
    ["object", /\bobject\b|\bobjects\b/],
    ["primitive", /\bprimitive\b|\bprimitives\b/],
    ["size", /\bsize\b|\blength\b|\bgrow\b|\bresize\b/],
    ["fixed size", /\bfixed\s+size\b|\bcannot\s+change\s+(?:its\s+)?size\b/],
    ["dynamic size", /\bchange\s+(?:its\s+)?size\b|\bdynamic\s+size\b|\bgrow\b|\bshrink\b/],
  ];

  return termChecks
    .filter(([, pattern]) => pattern.test(context))
    .map(([term]) => term);
}

function normalizeAsrWord(word) {
  const normalized = String(word || "").toLowerCase();
  if (normalized === "arrays") return "array";
  if (normalized === "arraylists" || normalized === "arraylist") return "arraylist";
  if (normalized === "methods") return "method";
  if (normalized === "variables") return "variable";
  if (normalized === "values") return "value";
  if (normalized === "references") return "reference";
  if (normalized === "objects") return "object";
  if (normalized === "primitives") return "primitive";
  if (normalized === "copies" || normalized === "copied") return "copy";
  if (normalized === "integers") return "integer";
  return normalized;
}

function countExpectedTermHits(words, expectedTerms) {
  if (!Array.isArray(expectedTerms) || expectedTerms.length === 0) return 0;

  const wordSet = new Set(words.map(normalizeAsrWord));
  let hits = 0;

  for (const term of expectedTerms) {
    if (term === "fixed size" || term === "dynamic size") {
      if (wordSet.has("size") || wordSet.has("length") || wordSet.has("grow")) hits += 1;
      continue;
    }

    if (wordSet.has(term)) hits += 1;
  }

  return hits;
}

function detectTranscriptWarnings(
  text,
  { speechSeconds = null, audioAnalysis = null, promptContext = "" } = {}
) {
  const normalized = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const warnings = [];
  const fillerWords = new Set([
    "a",
    "an",
    "and",
    "ah",
    "er",
    "hmm",
    "i",
    "no",
    "ok",
    "okay",
    "please",
    "sir",
    "so",
    "the",
    "thank",
    "thanks",
    "uh",
    "um",
    "yeah",
    "yep",
    "you",
  ]);
  const discourseWords = new Set([
    ...fillerWords,
    "again",
    "but",
    "can",
    "in",
    "is",
    "it",
    "its",
    "not",
    "of",
    "or",
    "sort",
    "that",
    "this",
  ]);
  const knownHallucinationPatterns = [
    /\bi am just a stupid friend\b/i,
    /\breally(?:,?\s+really){2,}\b/i,
    /\bit is coming to you\b/i,
    /\bin the middle of the room\b/i,
    /\bword to the mind\b/i,
    /\bmind in the spirit\b/i,
    /\bspirit of the body\b/i,
    /\bthey(?:'re| are) very rich\b/i,
    /\blittle bit down the wall\b/i,
    /\bpolynomial of wisdom\b/i,
    /\bcome to the city to why\b/i,
    /\bsevere performance to tradition\b/i,
    /\breturn product from the dead\b/i,
    /\balign and roll ex wall\b/i,
    /\bspread everywhere\b/i,
    /\bconditioner incurred\b/i,
  ];
  const genericMediaPatterns = [
    /\bthanks?\s+for\s+(?:watching|listening)\b/i,
    /\bplease\s+(?:like|share|subscribe)\b/i,
    /\blike\s*,?\s+share\s*,?\s+and\s+subscribe\b/i,
    /\bdon't forget to subscribe\b/i,
    /\bsubscribe to (?:the )?channel\b/i,
    /\bsee you (?:again|later|next time|soon)\b/i,
    /\bwelcome back\b/i,
    /\bthis video\b/i,
    /\bsubtitles?\s+by\b/i,
    /\btranscribed by\b/i,
    /\bcaptions?\s+by\b/i,
  ];

  if (knownHallucinationPatterns.some((pattern) => pattern.test(normalized))) {
    warnings.push("known_nonsense_hallucination");
  }

  if (genericMediaPatterns.some((pattern) => pattern.test(normalized))) {
    warnings.push("generic_media_hallucination");
  }

  const words = normalized
    .replace(/[^a-z0-9+#\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const meaningfulWords = words.filter((word) => !fillerWords.has(word));
  const technicalWords = new Set([
    "abstract",
    "argument",
    "array",
    "arraylist",
    "boolean",
    "class",
    "code",
    "copy",
    "constructor",
    "data",
    "double",
    "function",
    "inheritance",
    "int",
    "integer",
    "java",
    "loop",
    "method",
    "number",
    "object",
    "parameter",
    "passes",
    "passing",
    "primitive",
    "regular",
    "reference",
    "return",
    "size",
    "string",
    "value",
    "variable",
  ]);
  const abstractNonsenseWords = new Set([
    "body",
    "city",
    "dead",
    "mind",
    "room",
    "spirit",
    "tradition",
    "wall",
    "wisdom",
  ]);
  const technicalWordCount = words.filter((word) => technicalWords.has(word)).length;
  const abstractNonsenseWordCount = words.filter((word) => abstractNonsenseWords.has(word)).length;
  const discourseWordCount = words.filter((word) => discourseWords.has(word)).length;
  const discourseRatio = words.length > 0 ? discourseWordCount / words.length : 0;
  const expectedTerms = extractExpectedTechnicalTerms(promptContext);
  const expectedTermHits = countExpectedTermHits(words, expectedTerms);

  if (words.length <= 2 || (words.length <= 4 && meaningfulWords.length === 0)) {
    warnings.push("answer_too_short");
  }

  if (words.length >= 8 && technicalWordCount <= 1 && discourseRatio >= 0.5) {
    warnings.push("filler_heavy_transcript");
  }

  if (
    expectedTerms.length >= 2 &&
    expectedTermHits === 0 &&
    words.length >= 7 &&
    (technicalWordCount <= 1 || discourseRatio >= 0.42)
  ) {
    warnings.push("missing_expected_keywords");
  }

  if (
    words.length >= 8 &&
    technicalWordCount === 0 &&
    abstractNonsenseWordCount >= 2
  ) {
    warnings.push("abstract_nonsense_hallucination");
  }

  if (hasConsecutiveRepeatedWords(words, 4) || hasConsecutiveRepeatedPhrase(words, 2, 3)) {
    warnings.push("repeated_word_transcript");
  }

  if (Number.isFinite(speechSeconds)) {
    const wordsPerSecond = speechSeconds > 0 ? words.length / speechSeconds : 0;
    const maxWordsPerSecond = readPositiveNumber("ASR_MAX_WORDS_PER_SECOND", 4.5);
    const shortClipSeconds = readPositiveNumber("ASR_SHORT_CLIP_SECONDS", 3);
    const maxShortClipWordsPerSecond = readPositiveNumber(
      "ASR_SHORT_CLIP_MAX_WORDS_PER_SECOND",
      3.8
    );

    if (speechSeconds < 2 && words.length >= 12) {
      warnings.push("transcript_too_long_for_duration");
    } else if (speechSeconds > 0 && wordsPerSecond > maxWordsPerSecond) {
      warnings.push("transcript_too_long_for_duration");
    }

    if (
      speechSeconds > 0 &&
      speechSeconds < shortClipSeconds &&
      wordsPerSecond > maxShortClipWordsPerSecond
    ) {
      warnings.push("possible_asr_hallucination");
    }
  }

  if (
    audioAnalysis &&
    Number.isFinite(audioAnalysis.active_speech_seconds) &&
    audioAnalysis.active_speech_seconds <
      readPositiveNumber("ASR_MIN_CLEAR_ACTIVE_SPEECH_SECONDS", 1.2) &&
    words.length >= 8
  ) {
    warnings.push("possible_asr_hallucination");
  }

  if (words.length >= 12) {
    const counts = new Map();
    for (let index = 0; index <= words.length - 3; index += 1) {
      const phrase = words.slice(index, index + 3).join(" ");
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }

    if ([...counts.values()].some((count) => count >= 3)) {
      warnings.push("repeated_phrase_transcript");
    }
  }

  return [...new Set(warnings)];
}

function getWavPcmInfo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) return null;
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF") return null;
  if (buffer.subarray(8, 12).toString("ascii") !== "WAVE") return null;

  let format = null;
  let data = null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === "fmt " && offset + 8 + chunkSize <= buffer.length) {
      format = {
        audioFormat: buffer.readUInt16LE(offset + 8),
        channels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        byteRate: buffer.readUInt32LE(offset + 16),
        blockAlign: buffer.readUInt16LE(offset + 20),
        bitsPerSample: buffer.readUInt16LE(offset + 22),
      };
    } else if (chunkId === "data") {
      data = {
        offset: offset + 8,
        size: Math.min(chunkSize, buffer.length - (offset + 8)),
      };
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!format || !data || !Number.isFinite(format.byteRate) || format.byteRate <= 0) {
    return null;
  }

  return { ...format, dataOffset: data.offset, dataSize: data.size };
}

function estimateWavDurationSeconds(buffer) {
  const info = getWavPcmInfo(buffer);
  if (!info) return null;

  return Math.round((info.dataSize / info.byteRate) * 100) / 100;
}

function analyzeWavAudio(buffer) {
  const info = getWavPcmInfo(buffer);
  if (
    !info ||
    info.audioFormat !== 1 ||
    info.bitsPerSample !== 16 ||
    info.channels < 1 ||
    info.blockAlign <= 0 ||
    info.sampleRate <= 0
  ) {
    return null;
  }

  const frameMs = readPositiveNumber("ASR_VAD_FRAME_MS", 20);
  const frameSamples = Math.max(1, Math.round((info.sampleRate * frameMs) / 1000));
  const frameThreshold = readPositiveNumber("ASR_VAD_FRAME_RMS_THRESHOLD", 0.01);
  const sampleCount = Math.floor(info.dataSize / info.blockAlign);
  let totalSquares = 0;
  let peak = 0;
  let frameSquares = 0;
  let samplesInFrame = 0;
  let totalFrames = 0;
  let voicedFrames = 0;

  const flushFrame = () => {
    if (samplesInFrame === 0) return;
    const frameRms = Math.sqrt(frameSquares / samplesInFrame);
    totalFrames += 1;
    if (frameRms >= frameThreshold) voicedFrames += 1;
    frameSquares = 0;
    samplesInFrame = 0;
  };

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const baseOffset = info.dataOffset + sampleIndex * info.blockAlign;
    let mixedSample = 0;

    for (let channel = 0; channel < info.channels; channel += 1) {
      const sampleOffset = baseOffset + channel * 2;
      if (sampleOffset + 2 > buffer.length) break;
      mixedSample += buffer.readInt16LE(sampleOffset) / 32768;
    }

    mixedSample /= info.channels;
    const absolute = Math.abs(mixedSample);
    peak = Math.max(peak, absolute);
    totalSquares += mixedSample * mixedSample;
    frameSquares += mixedSample * mixedSample;
    samplesInFrame += 1;

    if (samplesInFrame >= frameSamples) {
      flushFrame();
    }
  }

  flushFrame();

  const durationSeconds = sampleCount / info.sampleRate;
  const rms = sampleCount > 0 ? Math.sqrt(totalSquares / sampleCount) : 0;
  const voicedRatio = totalFrames > 0 ? voicedFrames / totalFrames : 0;
  const activeSpeechSeconds = voicedFrames * (frameMs / 1000);

  return {
    duration_seconds: Math.round(durationSeconds * 100) / 100,
    rms: Math.round(rms * 100000) / 100000,
    peak: Math.round(peak * 100000) / 100000,
    voiced_ratio: Math.round(voicedRatio * 1000) / 1000,
    active_speech_seconds: Math.round(activeSpeechSeconds * 100) / 100,
  };
}

function detectAudioPreflightWarnings({ speechSeconds, audioAnalysis }) {
  const warnings = [];
  const minAudioSeconds = readPositiveNumber("ASR_MIN_AUDIO_SECONDS", 1.8);
  const minActiveSpeechSeconds = readPositiveNumber("ASR_MIN_ACTIVE_SPEECH_SECONDS", 0.9);
  const minVoicedRatio = readPositiveNumber("ASR_MIN_VOICED_RATIO", 0.1);
  const minRms = readPositiveNumber("ASR_MIN_RMS", 0.004);
  const minPeak = readPositiveNumber("ASR_MIN_PEAK", 0.025);
  const lowRms = readPositiveNumber("ASR_LOW_RMS", 0.008);
  const lowVoicedRatio = readPositiveNumber("ASR_LOW_VOICED_RATIO", 0.18);

  if (Number.isFinite(speechSeconds) && speechSeconds < minAudioSeconds) {
    warnings.push("speech_too_short");
  }

  if (!audioAnalysis) return warnings;

  if (audioAnalysis.peak < minPeak || audioAnalysis.rms < minRms) {
    warnings.push("no_voiced_speech");
  } else if (
    audioAnalysis.active_speech_seconds < minActiveSpeechSeconds ||
    audioAnalysis.voiced_ratio < minVoicedRatio
  ) {
    warnings.push("mostly_silence");
  } else if (audioAnalysis.rms < lowRms || audioAnalysis.voiced_ratio < lowVoicedRatio) {
    warnings.push("low_voiced_energy");
  }

  return [...new Set(warnings)];
}

async function readFirstTranscriptFile(tempDir, preferredPath) {
  if (preferredPath) {
    try {
      return await fs.readFile(preferredPath, "utf8");
    } catch {
      // Fall through to directory scan.
    }
  }

  const entries = await fs.readdir(tempDir);
  const transcriptFile = entries.find((entry) => entry.toLowerCase().endsWith(".txt"));
  if (!transcriptFile) {
    throw new VoiceServiceError("Whisper did not produce a transcript file.", {
      code: "WHISPER_NO_TRANSCRIPT",
    });
  }

  return fs.readFile(path.join(tempDir, transcriptFile), "utf8");
}

async function transcribeWithWhisperCpp({ inputPath, tempDir, promptContext }) {
  const whisperBin = requireConfig(
    readPlatformEnv("WHISPER_BIN"),
    "WHISPER_NOT_CONFIGURED",
    "Local Whisper is not configured. Set WHISPER_BIN and WHISPER_MODEL."
  );
  const whisperModel = requireConfig(
    readPlatformEnv("WHISPER_MODEL"),
    "WHISPER_NOT_CONFIGURED",
    "Local Whisper is not configured. Set WHISPER_BIN and WHISPER_MODEL."
  );
  const outputBase = path.join(tempDir, "transcript");
  const language = process.env.WHISPER_LANGUAGE || "en";
  const timeoutMs = readPositiveNumber("WHISPER_TIMEOUT_SECONDS", 90) * 1000;
  const extraArgs = splitArgs(process.env.WHISPER_EXTRA_ARGS);
  const promptArgs =
    readBooleanEnv("WHISPER_USE_INITIAL_PROMPT", true) &&
    hasWhisperInitialPrompt(promptContext) &&
    !hasAnyCliArg(extraArgs, ["--prompt", "-p"])
      ? ["--prompt", buildWhisperInitialPrompt(promptContext)]
      : [];
  const guardArgs = [];
  if (
    !readBooleanEnv("WHISPER_CONDITION_ON_PREVIOUS_TEXT", false) &&
    !hasCliArg(extraArgs, "-mc", "--max-context")
  ) {
    guardArgs.push("-mc", "0");
  }
  const baseArgs = [
    ...extraArgs,
    ...promptArgs,
    ...guardArgs,
    "-m",
    whisperModel,
    "-f",
    inputPath,
    "-l",
    language,
    "-otxt",
    "-of",
    outputBase,
  ];

  if (process.env.WHISPER_THREADS) {
    baseArgs.push("-t", process.env.WHISPER_THREADS);
  }

  try {
    await runLocalCommand(whisperBin, baseArgs, { timeoutMs });
  } catch (firstErr) {
    const retryArgs = [
      ...extraArgs,
      ...promptArgs,
      ...guardArgs,
      "--model",
      whisperModel,
      "--file",
      inputPath,
      "--language",
      language,
      "--output-txt",
      "--output-file",
      outputBase,
    ];

    if (process.env.WHISPER_THREADS) {
      retryArgs.push("--threads", process.env.WHISPER_THREADS);
    }

    try {
      await runLocalCommand(whisperBin, retryArgs, { timeoutMs });
    } catch (retryErr) {
      if (promptArgs.length > 0) {
        const noPromptRetryArgs = retryArgs.filter((arg) => !promptArgs.includes(arg));
        try {
          await runLocalCommand(whisperBin, noPromptRetryArgs, { timeoutMs });
          return readFirstTranscriptFile(tempDir, `${outputBase}.txt`);
        } catch {
          // Continue to the existing no-guard fallback below.
        }
      }

      if (guardArgs.length > 0) {
        const noGuardRetryArgs = retryArgs.filter(
          (arg) => !guardArgs.includes(arg) && !promptArgs.includes(arg)
        );
        try {
          await runLocalCommand(whisperBin, noGuardRetryArgs, { timeoutMs });
        } catch (finalErr) {
          finalErr.details = finalErr.details || retryErr.details || firstErr.details;
          throw finalErr;
        }
      } else {
        retryErr.details = retryErr.details || firstErr.details;
        throw retryErr;
      }
    }
  }

  return readFirstTranscriptFile(tempDir, `${outputBase}.txt`);
}

async function transcribeWithOpenAiWhisperCli({ inputPath, tempDir, promptContext }) {
  const whisperBin = resolveConfiguredPath(readPlatformEnv("WHISPER_BIN", "whisper"));
  const model = resolveConfiguredPath(readPlatformEnv("WHISPER_MODEL", "base"));
  const language = process.env.WHISPER_LANGUAGE || "en";
  const timeoutMs = readPositiveNumber("WHISPER_TIMEOUT_SECONDS", 120) * 1000;
  const extraArgs = splitArgs(process.env.WHISPER_EXTRA_ARGS);
  const promptArgs =
    readBooleanEnv("WHISPER_USE_INITIAL_PROMPT", true) &&
    hasWhisperInitialPrompt(promptContext) &&
    !hasCliArg(extraArgs, "--initial_prompt")
      ? ["--initial_prompt", buildWhisperInitialPrompt(promptContext)]
      : [];
  const guardArgs = [];

  if (
    !readBooleanEnv("WHISPER_CONDITION_ON_PREVIOUS_TEXT", false) &&
    !hasCliArg(extraArgs, "--condition_on_previous_text")
  ) {
    guardArgs.push("--condition_on_previous_text", "False");
  }
  if (!hasCliArg(extraArgs, "--beam_size")) {
    guardArgs.push("--beam_size", String(readPositiveNumber("WHISPER_BEAM_SIZE", 1)));
  }
  if (!hasCliArg(extraArgs, "--temperature")) {
    guardArgs.push("--temperature", String(process.env.WHISPER_TEMPERATURE || "0"));
  }

  const args = [
    inputPath,
    "--model",
    model,
    "--language",
    language,
    "--output_dir",
    tempDir,
    "--output_format",
    "txt",
    ...guardArgs,
    ...promptArgs,
    ...extraArgs,
  ];

  await runLocalCommand(whisperBin, args, { timeoutMs });
  return readFirstTranscriptFile(tempDir);
}

async function transcribeWithFasterWhisper({ inputPath, tempDir, promptContext }) {
  const pythonBin = resolveConfiguredPath(
    readPlatformEnv("WHISPER_PYTHON", process.platform === "win32" ? "python" : "python3")
  );
  const model = readPlatformEnv("WHISPER_MODEL", "base.en");
  const outputPath = path.join(tempDir, "transcript.txt");
  const language = readPlatformEnv("WHISPER_LANGUAGE", "en");
  const timeoutMs = readPositiveNumber("WHISPER_TIMEOUT_SECONDS", 180) * 1000;
  const args = [
    path.join(__dirname, "fasterWhisperTranscribe.py"),
    "--input",
    inputPath,
    "--output",
    outputPath,
    "--model",
    model,
    "--device",
    readPlatformEnv("WHISPER_DEVICE", "cpu"),
    "--compute-type",
    readPlatformEnv("WHISPER_COMPUTE_TYPE", "int8"),
  ];

  if (language) args.push("--language", language);
  if (process.env.WHISPER_THREADS) args.push("--cpu-threads", process.env.WHISPER_THREADS);
  if (readBooleanEnv("WHISPER_USE_INITIAL_PROMPT", true) && hasWhisperInitialPrompt(promptContext)) {
    args.push("--initial-prompt", buildWhisperInitialPrompt(promptContext));
  }

  await runLocalCommand(pythonBin, args, { timeoutMs });
  return fs.readFile(outputPath, "utf8");
}

async function transcribeAudio({ audioBuffer, mimeType, promptContext = "" }) {
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
    throw new VoiceServiceError("Audio data is required for transcription.", {
      code: "WHISPER_EMPTY_AUDIO",
      status: 400,
    });
  }

  const maxBytes = readPositiveNumber("WHISPER_MAX_AUDIO_MB", 25) * 1024 * 1024;
  if (audioBuffer.length > maxBytes) {
    throw new VoiceServiceError("Audio recording is too large.", {
      code: "WHISPER_AUDIO_TOO_LARGE",
      status: 413,
    });
  }

  const engine = String(process.env.WHISPER_ENGINE || "whispercpp").toLowerCase();
  let speechSeconds = estimateWavDurationSeconds(audioBuffer);
  let audioAnalysis = analyzeWavAudio(audioBuffer);
  let tempDir;

  try {
    tempDir = await createTempDir();
    const inputPath = path.join(
      tempDir,
      `answer-${crypto.randomUUID()}${extensionForMimeType(mimeType)}`
    );
    await fs.writeFile(inputPath, audioBuffer);
    const preparedInput = await maybePrepareAudioForWhisper(inputPath, tempDir, mimeType);

    if (!Number.isFinite(speechSeconds) || !audioAnalysis) {
      try {
        const preparedBuffer = await fs.readFile(preparedInput);
        speechSeconds = Number.isFinite(speechSeconds)
          ? speechSeconds
          : estimateWavDurationSeconds(preparedBuffer);
        audioAnalysis = audioAnalysis || analyzeWavAudio(preparedBuffer);
      } catch {
        // Keep original null analysis when prepared audio cannot be read.
      }
    }

    const preflightWarnings = detectAudioPreflightWarnings({
      speechSeconds,
      audioAnalysis,
    });
    const blockingPreflightWarnings = new Set([
      "speech_too_short",
      "no_voiced_speech",
      "mostly_silence",
    ]);

    if (preflightWarnings.some((warning) => blockingPreflightWarnings.has(warning))) {
      return {
        text: "",
        status: "warning",
        engine,
        speech_seconds: Number.isFinite(speechSeconds) ? speechSeconds : null,
        audio_analysis: audioAnalysis,
        warnings: preflightWarnings,
      };
    }

    const rawTranscript =
      engine === "faster-whisper"
        ? await transcribeWithFasterWhisper({ inputPath: preparedInput, tempDir, promptContext })
        : engine === "openai-whisper"
          ? await transcribeWithOpenAiWhisperCli({ inputPath: preparedInput, tempDir, promptContext })
          : await transcribeWithWhisperCpp({ inputPath: preparedInput, tempDir, promptContext });

    const text = normalizeTranscript(rawTranscript);
    const warnings = [
      ...preflightWarnings,
      ...detectTranscriptWarnings(text, { speechSeconds, audioAnalysis, promptContext }),
    ];

    return {
      text,
      status: warnings.length > 0 ? "warning" : "ok",
      engine,
      speech_seconds: Number.isFinite(speechSeconds) ? speechSeconds : null,
      audio_analysis: audioAnalysis,
      warnings: [...new Set(warnings)],
    };
  } finally {
    await removeTempDir(tempDir);
  }
}

module.exports = {
  VoiceServiceError,
  detectTranscriptWarnings,
  estimateWavDurationSeconds,
  getVoiceStatus,
  synthesizeSpeech,
  transcribeAudio,
};
