import { Elysia } from "elysia";
import { HttpError } from "../../src/domain/errors/httpErrors";

/**
 * テスト用のElysiaアプリケーションを作成するヘルパー関数
 * エラーハンドラーなどの共通設定を含む
 *
 * @param prefix - URLプレフィックス（例: "/users"）
 * @returns 設定済みのElysiaインスタンス
 */
export function createTestApp(prefix: string = "") {
  return new Elysia({ prefix })
    // エラーハンドラーを定義
    .onError(({ code, error, set }) => {
      // カスタムHTTPエラーの場合
      if (error instanceof HttpError) {
        set.status = error.statusCode as any;
        return {
          error: error.name,
          message: error.message,
          statusCode: error.statusCode,
          ...(error.details && { details: error.details }),
        };
      }

      // Elysiaの組み込みエラーコード
      switch (code) {
        case "VALIDATION":
          set.status = 422;
          return {
            error: "ValidationError",
            message: "Validation failed",
            statusCode: 422,
            details: error.message,
          };
        case "NOT_FOUND":
          set.status = 404;
          return {
            error: "NotFound",
            message: "Route not found",
            statusCode: 404,
          };
        case "PARSE":
          set.status = 400;
          return {
            error: "ParseError",
            message: "Failed to parse request",
            statusCode: 400,
          };
        case "INTERNAL_SERVER_ERROR":
        case "UNKNOWN":
        default:
          console.error("Unexpected error:", error);
          set.status = 500;
          return {
            error: "InternalServerError",
            message: "An unexpected error occurred",
            statusCode: 500,
          };
      }
    });
}

/**
 * テスト用のレスポンス型（型安全性のため）
 */
export interface TestErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
}
