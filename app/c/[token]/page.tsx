import React, { Suspense } from "react";
import { Metadata } from "next";
import CaptureForm from "@/components/CaptureForm";
import { decryptSiteCode } from "@/lib/crypto";
import { getSiteInfo } from "@/lib/siteConfig";

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export function generateStaticParams() {
  return [
    { token: "tvs" },
    { token: "hpdq" },
    { token: "hoainhon" },
  ];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const siteCode = decryptSiteCode(resolvedParams.token);
  const siteInfo = getSiteInfo(siteCode);

  return {
    title: `${siteInfo.fullName} - Xác thực & Chụp ảnh`,
    description: `Hệ thống xác thực danh tính và chụp ảnh cho ${siteInfo.fullName}`,
  };
}

async function TokenContent({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.token || "tvs";
  const decryptedCode = decryptSiteCode(token);
  const siteInfo = getSiteInfo(decryptedCode);

  return <CaptureForm siteInfo={siteInfo} isEncryptedUrl={true} />;
}

export default function EncryptedCapturePage({ params }: PageProps) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 py-6 sm:py-12 flex flex-col justify-center">
      <Suspense
        fallback={
          <div className="w-full max-w-2xl mx-auto p-12 text-center text-sm text-zinc-500 animate-pulse">
            Đang giải mã liên kết và tải dữ liệu...
          </div>
        }
      >
        <TokenContent params={params} />
      </Suspense>
    </main>
  );
}
