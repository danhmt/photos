import React, { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import CaptureForm from "@/components/CaptureForm";
import { decryptSiteCode } from "@/lib/crypto";
import { getSiteInfo } from "@/lib/siteConfig";

interface PageProps {
  params: Promise<{
    site: string;
  }>;
}

// Giúp trang chiếm trọn màn hình điện thoại (kể cả tai thỏ) và không bị zoom khi nhập liệu
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#18181b",
};

export function generateStaticParams() {
  return [{ site: "tvs" }, { site: "hpdq" }, { site: "hoainhon" }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const siteCode = decryptSiteCode(resolvedParams.site);
  const siteInfo = getSiteInfo(siteCode);

  return {
    title: `${siteInfo.fullName} - Xác thực & Chụp ảnh`,
    description: `Hệ thống xác thực danh tính và chụp ảnh cho ${siteInfo.fullName} (${siteInfo.shortName})`,
  };
}

async function SiteContent({ params }: PageProps) {
  const resolvedParams = await params;
  const rawParam = resolvedParams.site || "tvs";
  const decryptedCode = decryptSiteCode(rawParam);
  const siteInfo = getSiteInfo(decryptedCode);
  const isEncrypted =
    rawParam.startsWith("enc_") || rawParam.toLowerCase() !== decryptedCode.toLowerCase();

  return <CaptureForm siteInfo={siteInfo} isEncryptedUrl={isEncrypted} />;
}

/** Khung loading có hình dáng giống app để không bị giật khi tải xong */
function AppSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-live="polite">
      <div className="h-40 bg-zinc-300 dark:bg-zinc-800 animate-pulse" />
      <div className="flex-1 space-y-4 p-4">
        <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-14 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-14 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <p className="pt-2 text-center text-sm text-zinc-500">Đang tải dữ liệu đơn vị...</p>
      </div>
    </div>
  );
}

export default function SiteCapturePage({ params }: PageProps) {
  return (
    // Trên điện thoại: tràn màn hình như app. Trên máy tính: hiện trong khung điện thoại ở giữa.
    <div className="min-h-dvh bg-zinc-200 dark:bg-black sm:py-6">
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-clip bg-zinc-50 dark:bg-zinc-950 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:shadow-2xl sm:ring-1 sm:ring-black/10">
        <Suspense fallback={<AppSkeleton />}>
          <SiteContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}