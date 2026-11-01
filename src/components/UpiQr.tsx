import qrcode from "qrcode-generator";
import { useMemo } from "react";

/** A QR code drawn as one SVG path, so it stays sharp at any size and prints well. */
export function UpiQr({ text, size = 200, label }: { text: string; size?: number; label: string }) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let path = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { path, n };
  }, [text]);
  return (
    <svg
      className="pd-qr"
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={path} fill="#0a1026" />
    </svg>
  );
}
