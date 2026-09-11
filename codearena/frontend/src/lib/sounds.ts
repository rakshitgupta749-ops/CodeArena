import { Howl, Howler } from "howler";

const SOUNDS = {
  "notification/completed": "https://reactsounds.sfo3.cdn.digitaloceanspaces.com/v1/notification/completed.31e527e.mp3",
  "notification/error": "https://reactsounds.sfo3.cdn.digitaloceanspaces.com/v1/notification/error.b92d3c6.mp3",
  "notification/success": "https://reactsounds.sfo3.cdn.digitaloceanspaces.com/v1/notification/success.f38c2ed.mp3",
  "notification/notification": "https://reactsounds.sfo3.cdn.digitaloceanspaces.com/v1/notification/notification.595d086.mp3",
} as const;

type SoundName = keyof typeof SOUNDS;

const howlInstances: Partial<Record<SoundName, Howl>> = {};

export function playSound(name: SoundName): Promise<void> {
  const url = SOUNDS[name];
  if (!url) {
    console.warn(`Sound ${name} not found`);
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let howl = howlInstances[name];
    if (!howl) {
      howl = new Howl({
        src: [url],
        html5: false, // Use Web Audio API instead of HTML5 Audio to avoid pool exhaustion
        onload: () => {
          howl?.play();
          resolve();
        },
        onloaderror: (_id: number, error: unknown) => {
          console.error(`Failed to load sound ${name}:`, error);
          reject(error);
        },
        onplayerror: (_id: number, error: unknown) => {
          console.error(`Failed to play sound ${name}:`, error);
          reject(error);
        },
      });
      howlInstances[name] = howl;
    } else {
      if (howl.state() === "loaded") {
        howl.play();
        resolve();
      } else {
        howl.once("load", () => {
          howl?.play();
          resolve();
        });
        howl.load();
      }
    }
  });
}
export function initAudio(): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const ctx = Howler.ctx;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().then(() => {
          resolve();
        }).catch((err: any) => {
          console.warn("Audio initialization failed:", err);
          resolve();
        });
      } else {
        resolve();
      }
    } catch (error) {
      console.warn("Audio initialization failed:", error);
      resolve();
    }
  });
}
