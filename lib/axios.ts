import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import Cookies from "js-cookie";

// Giả định dùng sonner từ shadcn-ui cho notifications, nếu chưa có bạn import thư viện toast tương ứng
import { toast } from "sonner";

// Các path lưu trữ session
export const configPath = {
  token: "access_token",
  refreshToken: "refresh_token",
  user: "user_info",
};

const URL_API_PROD = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const URL_API_DEV = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Environment = "development" | "production";

const ENV: Record<Environment, { BASE_URL: string; TIMEOUT: number }> = {
  development: {
    BASE_URL: URL_API_DEV,
    TIMEOUT: 30000,
  },
  production: {
    BASE_URL: URL_API_PROD,
    TIMEOUT: 30000,
  },
};

const config = ENV[(process.env.NODE_ENV as Environment) || "development"];

// Khởi tạo axios
const axiosInstance = axios.create({
  baseURL: config.BASE_URL,
  timeout: config.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Hàm lấy lại token mới (refresh token)
const refreshToken = async () => {
  try {
    const refreshTokenValue = Cookies.get(configPath.refreshToken);
    const token = Cookies.get(configPath.token);

    const userDataStr = typeof window !== "undefined" ? localStorage.getItem(configPath.user) : null;
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    const userPk = userData?.user_pk; // Chỉnh sửa theo structure thực tế của user

    if (!refreshTokenValue || !userPk) {
      console.warn("Thiếu refresh token hoặc user PK");
      return null;
    }

    const response = await axios.post(`${config.BASE_URL}/api/User/RefreshToken`, {
      token,
      userPk,
      refreshToken: refreshTokenValue,
    });

    return response.data;
  } catch (error) {
    console.error("Lỗi khi lấy refresh token:", error);
    return null;
  }
};

// Interceptor cho Request
axiosInstance.interceptors.request.use(
  (reqConfig: InternalAxiosRequestConfig) => {
    const token = Cookies.get(configPath.token);
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;

    if (token && reqConfig.headers) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }

    // Nếu cần api key public / private (giống tinvietERP)
    // if ((reqConfig as any).useApiKey && apiKey && reqConfig.headers) {
    //   reqConfig.headers["x-api-key"] = apiKey;
    // }

    return reqConfig;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Xử lý lỗi tập trung
const handleError = (error: any) => {
  const { response } = error;

  if (response) {
    const { status, data } = response;
    const messages: Record<number, { message: string; description: string }> = {
      400: { message: "Lỗi dữ liệu", description: data?.message || "Dữ liệu không hợp lệ" },
      401: { message: "Phiên đăng nhập hết hạn", description: "Vui lòng đăng nhập lại" },
      403: { message: "Không có quyền", description: data?.message || "Bạn không có quyền truy cập" },
      404: { message: "Không tìm thấy", description: data?.message || "Tài nguyên không tồn tại" },
      500: { message: "Lỗi hệ thống", description: data?.message || "Đã có lỗi xảy ra phía máy chủ" },
    };

    if (messages[status]) {
      toast.error(messages[status].message, {
        description: messages[status].description,
      });
      return Promise.reject({
        status,
        message: messages[status].message,
        description: messages[status].description,
      });
    }
  } else {
    // Lỗi mạng hoặc server sập
    toast.error("Lỗi kết nối", {
      description: "Vui lòng kiểm tra lại đường truyền mạng.",
    });
    return Promise.reject({
      status: "network_error",
      message: "Lỗi kết nối",
      description: "Vui lòng kiểm tra lại kết nối mạng",
    });
  }
  return Promise.reject(error);
};

// Interceptor cho Response
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Xử lý riêng cho cấu trúc trả về "F" (Failed) như của tinvietERP
    if (response.data?.Results === "F") {
      const errorMsg = response.data?.ErrorData?.Messages || "Có lỗi xảy ra!";
      
      // Bỏ qua một số mã lỗi oracle nếu cần
      if (!errorMsg.includes("ORA-20009")) {
        toast.error("Lỗi từ hệ thống", { description: errorMsg });
      }

      // Xử lý logout hoặc tải lại nếu token/session server có vấn đề sâu
      if (errorMsg.includes("Object reference not set to an instance of an object")) {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    // Tự động retry refresh token nếu 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newTokens = await refreshToken();

      if (newTokens?.token && newTokens?.refreshToken) {
        Cookies.set(configPath.token, newTokens.token);
        Cookies.set(configPath.refreshToken, newTokens.refreshToken);
        
        // Gọi lại request ban đầu với token mới
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newTokens.token}`;
        }
        return axiosInstance(originalRequest);
      } else {
        // Nếu refresh thất bại -> Logout
        Cookies.remove(configPath.token);
        Cookies.remove(configPath.refreshToken);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }

    return handleError(error);
  }
);

// Wrapper method
const api = {
  get: (endpoint: string, config = {}) => axiosInstance.get(endpoint, config),
  post: (endpoint: string, data?: any, config = {}) => axiosInstance.post(endpoint, data, config),
  put: (endpoint: string, data?: any, config = {}) => axiosInstance.put(endpoint, data, config),
  delete: (endpoint: string, config = {}) => axiosInstance.delete(endpoint, config),
  patch: (endpoint: string, data?: any, config = {}) => axiosInstance.patch(endpoint, data, config),
};

export default api;
