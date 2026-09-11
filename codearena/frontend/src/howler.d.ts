declare module "howler" {
  export interface HowlOptions {
    src: string[];
    html5?: boolean;
    onload?: () => void;
    onloaderror?: (soundId: number, error: unknown) => void;
    onplayerror?: (soundId: number, error: unknown) => void;
  }

  export class Howl {
    constructor(options: HowlOptions);
    load(): void;
    once(event: string, callback: () => void): void;
    play(): number;
    state(): "unloaded" | "loading" | "loaded";
  }

  export const Howler: {
    ctx: AudioContext;
  };
}
