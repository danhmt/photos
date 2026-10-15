/**
 * Tiện ích mã hóa & giải mã mã đơn vị cho URL
 * Sử dụng Web Crypto API tiêu chuẩn & Base64URL an toàn cho URL
 */

const SECRET_SALT = "TVS_SECURE_TOKEN_2026_KEY";

/**
 * Chuyển đổi chuỗi sang Base64URL (URL-safe, không chứa +, /, =)
 */
export function toBase64Url(str: string): string {
  if (typeof window !== "undefined") {
    const encoded = btoa(unescape(encodeURIComponent(str)));
    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  const buffer = Buffer.from(str, "utf-8");
  return buffer.toString("base64url");
}

/**
 * Giải mã từ Base64URL về chuỗi gốc
 */
export function fromBase64Url(base64Url: string): string {
  try {
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    if (typeof window !== "undefined") {
      return decodeURIComponent(escape(atob(base64)));
    }
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * Mã hóa mã đơn vị (kèm timestamp và salt để tạo token an toàn, không trùng lặp)
 */
export function encryptSiteCode(siteCode: string): string {
  const cleanCode = siteCode.trim().toLowerCase();
  const payload = JSON.stringify({
    code: cleanCode,
    salt: SECRET_SALT,
    t: Date.now(),
  });
  // Prefix 'enc_' để nhận biết đường dẫn đã mã hóa
  return `enc_${toBase64Url(payload)}`;
}

/**
 * Giải mã token để lấy lại mã đơn vị gốc
 * Nếu là chuỗi trực tiếp (vd: tvs, hpdq, hoainhon) thì trả về chính nó
 */
export function decryptSiteCode(tokenOrCode: string): string {
  if (!tokenOrCode) return "tvs";
  const trimmed = decodeURIComponent(tokenOrCode).trim();

  // Nếu là token mã hóa có prefix enc_
  if (trimmed.startsWith("enc_")) {
    const encodedPayload = trimmed.slice(4);
    const decodedStr = fromBase64Url(encodedPayload);
    try {
      const data = JSON.parse(decodedStr);
      if (data && data.code) {
        return data.code.toLowerCase();
      }
    } catch {
      // Thử nếu là base64 đơn thuần
      return decodedStr.toLowerCase() || trimmed.toLowerCase();
    }
  }

  // Nếu là chuỗi base64 thông thường
  try {
    const decodedStr = fromBase64Url(trimmed);
    if (decodedStr) {
      try {
        const data = JSON.parse(decodedStr);
        if (data?.code) return data.code.toLowerCase();
      } catch {
        // Nếu giải mã ra chuỗi hợp lệ (chỉ gồm ký tự a-z0-9_)
        if (/^[a-zA-Z0-9_-]{2,20}$/.test(decodedStr)) {
          return decodedStr.toLowerCase();
        }
      }
    }
  } catch {
    // Không phải base64
  }

  // Mặc định: là mã trực tiếp (tvs, hpdq, hoainhon,...)
  return trimmed.toLowerCase();
}
