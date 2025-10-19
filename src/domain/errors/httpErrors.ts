// カスタムHTTPエラークラス
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// 400 Bad Request
export class BadRequestError extends HttpError {
  constructor(message: string = "Bad Request", details?: any) {
    super(400, message, details);
    this.name = "BadRequestError";
  }
}

// 401 Unauthorized
export class UnauthorizedError extends HttpError {
  constructor(message: string = "Unauthorized", details?: any) {
    super(401, message, details);
    this.name = "UnauthorizedError";
  }
}

// 403 Forbidden
export class ForbiddenError extends HttpError {
  constructor(message: string = "Forbidden", details?: any) {
    super(403, message, details);
    this.name = "ForbiddenError";
  }
}

// 404 Not Found
export class NotFoundError extends HttpError {
  constructor(message: string = "Not Found", details?: any) {
    super(404, message, details);
    this.name = "NotFoundError";
  }
}

// 500 Internal Server Error
export class InternalServerError extends HttpError {
  constructor(message: string = "Internal Server Error", details?: any) {
    super(500, message, details);
    this.name = "InternalServerError";
  }
}
