# src/api/middleware

## 概要

このディレクトリには、Elysiaアプリケーションで使用するミドルウェアを配置します。
ミドルウェアは、リクエスト/レスポンスのライフサイクルに介入し、横断的な関心事（エラーハンドリング、認証、ログなど）を処理します。

## ディレクトリ構造

```
src/api/middleware/
├── errorHandler.ts    # グローバルエラーハンドリング
├── auth.ts           # 認証ミドルウェア（未実装）
├── logger.ts         # ロギングミドルウェア（未実装）
└── cors.ts           # CORS設定（未実装）
```

## ファイルの書き方

### 基本構造

Elysiaのミドルウェアは、`new Elysia()`を使用して定義します。

```typescript
import { Elysia } from "elysia";

// ミドルウェアの定義
export const myMiddleware = new Elysia()
  .onBeforeHandle(({ set, request }) => {
    // リクエスト前の処理
  })
  .onAfterHandle(({ response }) => {
    // レスポンス後の処理
  })
  .onError(({ code, error, set }) => {
    // エラー処理
  });
```

### ライフサイクルフック

Elysiaは以下のライフサイクルフックを提供します：

1. **onRequest**: リクエスト受信時（最初）
2. **onParse**: リクエストボディのパース時
3. **onTransform**: データ変換時
4. **onBeforeHandle**: ハンドラー実行前
5. **onAfterHandle**: ハンドラー実行後
6. **onError**: エラー発生時
7. **onResponse**: レスポンス送信時（最後）

## 実装例

### 1. エラーハンドリングミドルウェア

**ファイル**: `errorHandler.ts`

```typescript
import { Elysia } from "elysia";
import { HttpError } from "../../domain/errors/httpErrors";

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
}

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

      default:
        console.error("Unexpected error:", error);
        set.status = 500;
        return {
          error: "InternalServerError",
          message: "An unexpected error occurred",
          statusCode: 500,
        } as ErrorResponse;
    }
  });
```

### 2. 認証ミドルウェア（例）

**ファイル**: `auth.ts`

```typescript
import { Elysia } from "elysia";
import { UnauthorizedError } from "../../domain/errors/httpErrors";

export const authMiddleware = new Elysia()
  .derive(({ headers }) => {
    // Authorizationヘッダーからトークンを取得
    const token = headers.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new UnauthorizedError("No token provided");
    }

    // トークンの検証（例：JWT検証）
    const user = verifyToken(token);

    if (!user) {
      throw new UnauthorizedError("Invalid token");
    }

    // contextにuserを追加
    return { user };
  });

// 使用例（router内で）
export const protectedRouter = new Elysia()
  .use(authMiddleware)
  .get("/profile", ({ user }) => {
    // userはcontextに追加されている
    return { user };
  });
```

### 3. ロギングミドルウェア（例）

**ファイル**: `logger.ts`

```typescript
import { Elysia } from "elysia";

export const logger = new Elysia()
  .onRequest(({ request }) => {
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  })
  .onResponse(({ request, set }) => {
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${request.url} - ${set.status || 200}`
    );
  })
  .onError(({ request, error }) => {
    console.error(
      `[${new Date().toISOString()}] ERROR ${request.method} ${request.url}`,
      error
    );
  });
```

### 4. CORS設定（例）

**ファイル**: `cors.ts`

```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

export const corsMiddleware = new Elysia()
  .use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }));
```

## 使用方法

### 1. グローバルに適用（全エンドポイント）

```typescript
// src/index.ts
import { Elysia } from "elysia";
import { errorHandler } from "./api/middleware/errorHandler";
import { logger } from "./api/middleware/logger";

const app = new Elysia()
  .use(errorHandler)  // グローバルに適用
  .use(logger)        // グローバルに適用
  .get("/", () => "Hello")
  .listen(3000);
```

### 2. 特定のルーターに適用

```typescript
// src/api/public/users/router.ts
import { Elysia } from "elysia";
import { errorHandler } from "../../middleware/errorHandler";

export const userRouter = new Elysia({ prefix: "/users" })
  .use(errorHandler)  // このルーターのみに適用
  .get("/", () => "Users list");
```

### 3. 特定のルートに適用

```typescript
import { authMiddleware } from "../../middleware/auth";

export const userRouter = new Elysia({ prefix: "/users" })
  .get("/", () => "Public endpoint")
  .use(authMiddleware)  // この後のルートにのみ適用
  .get("/profile", ({ user }) => `Hello ${user.name}`)
  .get("/settings", ({ user }) => `Settings for ${user.name}`);
```

## 命名規則

- ファイル名: `camelCase.ts`（例: `errorHandler.ts`, `authMiddleware.ts`）
- エクスポート名: `camelCase`（例: `errorHandler`, `authMiddleware`）
- 目的が明確な名前をつける

## ベストプラクティス

### 1. 単一責任の原則

各ミドルウェアは1つの責務のみを持つようにします。

```typescript
// 良い例：エラーハンドリングのみ
export const errorHandler = new Elysia().onError(...);

// 悪い例：複数の責務
export const middleware = new Elysia()
  .onError(...)
  .onRequest(...)  // ロギング
  .derive(...);    // 認証
```

### 2. 再利用可能な設計

ミドルウェアは複数のルーターで再利用できるように設計します。

```typescript
// 再利用可能
export const errorHandler = new Elysia().onError(...);

// router1, router2, router3で使用可能
```

### 3. エラーは早期に処理

エラーは可能な限り早い段階でキャッチし、適切なレスポンスを返します。

```typescript
export const authMiddleware = new Elysia()
  .derive(({ headers }) => {
    if (!headers.authorization) {
      throw new UnauthorizedError("No token provided");  // 早期リターン
    }
    // ...
  });
```

### 4. TypeScriptの型を活用

contextの型を明示的に定義します。

```typescript
import { Elysia } from "elysia";

interface User {
  id: number;
  name: string;
  email: string;
}

export const authMiddleware = new Elysia()
  .derive(({ headers }): { user: User } => {
    // 型を明示
    const user = verifyToken(headers.authorization);
    return { user };
  });
```

### 5. 環境変数を使用

設定値は環境変数から取得します。

```typescript
export const corsMiddleware = new Elysia()
  .use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  }));
```

## 注意事項

1. **パフォーマンスを考慮**: ミドルウェアは全リクエストで実行されるため、重い処理は避ける
2. **順序が重要**: ミドルウェアの適用順序によって動作が変わる
3. **エラーハンドリング**: ミドルウェア内でエラーが発生した場合の処理を考慮
4. **テスタビリティ**: ミドルウェアは単体でテスト可能にする

## 典型的なミドルウェアの種類

- **エラーハンドリング**: グローバルエラー処理
- **認証/認可**: JWT検証、権限チェック
- **ロギング**: リクエスト/レスポンスのログ
- **CORS**: クロスオリジンリクエスト設定
- **レート制限**: APIレート制限
- **キャッシュ**: レスポンスキャッシュ
- **圧縮**: レスポンス圧縮
- **セキュリティヘッダー**: セキュリティ関連ヘッダーの追加

## 参考リンク

- [Elysia Middleware Documentation](https://elysiajs.com/concept/middleware.html)
- [Elysia Lifecycle](https://elysiajs.com/concept/life-cycle.html)
