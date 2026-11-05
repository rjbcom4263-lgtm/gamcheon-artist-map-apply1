"use client";

import { useState } from "react";

export default function QrDownload({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    let sourceUrl = "";
    let downloadUrl = "";
    try {
      const response = await fetch(`/api/work-guides/${encodeURIComponent(id)}/qr`);
      if (!response.ok) throw new Error("QR 코드를 불러오지 못했습니다.");
      sourceUrl = URL.createObjectURL(await response.blob());
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("이미지 변환을 지원하지 않는 브라우저입니다.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 1200, 1200);
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, 1200, 1200);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 1));
      if (!blob || blob.type !== "image/webp") throw new Error("WebP 저장을 지원하는 최신 브라우저를 사용해 주세요.");
      downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `artwork-${id}-qr.webp`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "QR 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (downloadUrl) { const url = downloadUrl; window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
      setBusy(false);
    }
  }
  return <><button type="button" disabled={busy} onClick={() => void download()}>{busy ? "QR 준비 중…" : "QR 내려받기 (WebP)"}</button>{error && <span role="alert">{error}</span>}</>;
}
