import { Elysia } from "elysia";
import { HttpError } from "../../domain/errors/httpErrors";

// エラーレスポンスの型
interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
}

// グローバルエラーハンドリングミドルウェア
export const errorHandler = new Elysia()
  .onError(({ code, error, set }) => {
    // カスタムHTTPエラーの場合
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return {
        error: error.name,
        message: error.message,
        statusCode: error.statusCode,
        ...(error.details && { details: error.details }),
      } as ErrorResponse;
    }

    // Elysiaの組み込みエラーコード
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          error: "ValidationError",
          message: "Validation failed",
          statusCode: 400,
          details: error.message,
        } as ErrorResponse;

      case "NOT_FOUND":
        set.status = 404;
        return {
          error: "NotFound",
          message: "Route not found",
          statusCode: 404,
        } as ErrorResponse;

      case "PARSE":
        set.status = 400;
        return {
          error: "ParseError",
          message: "Failed to parse request",
          statusCode: 400,
        } as ErrorResponse;

      case "INTERNAL_SERVER_ERROR":
      case "UNKNOWN":
      default:
        // 予期しないエラーの場合
        console.error("Unexpected error:", error);
        set.status = 500;
        return {
          error: "InternalServerError",
          message: "An unexpected error occurred",
          statusCode: 500,
        } as ErrorResponse;
    }
  });
