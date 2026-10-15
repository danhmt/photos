import api from "./axios";

interface CallProcAPIPayload {
  tsFunction: string;
  tsProcedure?: string;
  tsAction: "SELECT" | "PROCESS" | "INSERT" | string;
  tsParameter?: string;
  tsInParameter?: string;
  tsOutParameter?: string;
  tsDsoType?: string;
  tsObjCurno?: number;
  tsDsoId: string;
  tsRows?: any[];
}

/**
 * Hàm gọi API tổng quát (Core)
 */
export async function callProcAPI({
  tsFunction,
  tsProcedure = "",
  tsAction,
  tsParameter = "",
  tsInParameter = "",
  tsOutParameter = "p_rtn_value",
  tsDsoType = "control",
  tsObjCurno = 1,
  tsDsoId,
  tsRows = [],
}: CallProcAPIPayload) {
  const body = {
    tsFunction,
    tsProcedure,
    tsAction,
    tsParameter,
    tsInParameter,
    tsOutParameter,
    tsDsoType,
    tsObjCurno,
    tsDsoId,
    tsRows,
  };

  try {
    const response = await api.post("/api/Dso/exec", body);
    
    // Ghi log nếu ở chế độ debug
    if (typeof window !== 'undefined' && localStorage.getItem('debugMode') === 'true') {
      console.log(`[CallProcAPI] Action: ${tsAction}`, body);
      console.log(`[CallProcAPI] Response:`, response.data);
    }
    
    return response.data;
  } catch (error) {
    console.error(`Lỗi khi gọi API (${tsAction}):`, error);
    throw error;
  }
}

/**
 * Wrapper: Gọi hành động SELECT
 */
export async function callSelect(payload: Omit<CallProcAPIPayload, "tsAction">) {
  return callProcAPI({
    ...payload,
    tsAction: "SELECT",
  });
}

/**
 * Wrapper: Gọi hành động PROCESS
 */
export async function callProcess(payload: Omit<CallProcAPIPayload, "tsAction">) {
  return callProcAPI({
    ...payload,
    tsAction: "PROCESS",
  });
}

/**
 * Wrapper: Gọi hành động INSERT
 */
export async function callInsert(payload: Omit<CallProcAPIPayload, "tsAction">) {
  return callProcAPI({
    ...payload,
    tsAction: "INSERT",
  });
}



// Lấy danh sách
// const handleGetData = async () => {
//    const response = await callSelect({
//        tsFunction: "STV_HR_SEL_PORTAL_MENU",
//        tsDsoId: "DSO_GET_MENU",
//        tsInParameter: "p_tes_user_pk",
//        tsParameter: "14",
//    });
//    console.log(response);
// }
