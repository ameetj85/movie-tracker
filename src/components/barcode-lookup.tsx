"use client";

import { AlertTriangleIcon, CameraIcon, Loader2Icon, ScanBarcodeIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UpcLookupResponse } from "@/app/api/upc/route";

export type BarcodeHit = { upc: string; title: string | null; productTitle: string | null; format: string | null };

// The Shape Detection API isn't in TypeScript's DOM lib yet.
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
const getDetector = () => (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
const noopSubscribe = () => () => {};

/**
 * "Add by barcode": type the number under a disc's barcode (or scan it with the
 * camera where the browser has a built-in barcode reader) to look the product up
 * and hand its title/format to the add form. Warns if the barcode is already in
 * the vault.
 */
export function BarcodeLookup({ onFound }: { onFound: (hit: BarcodeHit) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [existing, setExisting] = useState<UpcLookupResponse["existing"]>([]);
  const [scanning, setScanning] = useState(false);
  // Camera scanning needs BarcodeDetector (Chromium on Android/macOS/ChromeOS) and a secure origin.
  const canScan = useSyncExternalStore(
    noopSubscribe,
    () => !!getDetector() && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );

  async function lookup(raw: string) {
    setBusy(true);
    setMessage(null);
    setExisting([]);
    try {
      const res = await fetch(`/api/upc?code=${encodeURIComponent(raw)}`);
      const body = (await res.json()) as Partial<UpcLookupResponse> & { error?: string };
      setExisting(body.existing ?? []);
      if (!res.ok) {
        setMessage(body.error ?? "Lookup failed.");
        // Keep the barcode on the copy even if the online lookup failed.
        if (body.upc) onFound({ upc: body.upc, title: null, productTitle: null, format: null });
        return;
      }
      const data = body as UpcLookupResponse;
      if (!data.product) {
        setMessage("That barcode isn't in the product database. Search by title instead; the barcode is saved on the copy.");
        onFound({ upc: data.upc, title: null, productTitle: null, format: null });
        return;
      }
      setMessage(`Found “${data.product.productTitle}”.`);
      onFound({ upc: data.upc, ...data.product });
    } catch {
      setMessage("Lookup failed. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Not a <form>: this sits inside the movie form, and forms can't nest. */}
      <div className="flex flex-wrap gap-2" role="search" aria-label="Add by barcode">
        <div className="relative min-w-48 flex-1">
          <ScanBarcodeIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-8"
            inputMode="numeric"
            placeholder="Barcode number, e.g. 024543617907"
            aria-label="Barcode number"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              // Enter looks the barcode up instead of submitting the surrounding movie form.
              if (e.key === "Enter") {
                e.preventDefault();
                if (code.trim()) void lookup(code);
              }
            }}
          />
        </div>
        <Button type="button" variant="outline" disabled={busy || !code.trim()} onClick={() => void lookup(code)}>
          {busy && <Loader2Icon className="animate-spin" />}
          Look up
        </Button>
        {canScan && (
          <Button type="button" variant="outline" onClick={() => setScanning(true)} disabled={busy}>
            <CameraIcon />
            Scan
          </Button>
        )}
      </div>
      {scanning && (
        <CameraScanner
          onClose={() => setScanning(false)}
          onDetected={(value) => {
            setScanning(false);
            setCode(value);
            void lookup(value);
          }}
        />
      )}
      {message && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {message}
        </p>
      )}
      {existing.length > 0 && (
        <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400" role="alert">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            This barcode is already in your vault:{" "}
            {existing.map((e, i) => (
              <span key={`${e.movieId}-${i}`}>
                {i > 0 && ", "}
                <Link href={`/movies/${e.movieId}`} target="_blank" className="underline underline-offset-2">
                  {e.title}
                </Link>{" "}
                ({e.format}
                {e.isWishlist ? ", wishlist" : ""})
              </span>
            ))}
          </span>
        </p>
      )}
    </div>
  );
}

/** Live camera preview that reports the first barcode it reads. */
function CameraScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const detected = useRef(onDetected);
  useEffect(() => {
    detected.current = onDetected;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const Detector = getDetector();
    if (!Detector) return;
    const detector = new Detector({ formats: ["ean_13", "upc_a", "ean_8", "upc_e"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            const [hit] = await detector.detect(video.current);
            if (hit?.rawValue) {
              detected.current(hit.rawValue);
              return;
            }
          } catch {
            // A frame that can't be read yet; keep trying.
          }
          timer = window.setTimeout(tick, 200);
        };
        void tick();
      } catch {
        setError("Couldn't open the camera. Allow camera access, or type the number instead.");
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-black shadow-lg shadow-primary/20">
      {error ? (
        <p className="p-4 text-sm text-white">{error}</p>
      ) : (
        <>
          <video ref={video} className="aspect-video w-full object-cover" muted playsInline aria-label="Camera preview" />
          {/* Aiming guide */}
          <div className="pointer-events-none absolute inset-x-[15%] top-1/2 h-20 -translate-y-1/2 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden />
          <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/90">Point the camera at the barcode</p>
        </>
      )}
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        className="absolute top-2 right-2"
        aria-label="Stop scanning"
        onClick={onClose}
      >
        <XIcon />
      </Button>
    </div>
  );
}
