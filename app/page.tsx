"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import {
  Camera,
  Building2,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Share2,
  Download,
  ExternalLink,
  ShieldCheck,
  MessageSquareText,
  History,
  Plus,
  X,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { KNOWN_SITES } from "@/lib/siteConfig";
import { encryptSiteCode } from "@/lib/crypto";

/* ------------------------------------------------------------------ */
/* Tiện ích                                                            */
/* ------------------------------------------------------------------ */

const HISTORY_KEY = "cccd-portal:recent-codes";
const MAX_HISTORY = 5;

type Result = {
  code: string;
  label: string;
  direct: string;
  encrypted: string;
};

/** "Hoài Nhơn " -> "hoainhon" */
function normalizeCode(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const FAQ: [string, string][] = [
  [
    "Đường dẫn bảo mật khác gì đường dẫn thường?",
    "Cả hai dẫn tới cùng một trang chụp ảnh. Đường dẫn bảo mật không để lộ mã đơn vị nên người ngoài khó đoán ra. Hãy ưu tiên dùng loại này.",
  ],
  [
    "Người lao động mở đường dẫn nhưng không chụp được?",
    "Kiểm tra trình duyệt đã được cho phép dùng camera. Nên mở bằng Chrome (Android) hoặc Safari (iPhone). Nếu vẫn lỗi, bấm “Chọn ảnh” để chụp bằng máy ảnh điện thoại.",
  ],
  [
    "Hệ thống kiểm tra CCCD như thế nào?",
    "Trước khi chụp, hệ thống yêu cầu nhập số CCCD gồm đúng 12 chữ số (hoặc CMND 9 số). Nếu sai, bạn sẽ được báo để nhập lại.",
  ],
  [
    "Mã đơn vị của tôi là gì?",
    "Hãy hỏi quản trị viên. Mã thường là tên viết liền, không dấu, ví dụ: tvs, hpdq, hoainhon.",
  ],
];

/* ------------------------------------------------------------------ */
/* Nút sao chép có phản hồi                                            */
/* ------------------------------------------------------------------ */

function CopyButton({
  text,
  label,
  className = "",
  variant = "primary",
}: {
  text: string;
  label: string;
  className?: string;
  variant?: "primary" | "light";
}) {
  const [done, setDone] = useState(false);

  const onClick = async () => {
    const ok = await copyText(text);
    if (!ok) {
      toast.error("Không sao chép được. Hãy bấm giữ vào chữ để chép thủ công.");
      return;
    }
    setDone(true);
    toast.success("Đã sao chép");
    setTimeout(() => setDone(false), 2000);
  };

  const color = done
    ? "bg-emerald-600 text-white"
    : variant === "primary"
    ? "bg-blue-600 text-white"
    : "border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold transition active:scale-[0.98] ${color} ${className}`}
    >
      {done ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
      {done ? "Đã chép" : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Trang chủ                                                           */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const sites = Object.values(KNOWN_SITES);

  const [customCode, setCustomCode] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [showDirect, setShowDirect] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [canShare, setCanShare] = useState(false);

  const qrWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* bỏ qua */
    }
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // Khi bảng kết quả mở: khóa cuộn nền, bấm Esc để đóng
  useEffect(() => {
    if (!result) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setResult(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [result]);

  const saveHistory = (list: string[]) => {
    setHistory(list);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch {
      /* bỏ qua */
    }
  };

  const labelFor = (code: string) =>
    sites.find((s) => s.code === code)?.shortName ?? code.toUpperCase();

  const generate = (rawCode: string) => {
    const code = normalizeCode(rawCode);

    if (!code) {
      setError("Bạn chưa nhập mã đơn vị. Ví dụ: tvs, hpdq, hoainhon.");
      return;
    }
    if (code.length < 2) {
      setError("Mã đơn vị cần ít nhất 2 ký tự.");
      return;
    }

    let token = "";
    try {
      token = encryptSiteCode(code);
    } catch {
      setError("Không tạo được đường dẫn bảo mật. Vui lòng thử lại hoặc báo quản trị viên.");
      return;
    }

    setError("");
    const origin = window.location.origin;
    setResult({
      code,
      label: labelFor(code),
      direct: `${origin}/${code}`,
      encrypted: `${origin}/${token}`,
    });
    setShowDirect(false);
    setShowMessage(false);
    saveHistory([code, ...history.filter((c) => c !== code)].slice(0, MAX_HISTORY));
  };

  const messageFor = (r: Result) =>
    `Chào anh/chị, vui lòng bấm vào đường dẫn dưới đây để chụp ảnh CCCD (${r.label}):\n${r.encrypted}\n\nLưu ý: chuẩn bị CCCD gắn chip bản gốc, chụp ở nơi đủ sáng, không bị chói hay mất góc.`;

  const shareNative = async (r: Result) => {
    try {
      await navigator.share({
        title: `Chụp ảnh CCCD - ${r.label}`,
        text: messageFor(r),
      });
    } catch {
      /* người dùng huỷ */
    }
  };

  const downloadQr = (r: Result) => {
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${r.code}.png`;
    a.click();
  };

  const normalizedPreview = normalizeCode(customCode);
  const previewDiffers = customCode.trim() !== "" && normalizedPreview !== customCode.trim();

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30";

  return (
    // Điện thoại: tràn màn hình như app. Máy tính: nằm trong khung điện thoại ở giữa.
    <div className="min-h-dvh bg-zinc-200 dark:bg-black sm:py-6">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-clip bg-zinc-50 dark:bg-zinc-950 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:shadow-2xl sm:ring-1 sm:ring-black/10">
        {/* ================= Thanh tiêu đề ================= */}
        <header className="sticky top-0 z-20 bg-gradient-to-br from-blue-700 to-blue-600 px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <Camera className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold leading-tight">Chụp ảnh CCCD</h1>
              <p className="text-xs text-white/85">Lấy đường dẫn để gửi cho người cần chụp ảnh</p>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-7 px-4 pb-10 pt-5">
          {/* ================= Cách dùng ================= */}
          <ol className="flex items-start gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            {[
              "Chọn đơn vị",
              "Gửi đường dẫn hoặc mã QR",
              "Người lao động mở và chụp ảnh",
            ].map((t, i) => (
              <li key={t} className="flex flex-1 flex-col items-center gap-1.5 text-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{t}</span>
              </li>
            ))}
          </ol>

          {/* ================= Danh sách đơn vị ================= */}
          <section aria-labelledby="pick-site" className="space-y-3">
            <h2 id="pick-site" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Chọn đơn vị của bạn
            </h2>

            <ul className="space-y-3">
              {sites.map((site) => (
                <li key={site.code}>
                  <button
                    type="button"
                    onClick={() => generate(site.code)}
                    className={`flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 ${focusRing}`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${site.themeColor.badge}`}
                    >
                      <Building2 className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {site.fullName}
                      </span>
                      <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
                        {site.subtitle}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Đơn vị khác */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                generate(customCode);
              }}
              className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-900/60"
            >
              <label
                htmlFor="custom-code"
                className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200"
              >
                <Plus className="h-4 w-4" />
                Đơn vị khác? Nhập mã đơn vị
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="custom-code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  value={customCode}
                  onChange={(e) => {
                    setCustomCode(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Ví dụ: hoainhon"
                  aria-invalid={!!error}
                  aria-describedby="custom-hint"
                  className={`h-14 min-w-0 flex-1 rounded-2xl border bg-white px-4 text-base text-zinc-900 outline-none focus:ring-4 dark:bg-zinc-800 dark:text-zinc-100 ${
                    error
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-zinc-300 focus:border-blue-500 focus:ring-blue-500/20 dark:border-zinc-700"
                  }`}
                />
                <button
                  type="submit"
                  className={`h-14 shrink-0 rounded-2xl bg-blue-600 px-5 text-base font-bold text-white transition active:scale-[0.98] ${focusRing}`}
                >
                  Lấy link
                </button>
              </div>
              <p id="custom-hint" className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {previewDiffers && normalizedPreview ? (
                  <>
                    Hệ thống sẽ dùng mã <strong>{normalizedPreview}</strong> (đã bỏ dấu và khoảng
                    trắng).
                  </>
                ) : (
                  "Chữ không dấu, số và dấu gạch ngang. Không phân biệt hoa, thường."
                )}
              </p>
              {error && (
                <p role="alert" className="mt-2 flex items-center gap-1 text-sm font-medium text-rose-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
            </form>
          </section>

          {/* ================= Gần đây ================= */}
          {history.length > 0 && (
            <section aria-labelledby="recent-title" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2
                  id="recent-title"
                  className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100"
                >
                  <History className="h-4 w-4" />
                  Đã lấy gần đây
                </h2>
                <button
                  type="button"
                  onClick={() => saveHistory([])}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Xóa danh sách
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => generate(code)}
                    className={`h-11 rounded-full border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 ${focusRing}`}
                  >
                    {labelFor(code)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ================= Trợ giúp ================= */}
          <section aria-labelledby="faq-title" className="space-y-3">
            <h2
              id="faq-title"
              className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100"
            >
              <HelpCircle className="h-4 w-4" />
              Cần trợ giúp?
            </h2>
            <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group px-4 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-zinc-900 focus-visible:outline-none focus-visible:underline dark:text-zinc-100">
                    {q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* ================= Bảng kết quả (bottom sheet) ================= */}
        {result && (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setResult(null)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="result-title"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900"
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    id="result-title"
                    className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50"
                  >
                    Đường dẫn {result.label} đã sẵn sàng
                  </h3>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    Gửi đường dẫn hoặc cho quét mã QR bên dưới.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  aria-label="Đóng"
                  className={`shrink-0 rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${focusRing}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* QR */}
              <div className="mt-5 flex flex-col items-center gap-3">
                <div ref={qrWrapRef} className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <QRCodeCanvas value={result.encrypted} size={184} level="M" marginSize={1} />
                </div>
                <button
                  type="button"
                  onClick={() => downloadQr(result)}
                  className={`inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300 ${focusRing} rounded-lg px-2 py-1`}
                >
                  <Download className="h-4 w-4" />
                  Tải mã QR
                </button>
              </div>

              {/* Đường dẫn bảo mật */}
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  Đường dẫn bảo mật (nên dùng)
                </p>
                <div className="break-all rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-mono text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {result.encrypted}
                </div>
              </div>

              {/* Nút hành động chính */}
              <div className="mt-4 flex flex-col gap-3">
                <CopyButton text={result.encrypted} label="Sao chép đường dẫn" className="w-full" />
                {canShare && (
                  <button
                    type="button"
                    onClick={() => shareNative(result)}
                    className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-base font-bold text-white transition active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 ${focusRing}`}
                  >
                    <Share2 className="h-5 w-5" />
                    Gửi qua Zalo, tin nhắn…
                  </button>
                )}
                <Link
                  href={`/${result.code}`}
                  className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white text-base font-semibold text-zinc-700 transition active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 ${focusRing}`}
                >
                  <Camera className="h-5 w-5" />
                  Chụp ảnh ngay trên máy này
                </Link>
              </div>

              {/* Tin nhắn soạn sẵn */}
              <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowMessage((v) => !v)}
                  aria-expanded={showMessage}
                  className="flex w-full items-center justify-between text-sm font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  <span className="flex items-center gap-1.5">
                    <MessageSquareText className="h-4 w-4" />
                    Tin nhắn soạn sẵn
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-500 transition-transform ${showMessage ? "rotate-180" : ""}`}
                  />
                </button>
                {showMessage && (
                  <div className="mt-3 space-y-3">
                    <pre className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-sans text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
                      {messageFor(result)}
                    </pre>
                    <CopyButton
                      text={messageFor(result)}
                      label="Sao chép tin nhắn"
                      variant="light"
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* Đường dẫn thường */}
              <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDirect((v) => !v)}
                  aria-expanded={showDirect}
                  className="flex w-full items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-300"
                >
                  <span className="flex items-center gap-1.5">
                    <ExternalLink className="h-4 w-4" />
                    Đường dẫn thường (không mã hóa)
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-500 transition-transform ${showDirect ? "rotate-180" : ""}`}
                  />
                </button>
                {showDirect && (
                  <div className="mt-3 space-y-3">
                    <div className="break-all rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
                      {result.direct}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Đường dẫn này lộ mã đơn vị. Chỉ dùng khi đường dẫn bảo mật không mở được.
                    </p>
                    <CopyButton
                      text={result.direct}
                      label="Sao chép"
                      variant="light"
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}