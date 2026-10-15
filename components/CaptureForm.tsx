"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  User,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Download,
  Lock,
  Share2,
  X,
  ImagePlus,
  Lightbulb,
  Loader2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { SiteInfo } from "@/lib/siteConfig";
import { encryptSiteCode } from "@/lib/crypto";

interface CaptureFormProps {
  siteInfo: SiteInfo;
  isEncryptedUrl?: boolean;
}

type Step = "info" | "camera" | "review" | "done";

const STEP_LABELS = ["Thông tin", "Chụp ảnh", "Gửi hồ sơ"];
const MAX_SIDE = 1600; // thu nhỏ ảnh từ điện thoại để gửi nhanh, đỡ tốn dữ liệu

/* ------------------------------------------------------------------ */
/* Tiện ích                                                            */
/* ------------------------------------------------------------------ */

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

function drawToCanvas(src: CanvasImageSource, sw: number, sh: number, mirror: boolean) {
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

function cameraErrorMessage(err: unknown) {
  const name = (err as { name?: string })?.name;
  switch (name) {
    case "NotAllowedError":
      return "Trình duyệt đang chặn camera. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ, cho phép Camera rồi bấm Thử lại.";
    case "NotFoundError":
      return "Không tìm thấy camera trên thiết bị này.";
    case "NotReadableError":
      return "Camera đang được ứng dụng khác sử dụng (Zalo, Zoom, Meet...). Hãy tắt ứng dụng đó rồi bấm Thử lại.";
    case "NotSupportedError":
      return "Trang cần chạy bằng https (hoặc localhost) mới mở được camera trực tiếp.";
    default:
      return "Không mở được camera.";
  }
}

/* ------------------------------------------------------------------ */
/* Component chính                                                     */
/* ------------------------------------------------------------------ */

export default function CaptureForm({ siteInfo, isEncryptedUrl }: CaptureFormProps) {
  const [step, setStep] = useState<Step>("info");

  // Thông tin nhập
  const [fullName, setFullName] = useState("");
  const [idCard, setIdCard] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; idCard?: string }>({});
  const [touched, setTouched] = useState<{ fullName?: boolean; idCard?: boolean }>({});

  // Camera & ảnh
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Gửi hồ sơ
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState("");

  // Chia sẻ link
  const [showShare, setShowShare] = useState(false);
  const [encryptedLink, setEncryptedLink] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const idInputRef = useRef<HTMLInputElement | null>(null);

  /* ---------------- Link mã hóa của đơn vị ---------------- */
  useEffect(() => {
    try {
      const token = encryptSiteCode(siteInfo.code);
      setEncryptedLink(`${window.location.origin}/${token}`);
    } catch {
      setEncryptedLink("");
    }
  }, [siteInfo.code]);

  /* ---------------- Camera ----------------
     Camera chỉ chạy khi đang ở bước "camera". Thẻ <video> luôn có mặt ở bước này,
     nên gắn stream trực tiếp được (khắc phục lỗi khung đen). */
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (step !== "camera") return;

    let cancelled = false;
    setCameraError(null);
    setCameraReady(false);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException("Insecure context", "NotSupportedError");
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (e) {
          const name = (e as { name?: string })?.name;
          if (name === "OverconstrainedError" || name === "NotFoundError") {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else {
            throw e;
          }
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("Lỗi mở camera:", err);
        setCameraError(cameraErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [step, facingMode, retryKey, stopStream]);

  /* ---------------- Kiểm tra dữ liệu nhập ---------------- */
  const validateFullName = (val: string): string | undefined => {
    const t = val.trim();
    if (!t) return "Vui lòng nhập họ và tên";
    if (t.length < 3) return "Họ và tên cần ít nhất 3 ký tự";
    if (!/^[a-zA-ZÀ-ỹ\s]+$/.test(t)) return "Họ và tên chỉ được chứa chữ cái";
    return undefined;
  };

  const validateIdCard = (val: string): string | undefined => {
    const t = val.trim();
    if (!t) return "Vui lòng nhập số CCCD";
    if (!/^(\d{9}|\d{12})$/.test(t)) return "CCCD cần đúng 12 chữ số (hoặc CMND 9 số)";
    return undefined;
  };

  const validateForm = (): boolean => {
    const nameErr = validateFullName(fullName);
    const idErr = validateIdCard(idCard);
    setErrors({ fullName: nameErr, idCard: idErr });
    setTouched({ fullName: true, idCard: true });
    if (nameErr) {
      nameInputRef.current?.focus();
      return false;
    }
    if (idErr) {
      idInputRef.current?.focus();
      return false;
    }
    return true;
  };

  /* ---------------- Điều hướng giữa các bước ---------------- */
  const goCamera = () => {
    if (!validateForm()) return;
    setCapturedImage(null);
    setStep("camera");
  };

  const retake = () => {
    setCapturedImage(null);
    setStep("camera");
  };

  const editInfo = () => {
    // Ảnh có đóng dấu họ tên + CCCD, đổi thông tin thì phải chụp lại
    setCapturedImage(null);
    setStep("info");
  };

  const resetAll = () => {
    setFullName("");
    setIdCard("");
    setErrors({});
    setTouched({});
    setCapturedImage(null);
    setSubmittedAt("");
    setStep("info");
  };

  /* ---------------- Đóng dấu lên ảnh ---------------- */
  const addWatermark = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const bannerHeight = Math.max(50, Math.floor(h * 0.1));

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, h - bannerHeight, w, bannerHeight);
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(0, h - bannerHeight, w, 3);

    const fontSize = Math.max(14, Math.floor(bannerHeight * 0.3));
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";

    const dateStr = new Date().toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    ctx.fillText(
      `ĐƠN VỊ: ${siteInfo.shortName} | HỌ TÊN: ${fullName.trim().toUpperCase()}`,
      16,
      h - bannerHeight * 0.65
    );
    ctx.font = `normal ${Math.max(12, fontSize - 2)}px sans-serif`;
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`CCCD: ${idCard.trim()} | THỜI GIAN: ${dateStr}`, 16, h - bannerHeight * 0.28);
  };

  /* ---------------- Chụp ảnh ---------------- */
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState < 2 || !video.videoWidth) {
      toast.info("Camera đang khởi động, đợi một giây rồi bấm chụp.");
      return;
    }

    const canvas = drawToCanvas(video, video.videoWidth, video.videoHeight, facingMode === "user");
    addWatermark(canvas);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.9));
    setStep("review");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight, false);
      addWatermark(canvas);
      setCapturedImage(canvas.toDataURL("image/jpeg", 0.9));
      URL.revokeObjectURL(url);
      setStep("review");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Không đọc được ảnh này. Vui lòng chọn ảnh khác.");
    };
    img.src = url;
  };

  const openFilePicker = () => fileInputRef.current?.click();

  /* ---------------- Gửi hồ sơ ---------------- */
  const handleSubmit = async () => {
    if (!capturedImage || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const payload = {
        siteCode: siteInfo.code,
        siteShortName: siteInfo.shortName,
        siteFullName: siteInfo.fullName,
        fullName: fullName.trim(),
        idCard: idCard.trim(),
        timestamp: now.toISOString(),
        localTime: now.toLocaleString("vi-VN"),
        imageSizeKb: `${((capturedImage.length * 3) / 4 / 1024).toFixed(1)} KB`,
        imagePreview: `${capturedImage.slice(0, 60)}...`,
        imageFullBase64: capturedImage,
      };

      console.group("[PHOTO] Gửi hồ sơ");
      console.log("Đơn vị:", `[${siteInfo.shortName}] ${siteInfo.fullName} (${siteInfo.code})`);
      console.log("Họ và tên:", payload.fullName);
      console.log("Số CCCD:", payload.idCard);
      console.log("Thời gian:", payload.localTime);
      console.log("Dung lượng ảnh:", payload.imageSizeKb);
      console.groupEnd();

      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setSubmittedAt(payload.localTime);
      setStep("done");
    } catch (err) {
      console.warn("Lỗi gửi hồ sơ:", err);
      toast.error("Chưa gửi được hồ sơ. Kiểm tra kết nối mạng rồi bấm Gửi hồ sơ lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadImage = () => {
    if (!capturedImage) return;
    const a = document.createElement("a");
    a.href = capturedImage;
    a.download = `${siteInfo.code}_${idCard}_${Date.now()}.jpg`;
    a.click();
  };

  /* ---------------- Chia sẻ link ---------------- */
  const handleCopyLink = async () => {
    const ok = await copyText(encryptedLink);
    if (ok) {
      toast.success("Đã sao chép đường dẫn");
      setShowShare(false);
    } else {
      toast.error("Không sao chép được. Hãy bấm giữ vào đường dẫn để chép thủ công.");
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `Chụp ảnh CCCD - ${siteInfo.shortName}`,
        text: `Vui lòng bấm vào đường dẫn để chụp ảnh CCCD (${siteInfo.shortName}):`,
        url: encryptedLink,
      });
    } catch {
      /* người dùng huỷ */
    }
  };

  /* ---------------- Giao diện ---------------- */
  const stepIndex = step === "info" ? 0 : step === "camera" ? 1 : step === "review" ? 2 : 3;
  const inputBase =
    "w-full h-14 pl-12 pr-4 rounded-2xl border bg-white dark:bg-zinc-900 text-base font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none transition focus:ring-4";
  const inputOk =
    "border-zinc-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-blue-500/20";
  const inputBad = "border-rose-500 focus:ring-rose-500/20";
  const bottomBar =
    "fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]";
  const secondaryBtn =
    "inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-5 text-base font-semibold text-zinc-700 dark:text-zinc-200 active:scale-[0.98] transition";
  const primaryBtn = `inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold shadow-md active:scale-[0.98] transition disabled:opacity-60 ${siteInfo.themeColor.primary}`;

  return (
    <div className="flex flex-1 flex-col">
      {/* input file dùng chung cho nút "Chọn ảnh / máy ảnh điện thoại" */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* ============ Thanh tiêu đề của app ============ */}
      <header
        className={`sticky top-0 z-20 bg-gradient-to-br ${siteInfo.themeColor.gradient} px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold backdrop-blur">
                {siteInfo.shortName}
              </span>
              {isEncryptedUrl && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-0.5 text-xs font-medium">
                  <Lock className="h-3 w-3" />
                  Link bảo mật
                </span>
              )}
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold leading-tight">{siteInfo.fullName}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/85">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{siteInfo.subtitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowShare(true)}
            aria-label="Chia sẻ đường dẫn của đơn vị này"
            className="shrink-0 rounded-full bg-white/20 p-2.5 backdrop-blur active:scale-95 transition"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {/* Thanh tiến trình */}
        {step !== "done" && (
          <div className="mt-4" aria-label={`Bước ${Math.min(stepIndex + 1, 3)} trên 3`}>
            <div className="flex gap-1.5">
              {STEP_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= stepIndex ? "bg-white" : "bg-white/30"
                  }`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs font-medium text-white/90">
              Bước {Math.min(stepIndex + 1, 3)}/3: {STEP_LABELS[Math.min(stepIndex, 2)]}
            </p>
          </div>
        )}
      </header>

      {/* ============ BƯỚC 1: Thông tin ============ */}
      {step === "info" && (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            goCamera();
          }}
          noValidate
        >
          <div className="flex-1 space-y-5 px-4 pb-32 pt-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Nhập thông tin của bạn
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Điền đúng như trên căn cước công dân.
              </p>
            </div>

            <div>
              <label
                htmlFor="fullName"
                className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200"
              >
                Họ và tên
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  id="fullName"
                  ref={nameInputRef}
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (touched.fullName) {
                      setErrors((p) => ({ ...p, fullName: validateFullName(e.target.value) }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((p) => ({ ...p, fullName: true }));
                    setErrors((p) => ({ ...p, fullName: validateFullName(fullName) }));
                  }}
                  aria-invalid={!!errors.fullName}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className={`${inputBase} ${errors.fullName ? inputBad : inputOk}`}
                />
              </div>
              {touched.fullName && errors.fullName && (
                <p role="alert" className="mt-1.5 flex items-center gap-1 text-sm font-medium text-rose-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errors.fullName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="idCard"
                className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-200"
              >
                Số căn cước công dân (CCCD)
              </label>
              <div className="relative">
                <CreditCard className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  id="idCard"
                  ref={idInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={12}
                  value={idCard}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setIdCard(val);
                    if (touched.idCard) {
                      setErrors((p) => ({ ...p, idCard: validateIdCard(val) }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((p) => ({ ...p, idCard: true }));
                    setErrors((p) => ({ ...p, idCard: validateIdCard(idCard) }));
                  }}
                  aria-invalid={!!errors.idCard}
                  placeholder="12 chữ số"
                  className={`${inputBase} pr-16 tracking-wider ${errors.idCard ? inputBad : inputOk}`}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">
                  {idCard.length}/12
                </span>
              </div>
              {touched.idCard && errors.idCard && (
                <p role="alert" className="mt-1.5 flex items-center gap-1 text-sm font-medium text-rose-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errors.idCard}
                </p>
              )}
            </div>

            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Để ảnh chụp đạt yêu cầu</p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-200/90">
                  Đứng nơi đủ sáng, nhìn thẳng vào camera, không đeo khẩu trang hoặc kính râm.
                </p>
              </div>
            </div>
          </div>

          <div className={bottomBar}>
            <button type="submit" className={`${primaryBtn} w-full`}>
              <Camera className="h-5 w-5" />
              Tiếp tục chụp ảnh
            </button>
          </div>
        </form>
      )}

      {/* ============ BƯỚC 3: Xem lại ============ */}
      {step === "review" && capturedImage && (
        <>
          <div className="flex-1 space-y-4 px-4 pb-36 pt-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Kiểm tra lại trước khi gửi
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Khuôn mặt cần rõ nét, đủ sáng. Nếu chưa tốt, bấm “Chụp lại”.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-zinc-950 shadow-lg ring-1 ring-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage}
                alt="Ảnh vừa chụp"
                className="mx-auto h-auto max-h-[55dvh] w-full object-contain"
              />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Đã đóng dấu {siteInfo.shortName}
              </span>
            </div>

            <dl className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {[
                ["Đơn vị", siteInfo.fullName],
                ["Họ và tên", fullName.trim()],
                ["Số CCCD", idCard],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-right font-semibold text-zinc-900 dark:text-zinc-100">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
              <button
                type="button"
                onClick={editInfo}
                className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-300"
              >
                <Pencil className="h-4 w-4" />
                Sửa thông tin (cần chụp lại ảnh)
              </button>
              <button
                type="button"
                onClick={handleDownloadImage}
                className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300"
              >
                <Download className="h-4 w-4" />
                Lưu ảnh về máy
              </button>
            </div>
          </div>

          <div className={bottomBar}>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={retake}
                disabled={isSubmitting}
                className={`${secondaryBtn} flex-1`}
              >
                <RotateCcw className="h-5 w-5" />
                Chụp lại
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`${primaryBtn} flex-[1.4]`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Gửi hồ sơ
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ============ HOÀN TẤT ============ */}
      {step === "done" && (
        <>
          <div className="flex flex-1 flex-col items-center px-6 pb-32 pt-10 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-950/30">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h2 className="mt-6 text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
              Đã gửi hồ sơ
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              Hồ sơ của bạn đã được gửi tới {siteInfo.fullName}.
            </p>

            <dl className="mt-6 w-full divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white text-left text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {[
                ["Họ và tên", fullName.trim()],
                ["Số CCCD", idCard],
                ["Thời gian gửi", submittedAt],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-right font-semibold text-zinc-900 dark:text-zinc-100">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={bottomBar}>
            <button type="button" onClick={resetAll} className={`${primaryBtn} w-full`}>
              <User className="h-5 w-5" />
              Chụp cho người tiếp theo
            </button>
          </div>
        </>
      )}

      {/* ============ BƯỚC 2: Camera toàn màn hình ============ */}
      {step === "camera" && (
        <div className="fixed inset-0 z-40 mx-auto flex w-full max-w-md flex-col bg-black text-white sm:rounded-[2rem]">
          {/* Thanh trên */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/70 to-transparent">
            <button
              type="button"
              onClick={() => setStep("info")}
              aria-label="Đóng camera"
              className="rounded-full bg-white/20 p-3 backdrop-blur active:scale-95 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-semibold backdrop-blur">
              Căn khuôn mặt vào khung
            </span>
            <button
              type="button"
              onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
              aria-label="Đổi camera trước/sau"
              className="rounded-full bg-white/20 p-3 backdrop-blur active:scale-95 transition"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>

          {/* Khung hình */}
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              onPlaying={() => setCameraReady(true)}
              className={`h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
            />

            {!cameraError && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[55%] w-[68%] rounded-[48%] border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            )}

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Đang mở camera...</p>
                <p className="px-8 text-center text-xs text-white/60">
                  Nếu trình duyệt hỏi, hãy chọn “Cho phép” sử dụng camera.
                </p>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
                <AlertCircle className="h-10 w-10 text-amber-400" />
                <p className="text-sm leading-relaxed">{cameraError}</p>
                <div className="flex w-full flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setRetryKey((k) => k + 1)}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white text-base font-bold text-zinc-900 active:scale-[0.98] transition"
                  >
                    <RefreshCw className="h-5 w-5" />
                    Thử lại
                  </button>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/30 text-base font-semibold active:scale-[0.98] transition"
                  >
                    <ImagePlus className="h-5 w-5" />
                    Chụp bằng máy ảnh điện thoại
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Thanh dưới: nút chụp */}
          {!cameraError && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10">
              <button
                type="button"
                onClick={openFilePicker}
                aria-label="Chọn ảnh hoặc chụp bằng máy ảnh điện thoại"
                className="flex w-16 flex-col items-center gap-1 text-[11px] font-medium text-white/90"
              >
                <span className="rounded-full bg-white/20 p-3 backdrop-blur">
                  <ImagePlus className="h-5 w-5" />
                </span>
                Chọn ảnh
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady}
                aria-label="Chụp ảnh"
                className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10 transition active:scale-90 disabled:opacity-40"
              >
                <span className="h-14 w-14 rounded-full bg-white" />
              </button>

              <span className="w-16" aria-hidden="true" />
            </div>
          )}
        </div>
      )}

      {/* ============ Bảng chia sẻ (bottom sheet) ============ */}
      {showShare && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShare(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="share-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Gửi đường dẫn cho người khác
                </h3>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  Người nhận mở đường dẫn sẽ vào đúng trang chụp ảnh của {siteInfo.shortName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShare(false)}
                aria-label="Đóng"
                className="shrink-0 rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 break-all rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-mono text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              {encryptedLink || "Không tạo được đường dẫn. Vui lòng tải lại trang."}
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!encryptedLink}
                className={`${primaryBtn} w-full`}
              >
                <Share2 className="h-5 w-5" />
                Sao chép đường dẫn
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && encryptedLink && (
                <button type="button" onClick={handleNativeShare} className={`${secondaryBtn} w-full`}>
                  Gửi qua Zalo, tin nhắn…
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}