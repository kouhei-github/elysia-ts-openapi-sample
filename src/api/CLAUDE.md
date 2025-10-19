# src/api

## 概要

このディレクトリには、API層（アプリケーション層 + プレゼンテーション層）を配置します。
HTTPリクエスト/レスポンスの処理、ルーティング、ミドルウェア、ビジネスロジックの実行を担当します。

## ディレクトリ構造

```
src/api/
├── middleware/              # ミドルウェア
│   ├── errorHandler.ts     # エラーハンドリング
│   ├── auth.ts            # 認証
│   └── logger.ts          # ロギング
│
├── public/                 # 認証不要のエンドポイント
│   ├── users/
│   │   ├── requests.ts
│   │   ├── responses.ts
│   │   ├── usecase.ts
│   │   ├── controller.ts
│   │   └── router.ts
│   └── health/
│       └── router.ts
│
├── user/                   # 認証有り（一般ユーザー）のエンドポイント
│   ├── profile/
│   │   ├── requests.ts
│   │   ├── responses.ts
│   │   ├── usecase.ts
│   │   ├── controller.ts
│   │   └── router.ts
│   └── settings/
│       └── router.ts
│
└── admin/                  # 認証有り（管理者）のエンドポイント
    ├── users/
    │   ├── requests.ts
    │   ├── responses.ts
    │   ├── usecase.ts
    │   ├── controller.ts
    │   └── router.ts
    └── system/
        └── router.ts
```

## API のカテゴリ

### 1. public（認証不要）

認証が不要な、誰でもアクセスできるエンドポイント。

**用途**:
- ユーザー登録
- ログイン
- パスワードリセット
- 公開情報の取得
- ヘルスチェック

**例**:
- `POST /public/auth/register`
- `POST /public/auth/login`
- `GET /public/users`
- `GET /public/health`

### 2. user（認証有り・一般ユーザー）

認証済みの一般ユーザーがアクセスできるエンドポイント。

**用途**:
- プロフィール管理
- 設定変更
- 自分のデータの取得・更新
- 一般的なリソース操作

**例**:
- `GET /user/profile`
- `PUT /user/profile`
- `GET /user/orders`
- `POST /user/orders`

### 3. admin（認証有り・管理者）

認証済みの管理者のみがアクセスできるエンドポイント。

**用途**:
- ユーザー管理
- システム設定
- 統計・分析
- 管理操作

**例**:
- `GET /admin/users`
- `DELETE /admin/users/:id`
- `GET /admin/statistics`
- `POST /admin/system/settings`

## ファイル構造

各エンドポイントは、以下の5つのファイルで構成されます。

```
{scope}/{resource}/
├── requests.ts      # リクエストスキーマ定義
├── responses.ts     # レスポンススキーマ定義
├── usecase.ts       # ビジネスロジック
├── controller.ts    # HTTPリクエスト/レスポンス処理
└── router.ts        # ルーティング定義
```

## ファイルの書き方

### 1. requests.ts（リクエストスキーマ）

Elysiaの`t`（Type Box）を使用してリクエストスキーマを定義し、`Infer`で型を推論します。

```typescript
import { t, type Static as Infer } from "elysia";

// POSTリクエストのボディスキーマ
export const CreateUserBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 }),
  role: t.Union([
    t.Literal("admin"),
    t.Literal("user"),
  ]),
});

// パラメータスキーマ
export const UserIdParamSchema = t.Object({
  id: t.Number(),
});

// クエリスキーマ
export const UserListQuerySchema = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 10 })),
  sortBy: t.Optional(t.String({ default: "id" })),
  sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")], { default: "asc" })),
});

// PUTリクエストのボディスキーマ
export const UpdateUserBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: "email" }),
  role: t.Union([
    t.Literal("admin"),
    t.Literal("user"),
  ]),
});

// PATCHリクエストのボディスキーマ（部分更新）
export const PatchUserBodySchema = t.Partial(
  t.Object({
    name: t.String({ minLength: 1, maxLength: 255 }),
    email: t.String({ format: "email" }),
  })
);

// 型推論
export type CreateUserBody = Infer<typeof CreateUserBodySchema>;
export type UserIdParam = Infer<typeof UserIdParamSchema>;
export type UserListQuery = Infer<typeof UserListQuerySchema>;
export type UpdateUserBody = Infer<typeof UpdateUserBodySchema>;
export type PatchUserBody = Infer<typeof PatchUserBodySchema>;
```

### 2. responses.ts（レスポンススキーマ）

```typescript
import { t, type Static as Infer } from "elysia";
import { UserSchema } from "../../../domain/user/entity";

// 単一ユーザーのレスポンス
export const UserResponseSchema = UserSchema;

// ユーザーリストのレスポンス
export const UserListResponseSchema = t.Object({
  data: t.Array(UserSchema),
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
  totalPages: t.Number(),
});

// 作成成功のレスポンス
export const CreateUserResponseSchema = t.Object({
  message: t.String(),
  user: UserSchema,
});

// 削除成功のレスポンス
export const DeleteResponseSchema = t.Void();

// 型推論
export type UserResponse = Infer<typeof UserResponseSchema>;
export type UserListResponse = Infer<typeof UserListResponseSchema>;
export type CreateUserResponse = Infer<typeof CreateUserResponseSchema>;
export type DeleteResponse = Infer<typeof DeleteResponseSchema>;
```

### 3. usecase.ts（ビジネスロジック）

```typescript
import type { User } from "../../../domain/user/entity";
import type { IUserRepository } from "../../../domain/interface/repository/userRepository";
import type { CreateUserBody, UpdateUserBody, PatchUserBody } from "./requests";
import { NotFoundError, BadRequestError } from "../../../domain/errors/httpErrors";

export class UserUseCase {
  constructor(private repository: IUserRepository) {}

  // ユーザーリスト取得
  async getUsers(): Promise<User[]> {
    return await this.repository.findAll();
  }

  // 単一ユーザー取得
  async getUserById(id: number): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }

  // ユーザー作成
  async createUser(data: CreateUserBody): Promise<User> {
    // ビジネスロジック: 重複チェック
    const existingUser = await this.repository.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestError(`User with email ${data.email} already exists`);
    }

    // ビジネスロジック: パスワードのハッシュ化など
    // ...

    return await this.repository.create(data);
  }

  // ユーザー更新
  async updateUser(id: number, data: UpdateUserBody): Promise<User> {
    // ビジネスロジック: 存在確認
    const exists = await this.repository.exists(id);
    if (!exists) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return await this.repository.update(id, data);
  }

  // ユーザー部分更新
  async patchUser(id: number, data: PatchUserBody): Promise<User> {
    const user = await this.repository.patch(id, data);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }

  // ユーザー削除
  async deleteUser(id: number): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
  }
}
```

### 4. controller.ts（HTTPリクエスト/レスポンス処理）

```typescript
import type { UserUseCase } from "./usecase";
import type { CreateUserBody, UpdateUserBody, PatchUserBody } from "./requests";
import type { User } from "../../../domain/user/entity";

export class UserController {
  constructor(private useCase: UserUseCase) {}

  // GET /users
  async getUsers(): Promise<User[]> {
    return await this.useCase.getUsers();
  }

  // GET /users/:id
  async getUserById(id: number): Promise<User> {
    return await this.useCase.getUserById(id);
  }

  // POST /users
  async createUser(body: CreateUserBody): Promise<User> {
    return await this.useCase.createUser(body);
  }

  // PUT /users/:id
  async updateUser(id: number, body: UpdateUserBody): Promise<User> {
    return await this.useCase.updateUser(id, body);
  }

  // PATCH /users/:id
  async patchUser(id: number, body: PatchUserBody): Promise<User> {
    return await this.useCase.patchUser(id, body);
  }

  // DELETE /users/:id
  async deleteUser(id: number): Promise<void> {
    await this.useCase.deleteUser(id);
  }
}
```

### 5. router.ts（ルーティング定義）

```typescript
import { Elysia } from "elysia";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
  PatchUserBodySchema,
  UserIdParamSchema,
  UserListQuerySchema,
} from "./requests";
import {
  UserResponseSchema,
  UserListResponseSchema,
  DeleteResponseSchema,
} from "./responses";
import { errorHandler } from "../../middleware/errorHandler";
import { initializeUserDI, getInternalUserController } from "../../../di/users";

// DIコンテナの初期化
initializeUserDI();

// DIコンテナからControllerを取得
const controller = getInternalUserController();

// ルーター定義
export const userRouter = new Elysia({ prefix: "/users" })
  .use(errorHandler)  // エラーハンドリングミドルウェア
  // GET /users
  .get(
    "/",
    async ({ query }) => await controller.getUsers(),
    {
      query: UserListQuerySchema,
      response: UserListResponseSchema,
      detail: {
        tags: ["Users"],
        summary: "Get all users",
        description: "Retrieve a list of all users with pagination",
      },
    }
  )
  // GET /users/:id
  .get(
    "/:id",
    async ({ params }) => await controller.getUserById(params.id),
    {
      params: UserIdParamSchema,
      response: UserResponseSchema,
      detail: {
        tags: ["Users"],
        summary: "Get user by ID",
        description: "Retrieve a single user by their ID",
      },
    }
  )
  // POST /users
  .post(
    "/",
    async ({ body }) => await controller.createUser(body),
    {
      body: CreateUserBodySchema,
      response: UserResponseSchema,
      detail: {
        tags: ["Users"],
        summary: "Create user",
        description: "Create a new user",
      },
    }
  )
  // PUT /users/:id
  .put(
    "/:id",
    async ({ params, body }) => await controller.updateUser(params.id, body),
    {
      params: UserIdParamSchema,
      body: UpdateUserBodySchema,
      response: UserResponseSchema,
      detail: {
        tags: ["Users"],
        summary: "Update user",
        description: "Update an existing user (full replacement)",
      },
    }
  )
  // PATCH /users/:id
  .patch(
    "/:id",
    async ({ params, body }) => await controller.patchUser(params.id, body),
    {
      params: UserIdParamSchema,
      body: PatchUserBodySchema,
      response: UserResponseSchema,
      detail: {
        tags: ["Users"],
        summary: "Patch user",
        description: "Partially update an existing user",
      },
    }
  )
  // DELETE /users/:id
  .delete(
    "/:id",
    async ({ params }) => await controller.deleteUser(params.id),
    {
      params: UserIdParamSchema,
      response: DeleteResponseSchema,
      detail: {
        tags: ["Users"],
        summary: "Delete user",
        description: "Delete a user by their ID",
      },
    }
  );
```

## 認証の実装

### public（認証不要）

```typescript
// src/api/public/users/router.ts
export const publicUserRouter = new Elysia({ prefix: "/public/users" })
  .use(errorHandler)
  .post("/register", async ({ body }) => await controller.register(body))
  .post("/login", async ({ body }) => await controller.login(body));
```

### user（認証有り・一般ユーザー）

```typescript
// src/api/user/profile/router.ts
import { authMiddleware } from "../../middleware/auth";

export const userProfileRouter = new Elysia({ prefix: "/user/profile" })
  .use(errorHandler)
  .use(authMiddleware)  // 認証ミドルウェアを適用
  .get("/", async ({ user }) => await controller.getProfile(user.id))
  .put("/", async ({ user, body }) => await controller.updateProfile(user.id, body));
```

### admin（認証有り・管理者）

```typescript
// src/api/admin/users/router.ts
import { authMiddleware } from "../../middleware/auth";
import { adminMiddleware } from "../../middleware/admin";

export const adminUserRouter = new Elysia({ prefix: "/admin/users" })
  .use(errorHandler)
  .use(authMiddleware)   // 認証ミドルウェア
  .use(adminMiddleware)  // 管理者チェックミドルウェア
  .get("/", async () => await controller.getAllUsers())
  .delete("/:id", async ({ params }) => await controller.deleteUser(params.id));
```

## index.tsへの統合

```typescript
// src/index.ts
import { Elysia } from "elysia";
import openapi from "@elysiajs/openapi";

// Public routers
import { publicUserRouter } from "./api/public/users/router";
import { publicAuthRouter } from "./api/public/auth/router";

// User routers
import { userProfileRouter } from "./api/user/profile/router";
import { userOrderRouter } from "./api/user/orders/router";

// Admin routers
import { adminUserRouter } from "./api/admin/users/router";
import { adminSystemRouter } from "./api/admin/system/router";

const app = new Elysia()
  .use(openapi({
    documentation: {
      info: {
        title: "API Documentation",
        version: "1.0.0",
      },
      tags: [
        { name: "Public", description: "Public endpoints" },
        { name: "User", description: "User endpoints" },
        { name: "Admin", description: "Admin endpoints" },
      ],
    },
  }))
  // Public routes
  .use(publicUserRouter)
  .use(publicAuthRouter)
  // User routes
  .use(userProfileRouter)
  .use(userOrderRouter)
  // Admin routes
  .use(adminUserRouter)
  .use(adminSystemRouter)
  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
```

## 命名規則

### ディレクトリ名
- `{scope}/{resource}/`（例: `public/users/`, `user/profile/`, `admin/users/`）
- スコープ: `public`, `user`, `admin`
- リソース: 小文字、複数形（例: `users`, `products`, `orders`）

### ファイル名
- `requests.ts`: リクエストスキーマ
- `responses.ts`: レスポンススキーマ
- `usecase.ts`: ビジネスロジック
- `controller.ts`: HTTPリクエスト/レスポンス処理
- `router.ts`: ルーティング定義

### エクスポート名
- Router: `{scope}{Resource}Router`（例: `publicUserRouter`, `userProfileRouter`, `adminUserRouter`）
- UseCase: `{Resource}UseCase`（例: `UserUseCase`）
- Controller: `{Resource}Controller`（例: `UserController`）

## ベストプラクティス

### 1. スキーマファースト

スキーマ定義から型を推論します（単一ソース）。

```typescript
// スキーマ定義
export const CreateUserBodySchema = t.Object({ ... });

// 型推論
export type CreateUserBody = Infer<typeof CreateUserBodySchema>;
```

### 2. エラーはUseCaseで投げる

Controller/Routerはエラーハンドリングせず、UseCaseでエラーを投げます。

```typescript
// UseCase
async getUserById(id: number): Promise<User> {
  const user = await this.repository.findById(id);
  if (!user) {
    throw new NotFoundError(`User with id ${id} not found`);
  }
  return user;
}

// Controller（エラーハンドリング不要）
async getUserById(id: number): Promise<User> {
  return await this.useCase.getUserById(id);
}
```

### 3. OpenAPIドキュメントを記述

`detail`オプションでOpenAPIドキュメントを記述します。

```typescript
.get(
  "/:id",
  async ({ params }) => await controller.getUserById(params.id),
  {
    params: UserIdParamSchema,
    response: UserResponseSchema,
    detail: {
      tags: ["Users"],
      summary: "Get user by ID",
      description: "Retrieve a single user by their ID",
    },
  }
)
```

### 4. バリデーションをスキーマで定義

バリデーションルールはスキーマで定義します。

```typescript
export const CreateUserBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 }),
  age: t.Number({ minimum: 18, maximum: 120 }),
});
```

### 5. レスポンス型を統一

成功レスポンスの形式を統一します。

```typescript
// 単一リソース
{ id: 1, name: "John" }

// リストリソース（ページネーション付き）
{
  data: [{ id: 1 }, { id: 2 }],
  total: 100,
  page: 1,
  limit: 10,
  totalPages: 10
}

// 作成成功
{ message: "User created successfully", user: { ... } }
```

## 注意事項

### 1. ビジネスロジックはUseCaseに

ビジネスロジックはUseCase層に集約します。

```typescript
// 良い例：UseCaseにビジネスロジック
async createUser(data: CreateUserBody): Promise<User> {
  const existingUser = await this.repository.findByEmail(data.email);
  if (existingUser) {
    throw new BadRequestError("Email already exists");
  }
  return await this.repository.create(data);
}

// 悪い例：Controllerにビジネスロジック
async createUser(body: CreateUserBody): Promise<User> {
  const existingUser = await repository.findByEmail(body.email);  // NG
  if (existingUser) {
    throw new BadRequestError("Email already exists");
  }
  return await this.useCase.createUser(body);
}
```

### 2. DIコンテナを使用

手動でのインスタンス化は避け、DIコンテナを使用します。

```typescript
// 良い例：DIコンテナを使用
initializeUserDI();
const controller = getUserController();

// 悪い例：手動でインスタンス化
const repository = new UserRepository();  // NG
const useCase = new UserUseCase(repository);  // NG
const controller = new UserController(useCase);  // NG
```

### 3. スコープを明確に

各エンドポイントのスコープ（public/user/admin）を明確にします。

```typescript
// public: 認証不要
/public/auth/login

// user: 認証有り（一般ユーザー）
/user/profile

// admin: 認証有り（管理者）
/admin/users
```

## まとめ

- **3つのスコープ**: `public`（認証不要）、`user`（一般ユーザー）、`admin`（管理者）
- **5つのファイル**: `requests.ts`, `responses.ts`, `usecase.ts`, `controller.ts`, `router.ts`
- **スキーマファースト**: Type Boxでスキーマ定義 → `Infer`で型推論
- **エラーハンドリング**: UseCaseでエラーを投げ、ミドルウェアで処理
- **DIコンテナ**: 依存性注入を使用
- **OpenAPI**: `detail`オプションでドキュメント記述

API層を適切に設計することで、型安全で保守性の高いAPIを構築できます。
