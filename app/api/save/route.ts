import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Log chi tiết ra Server Terminal
    console.log("\n=======================================================");
    console.log("📥 [SERVER LOG] ĐÃ NHẬN DỮ LIỆU LƯU THÀNH CÔNG:");
    console.log(`- Đơn vị: [${data.siteCode?.toUpperCase()}] - ${data.siteFullName}`);
    console.log(`- Họ và tên: ${data.fullName}`);
    console.log(`- Số CCCD: ${data.idCard}`);
    console.log(`- Thời gian: ${data.localTime || new Date().toISOString()}`);
    console.log(
      `- Kích thước ảnh: ${data.imagePreview || `${((data.imageFullBase64?.length || 0) / 1024).toFixed(1)} KB`}`
    );
    console.log("=======================================================\n");

    return NextResponse.json({
      success: true,
      message: "Đã lưu dữ liệu thành công",
      timestamp: new Date().toISOString(),
      savedData: {
        siteCode: data.siteCode,
        fullName: data.fullName,
        idCard: data.idCard,
      },
    });
  } catch (error) {
    console.error("❌ [SERVER LOG ERROR]:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi xử lý dữ liệu lưu" },
      { status: 500 }
    );
  }
}
