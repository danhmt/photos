/**
 * Cấu hình đơn vị và cơ chế lấy động thông tin đơn vị
 */

export interface SiteInfo {
  code: string;
  shortName: string;
  fullName: string;
  subtitle: string;
  themeColor: {
    primary: string;
    badge: string;
    accent: string;
    gradient: string;
    ring: string;
  };
  contactNote?: string;
}

export const KNOWN_SITES: Record<string, SiteInfo> = {
  tvs: {
    code: "tvs",
    shortName: "TVS",
    fullName: "TÍN VIỆT SOFT",
    subtitle: "Cổng xác thực danh tính & Chụp ảnh nhân sự",
    themeColor: {
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
      accent: "text-blue-600 dark:text-blue-400",
      gradient: "from-blue-600 via-indigo-600 to-sky-600",
      ring: "focus:ring-blue-500",
    },
    contactNote: "Hệ thống quản lý định danh Tín Việt Soft",
  },
  hpdq: {
    code: "hpdq",
    shortName: "HPDQ",
    fullName: "HÒA PHÁT DUNG QUẤT",
    subtitle: "Hệ thống đăng ký & Kiểm soát vào cổng",
    themeColor: {
      primary: "bg-orange-600 hover:bg-orange-700 text-white",
      badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
      accent: "text-orange-600 dark:text-orange-400",
      gradient: "from-orange-600 via-amber-600 to-red-600",
      ring: "focus:ring-orange-500",
    },
    contactNote: "Khu liên hợp Gang thép Hòa Phát Dung Quất",
  },
  hoainhon: {
    code: "hoainhon",
    shortName: "HOÀI NHƠN",
    fullName: "CHI NHÁNH HOÀI NHƠN",
    subtitle: "Xác nhận danh tính & Lưu trữ ảnh hồ sơ",
    themeColor: {
      primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      accent: "text-emerald-600 dark:text-emerald-400",
      gradient: "from-emerald-600 via-teal-600 to-green-600",
      ring: "focus:ring-emerald-500",
    },
    contactNote: "Ban quản lý chi nhánh Hoài Nhơn",
  },
};

/**
 * Cơ chế lấy động thông tin đơn vị dựa vào mã
 * Nếu mã nằm trong danh sách định nghĩa sẵn -> lấy thông tin chi tiết
 * Nếu là mã mới hoàn toàn (vd: vinfast, viettel, abc...) -> tự động tạo thông tin động
 */
export function getSiteInfo(rawCode: string): SiteInfo {
  const cleanCode = (rawCode || "tvs").toLowerCase().trim();

  if (KNOWN_SITES[cleanCode]) {
    return KNOWN_SITES[cleanCode];
  }

  // Tự động sinh thông tin động cho bất kỳ mã mới nào
  const upperCode = cleanCode.toUpperCase();
  return {
    code: cleanCode,
    shortName: upperCode,
    fullName: `ĐƠN VỊ ${upperCode}`,
    subtitle: `Hệ thống xác thực & Chụp ảnh ${upperCode}`,
    themeColor: {
      primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
      accent: "text-indigo-600 dark:text-indigo-400",
      gradient: "from-indigo-600 via-purple-600 to-blue-600",
      ring: "focus:ring-indigo-500",
    },
    contactNote: `Cổng xác thực danh tính đơn vị ${upperCode}`,
  };
}
