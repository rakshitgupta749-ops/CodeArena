import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mic,
  Monitor,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemReadinessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SystemReadinessModal({ open, onOpenChange }: SystemReadinessModalProps) {
  const [testing, setTesting] = useState(false);

  // Microphone state
  const [micLevel, setMicLevel] = useState(0);
  const [micStatus, setMicStatus] = useState<"pending" | "success" | "error">("pending");
  const [micErrorMsg, setMicErrorMsg] = useState("");

  // Streams & Audio Context refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Browser check details
  const [browserInfo, setBrowserInfo] = useState<{
    name: string;
    isSupported: boolean;
    resolution: string;
    webrtc: boolean;
  }>({
    name: "Modern Browser",
    isSupported: true,
    resolution: "1920x1080",
    webrtc: true,
  });

  useEffect(() => {
    if (open) {
      runAllChecks();
    } else {
      stopStreams();
    }
    return () => {
      stopStreams();
    };
  }, [open]);

  const stopStreams = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicLevel(0);
  };

  const detectBrowser = () => {
    const ua = navigator.userAgent;
    let browser = "Chromium Engine";
    let supported = true;

    if (ua.includes("Chrome")) browser = "Google Chrome / Chromium";
    else if (ua.includes("Firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("Edg")) browser = "Microsoft Edge";
    else if (ua.includes("Safari")) browser = "Apple Safari";

    const resolution = `${window.screen.width} x ${window.screen.height}`;
    const webrtc = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    setBrowserInfo({
      name: browser,
      isSupported: supported && webrtc,
      resolution,
      webrtc,
    });
  };

  const testMic = async () => {
    try {
      setMicStatus("pending");
      setMicErrorMsg("");

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicStatus("error");
        setMicErrorMsg("Microphone API is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      // Mic volume analysis
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          if (!mediaStreamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          setMicLevel(normalized);
          animFrameRef.current = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      }

      setMicStatus("success");
    } catch (err: unknown) {
      console.warn("Microphone test error:", err);
      setMicStatus("error");
      setMicErrorMsg("Microphone permission denied or device not found.");
    }
  };

  const runAllChecks = async () => {
    setTesting(true);
    detectBrowser();
    await testMic();
    setTesting(false);
  };

  const isAllReady = browserInfo.isSupported && micStatus === "success";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl w-full max-h-[85vh] overflow-y-auto bg-card border-border shadow-2xl p-6 sm:p-7">
        <DialogHeader className="pr-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  System Readiness Pre-Check
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Verifying browser compatibility and microphone input for assessments.
                </DialogDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={runAllChecks}
              disabled={testing}
              className="gap-1.5 text-xs h-8 shrink-0"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Re-test
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 my-3">
          {/* 1. Browser Compatibility */}
          <div className="p-4 sm:p-5 rounded-xl border border-border/70 bg-muted/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-500" />
                  Browser Compatibility
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px]",
                    browserInfo.isSupported
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  )}
                >
                  {browserInfo.isSupported ? "Compatible" : "Unsupported"}
                </Badge>
              </div>
              <div className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex justify-between items-center gap-4">
                  <span className="shrink-0">Browser:</span>
                  <span className="font-medium text-foreground text-right" title={browserInfo.name}>
                    {browserInfo.name}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="shrink-0">Display Resolution:</span>
                  <span className="font-medium text-foreground">{browserInfo.resolution}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="shrink-0">WebRTC Audio:</span>
                  <span className={cn("font-medium", browserInfo.webrtc ? "text-emerald-500" : "text-destructive")}>
                    {browserInfo.webrtc ? "Supported" : "Not Supported"}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Browser environment verified.</span>
            </div>
          </div>

          {/* 2. Microphone Input */}
          <div className="p-4 sm:p-5 rounded-xl border border-border/70 bg-muted/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Mic className="w-4 h-4 text-amber-500" />
                  Microphone Input
                </span>
                {micStatus === "success" ? (
                  <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    Detected
                  </Badge>
                ) : micStatus === "error" ? (
                  <Badge variant="outline" className="text-[11px] bg-destructive/10 text-destructive border-destructive/20">
                    Permission Denied
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">
                    Testing...
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Speak into your mic to test audio input levels:
              </p>

              {/* Live audio level bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Input Level:</span>
                  <span className="font-mono">{micLevel}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-secondary/80 overflow-hidden">
                  <div
                    className="h-full transition-all duration-75 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500"
                    style={{ width: `${Math.max(5, micLevel)}%` }}
                  />
                </div>
              </div>

              {micErrorMsg && (
                <div className="mt-2.5">
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{micErrorMsg}</span>
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testMic}
                    className="mt-2 text-xs h-7 w-full"
                  >
                    Allow Microphone
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-4 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-1.5">
              {micStatus === "success" ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Microphone ready for voice viva.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Microphone verification pending.</span>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-3 border-t border-border/40">
          <div className="flex items-center gap-2">
            {isAllReady ? (
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Browser & Mic Ready
              </span>
            ) : (
              <span className="text-xs text-amber-500 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {micStatus === "error"
                  ? "Microphone access required"
                  : "Checking device compatibility..."}
              </span>
            )}
          </div>
          <Button onClick={() => onOpenChange(false)} className="px-6 shrink-0">
            Confirm & Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
