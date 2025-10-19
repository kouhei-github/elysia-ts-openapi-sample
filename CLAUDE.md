# Elysia TypeScript - クリーンアーキテクチャプロジェクト

このプロジェクトは、Elysiaフレームワークを使用し、クリーンアーキテクチャの原則に沿って構築されたAPIです。

---

## ⚠️ 最重要ルール

### バックエンドコード修正時の必須事項

**バックエンドのコード（`src/`配下）のいずれかを修正した場合、必ず以下を実行してください：**

```bash
bun run test
```

#### ルール

1. **コード修正後は必ずテストを実行する**
   - `src/`配下のファイルを修正したら、必ず`bun run test`を実行

2. **エラーが発生した場合は必ず修正する**
   - テストが失敗した場合、コードを修正してエラーを解消

3. **テストは必ず全て成功させる**
   - テスト結果は必ず**0 fail**で全て成功しなければなりません
   - 失敗したテストを残したままコミットしない

#### テスト成功の例

```bash
 12 pass
 0 fail   ← 必ず0 failであること
 40 expect() calls
Ran 12 tests across 1 files. [196.00ms]
```

#### ❌NG例（失敗したテストがある）

```bash
 10 pass
 2 fail   ← これはNG！修正が必要
 40 expect() calls
```

**このルールを守ることで、コードの品質を保ち、デグレードを防ぎます。**

---

## 目次

1. [ディレクトリ構造](#ディレクトリ構造)
2. [依存性の注入 (DI)](#依存性の注入-di)
3. [OpenAPI自動生成](#openapi自動生成)
4. [エラーハンドリング](#エラーハンドリング)
5. [テスト](#テスト)
6. [開発ガイド](#開発ガイド)

---

## ディレクトリ構造

```
src/
├── di/                          # 依存性注入コンテナ
│   ├── container.ts            # DIコンテナ実装
│   └── users.ts                # Userモジュールの依存性定義
│
├── domain/                      # ドメイン層（ビジネスロジックの核心）
│   ├── user/
│   │   └── entity.ts           # Userエンティティとスキーマ定義
│   ├── interface/repository/   # リポジトリインターフェース（依存性の逆転）
│   │   └── userRepository.ts   # IUserRepositoryインターフェース
│   └── errors/
│       └── httpErrors.ts       # カスタムHTTPエラークラス
│
├── infrastructure/              # インフラ層（外部システムとの接続）
│   └── repository/
│       └── userRepository.ts   # リポジトリの具体的実装
│                               # - InMemoryUserRepository
│                               # - ExternalApiUserRepository
│
├── api/                         # API層（HTTPインターフェース）
│   ├── middleware/
│   │   └── errorHandler.ts    # グローバルエラーハンドリングミドルウェア
│   └── public/users/           # Usersエンドポイント
│       ├── requests.ts         # リクエストスキーマ定義（Infer使用）
│       ├── responses.ts        # レスポンススキーマ定義（Infer使用）
│       ├── usecase.ts          # ビジネスロジック（UseCase層）
│       ├── controller.ts       # HTTPリクエスト/レスポンス処理
│       └── router.ts           # ルーティング定義
│
└── index.ts                     # アプリケーションエントリーポイント

test/
├── helpers/                     # テストヘルパー関数
│   └── createTestApp.ts        # テスト用Elysiaアプリ作成
├── mocks/                       # モックオブジェクト
│   └── mockUserRepository.ts   # モックUserRepository
└── users.test.ts                # ユーザーエンドポイントのテスト
```

### 各層の責務

#### 1. Domain層（ドメイン層）
- **責務**: ビジネスロジックの核心、エンティティ定義、インターフェース定義
- **依存**: 他の層に依存しない（最も内側の層）
- **ファイル**:
  - `entity.ts`: エンティティとスキーマ定義
  - `interface/repository/*.ts`: リポジトリインターフェース（依存性の逆転原則）
  - `errors/*.ts`: ドメイン固有のエラー定義

#### 2. Infrastructure層（インフラ層）
- **責務**: 外部システムとの接続（DB、外部API、ファイルシステムなど）
- **依存**: Domain層のインターフェースに依存
- **ファイル**:
  - `repository/*.ts`: リポジトリの具体的実装
    - InMemory実装（モック/テスト用）
    - 外部API実装

#### 3. API層（アプリケーション層 + プレゼンテーション層）
- **責務**: HTTPリクエスト/レスポンス処理、ビジネスロジックの実行
- **依存**: Domain層、Infrastructure層
- **ファイル**:
  - `requests.ts`: リクエストボディ/パラメータのスキーマ定義
  - `responses.ts`: レスポンスのスキーマ定義
  - `usecase.ts`: ビジネスロジックの調整（リポジトリを使用）
  - `controller.ts`: HTTPリクエスト/レスポンスの処理
  - `router.ts`: ルーティングとElysiaの設定
  - `middleware/*.ts`: ミドルウェア（エラーハンドリングなど）

#### 4. DI層（依存性注入）
- **責務**: 依存関係の構築と管理
- **依存**: 全ての層
- **ファイル**:
  - `container.ts`: DIコンテナの実装
  - `users.ts`: Userモジュールの依存関係定義

---

## 依存性の注入 (DI)

### 概要

依存性注入（Dependency Injection）を使用することで、コードの疎結合化とテスタビリティの向上を実現しています。

### DIコンテナの実装

#### 1. コンテナの作成 (`src/di/container.ts`)

```typescript
class DIContainer {
  // シングルトンとして登録
  registerSingleton<T>(key: string, factory: Factory<T>): void

  // ファクトリとして登録（毎回新しいインスタンス）
  registerFactory<T>(key: string, factory: Factory<T>): void

  // シングルトンインスタンスを取得
  getSingleton<T>(key: string): T

  // ファクトリから新しいインスタンスを取得
  getFactory<T>(key: string): T
}
```

#### 2. モジュールごとのDI設定 (`src/di/users.ts`)

```typescript
// DIキーの定義
export const DI_KEYS = {
  INTERNAL_USER_REPOSITORY: "InternalUserRepository",
  EXTERNAL_USER_REPOSITORY: "ExternalUserRepository",
  INTERNAL_USER_USECASE: "InternalUserUseCase",
  EXTERNAL_USER_USECASE: "ExternalUserUseCase",
  INTERNAL_USER_CONTROLLER: "InternalUserController",
  EXTERNAL_USER_CONTROLLER: "ExternalUserController",
} as const;

// 依存関係の登録
export function initializeUserDI(): void {
  // Repository層
  container.registerSingleton(
    DI_KEYS.INTERNAL_USER_REPOSITORY,
    () => new InMemoryUserRepository()
  );

  // UseCase層（Repositoryに依存）
  container.registerSingleton(
    DI_KEYS.INTERNAL_USER_USECASE,
    () => {
      const repository = container.getSingleton(DI_KEYS.INTERNAL_USER_REPOSITORY);
      return new UserUseCase(repository);
    }
  );

  // Controller層（UseCaseに依存）
  container.registerSingleton(
    DI_KEYS.INTERNAL_USER_CONTROLLER,
    () => {
      const useCase = container.getSingleton(DI_KEYS.INTERNAL_USER_USECASE);
      return new UserController(useCase);
    }
  );
}
```

#### 3. Routerでの使用

```typescript
// DIコンテナの初期化
initializeUserDI();

// DIコンテナからControllerを取得
const controller = getInternalUserController();
const externalController = getExternalUserController();

// ルーターで使用
export const userRouter = new Elysia({ prefix: "/users" })
  .get("/", async () => await externalController.getUsers())
  .post("/", async ({ body }) => await controller.createUser(body));
```

### 依存関係の流れ

```
┌─────────────────┐
│  DIコンテナ     │
└────────┬────────┘
         │ 初期化・管理
         ↓
┌─────────────────┐
│  Repository     │ ← インフラ層
│  (Singleton)    │
└────────┬────────┘
         │ 依存
         ↓
┌─────────────────┐
│  UseCase        │ ← アプリケーション層
│  (Singleton)    │
└────────┬────────┘
         │ 依存
         ↓
┌─────────────────┐
│  Controller     │ ← プレゼンテーション層
│  (Singleton)    │
└────────┬────────┘
         │ 使用
         ↓
┌─────────────────┐
│  Router         │
└─────────────────┘
```

### DIのメリット

1. **疎結合**: 具体的な実装への依存を削減
2. **テスタビリティ**: モックオブジェクトに簡単に差し替え可能
3. **一元管理**: 依存関係の構築を一箇所で管理
4. **拡張性**: 新しい実装の追加が容易

### テスト時の使用例

```typescript
// テストでモックRepositoryを注入
container.registerSingleton(
  DI_KEYS.INTERNAL_USER_REPOSITORY,
  () => new MockUserRepository()  // モック実装
);

initializeUserDI();
const controller = getInternalUserController();
// controllerはモックRepositoryを使用
```

---

## OpenAPI自動生成

### 概要

Elysiaの`@elysiajs/openapi`プラグインを使用して、型定義からOpenAPIスキーマを自動生成します。

### セットアップ

#### 1. プラグインのインストール

```bash
bun add @elysiajs/openapi
```

#### 2. アプリケーションへの適用 (`src/index.ts`)

```typescript
import { Elysia } from "elysia";
import openapi from "@elysiajs/openapi";
import { userRouter } from "./api/public/users/router";

const app = new Elysia()
  .use(openapi())  // OpenAPIプラグインを適用
  .get("/", () => "Hello Elysia")
  .use(userRouter)
  .listen(3000);
```

#### 3. スキーマ定義とInferの使用

ElysiaのType BoxとInferを使用して、スキーマから型を自動推論します。

**リクエストスキーマ** (`src/api/public/users/requests.ts`):

```typescript
import { t, type Static as Infer } from "elysia";

// スキーマ定義
export const CreateUserBodySchema = t.Object({
  name: t.String(),
  username: t.String(),
  email: t.String(),
  company: t.Object({
    name: t.String(),
  }),
});

// スキーマから型を推論（単一ソース）
export type CreateUserBody = Infer<typeof CreateUserBodySchema>;
```

**レスポンススキーマ** (`src/api/public/users/responses.ts`):

```typescript
import { t, type Static as Infer } from "elysia";
import { UserSchema } from "../../../domain/user/entity";

export const UserResponseSchema = UserSchema;
export const UserListResponseSchema = t.Array(UserSchema);

// スキーマから型を推論
export type UserResponse = Infer<typeof UserResponseSchema>;
export type UserListResponse = Infer<typeof UserListResponseSchema>;
```

#### 4. ルーターでのスキーマ適用 (`src/api/public/users/router.ts`)

```typescript
export const userRouter = new Elysia({ prefix: "/users" })
  // GET /users
  .get(
    "/",
    async () => await externalController.getUsers(),
    {
      response: UserListResponseSchema,  // レスポンススキーマを指定
    }
  )
  // POST /users
  .post(
    "/",
    async ({ body }) => await controller.createUser(body),
    {
      body: CreateUserBodySchema,      // リクエストボディスキーマ
      response: UserResponseSchema,    // レスポンススキーマ
    }
  )
  // PATCH /users/:id/name
  .patch(
    "/:id/name",
    async ({ params, body }) => await controller.patchUser(params.id, body),
    {
      params: UserIdParamSchema,       // パラメータスキーマ
      body: PatchUserNameSchema,       // リクエストボディスキーマ
      response: UserResponseSchema,    // レスポンススキーマ
    }
  );
```

### OpenAPIドキュメントへのアクセス

サーバー起動後、以下のURLでOpenAPIドキュメントにアクセスできます：

- **Swagger UI**: `http://localhost:3000/swagger`
- **OpenAPI JSON**: `http://localhost:3000/swagger/json`

### Inferの利点

1. **単一ソース**: スキーマ定義から型を自動生成（DRY原則）
2. **型安全性**: TypeScriptの型チェックが効く
3. **自動ドキュメント生成**: OpenAPIスキーマが自動生成される
4. **バリデーション**: 実行時にリクエスト/レスポンスを自動検証

### スキーマの構造

```
┌──────────────────────────────────────┐
│  Type Box Schema (t.Object, etc.)    │
│  単一ソース                          │
└─────────────┬────────────────────────┘
              │
              ├─────────────┐
              ↓             ↓
    ┌──────────────┐  ┌─────────────────┐
    │ TypeScript型 │  │ OpenAPI Schema  │
    │ (Infer)      │  │ (自動生成)      │
    └──────────────┘  └─────────────────┘
              │             │
              ↓             ↓
    ┌──────────────┐  ┌─────────────────┐
    │ 型チェック   │  │ Swagger UI      │
    │ (コンパイル) │  │ (ドキュメント)  │
    └──────────────┘  └─────────────────┘
```

---

## エラーハンドリング

### グローバルエラーハンドリングミドルウェア

カスタムHTTPエラークラスとグローバルミドルウェアを使用して、統一的なエラー処理を実現しています。

#### 1. カスタムエラークラス (`src/domain/errors/httpErrors.ts`)

```typescript
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = "Not Found", details?: any) {
    super(404, message, details);
  }
}

// 他: BadRequestError, UnauthorizedError, ForbiddenError, InternalServerError
```

#### 2. エラーハンドリングミドルウェア (`src/api/middleware/errorHandler.ts`)

```typescript
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
      };
    }

    // Elysiaの組み込みエラー処理
    // VALIDATION, NOT_FOUND, PARSE, etc.
  });
```

#### 3. UseCaseでのエラー送出

```typescript
async getUserById(id: number): Promise<User> {
  const user = await this.repository.findById(id);
  if (!user) {
    throw new NotFoundError(`User with id ${id} not found`);
  }
  return user;
}
```

#### 4. Routerへの適用

```typescript
export const userRouter = new Elysia({ prefix: "/users" })
  .use(errorHandler)  // ミドルウェアを適用
  .get("/:id", async ({ params }) => await controller.getUserById(params.id));
  // エラーが発生すると自動的にミドルウェアが処理
```

### エラーレスポンス形式

```json
{
  "error": "NotFoundError",
  "message": "User with id 123 not found",
  "statusCode": 404
}
```

---

## テスト

### 概要

このプロジェクトでは、Bunの組み込みテストランナーを使用してユニットテストを実装しています。
テストは**AAA（Arrange-Act-Assert）パターン**に従って構造化されています。

### テストの実行

```bash
# すべてのテストを実行
bun test

# 特定のテストファイルを実行
bun test test/users.test.ts
```

### テストの構造

テストコードは以下の3つのセクションに分離されています：

```typescript
it("テストの説明", async () => {
  // Setup
  // テストの準備（データ作成、モックのセットアップなど）

  // Execute
  // テストの実行（APIリクエスト送信など）

  // Assert
  // テスト結果の検証（期待値との比較）
});
```

### テストの基本構造

#### 1. テストアプリケーションの作成

`createTestApp`ヘルパー関数を使用して、エラーハンドラー付きのElysiaアプリを作成します。

```typescript
import { createTestApp } from "./helpers/createTestApp";

// プレフィックス付き
const app = createTestApp("/users");

// プレフィックスなし
const app = createTestApp();
```

#### 2. モックリポジトリの使用

テスト用のモックリポジトリをDIコンテナに注入します。

```typescript
import { MockUserRepository } from "./mocks/mockUserRepository";

beforeEach(() => {
  // DIコンテナをリセット
  container.reset();

  // モックリポジトリを作成
  mockRepository = new MockUserRepository();
  mockRepository.setUsers(sampleUsers);

  // DIコンテナにモックリポジトリを登録
  container.registerSingleton(
    DI_KEYS.INTERNAL_USER_REPOSITORY,
    () => mockRepository
  );
});
```

### テストの例

```typescript
describe("GET /users/:id", () => {
  it("IDでユーザーを取得できる", async () => {
    // Setup
    // beforeEachで準備済み

    // Execute
    const response = await app.handle(
      new Request("http://localhost/users/1")
    );

    // Assert
    expect(response.status).toBe(200);

    const user = await response.json();
    expect(user.id).toBe(1);
    expect(user.name).toBe("Test User 1");
    expect(user.email).toBe("test1@example.com");
  });

  it("ユーザーが存在しない場合は404を返す", async () => {
    // Setup
    // beforeEachで準備済み

    // Execute
    const response = await app.handle(
      new Request("http://localhost/users/999")
    );

    // Assert
    expect(response.status).toBe(404);

    const error = await response.json();
    expect(error.error).toBe("NotFoundError");
    expect(error.message).toContain("User with id 999 not found");
  });
});
```

### テストディレクトリ構造

```
test/
├── helpers/              # テストヘルパー関数
│   └── createTestApp.ts # テスト用Elysiaアプリ作成
├── mocks/               # モックオブジェクト
│   └── mockUserRepository.ts
└── users.test.ts        # ユーザーエンドポイントのテスト
```

### AAAパターンの詳細

詳細なテストの書き方については、[test/CLAUDE.md](./test/CLAUDE.md)を参照してください。

### テストのベストプラクティス

1. **Setup, Execute, Assertを明確に分離**: 各セクションにコメントを追加
2. **createTestAppを使用**: エラーハンドラーなどの共通設定を含む
3. **モックリポジトリを活用**: 外部依存をモックで置き換え
4. **日本語のテスト説明**: 可読性を重視
5. **beforeEachでセットアップ**: 各テストの前に初期化

---

## 開発ガイド

### ⚠️ コード修正時の必須ルール

**バックエンドコード（`src/`配下）を修正した場合、必ず以下を実行してください：**

```bash
bun run test
```

- テスト結果は必ず**0 fail**で全て成功させること
- エラーが発生した場合は必ず修正すること
- 失敗したテストを残したままコミットしないこと

詳細は[最重要ルール](#最重要ルール)を参照してください。

---

### 新しいエンドポイントの追加

1. **Domain層**: エンティティとリポジトリインターフェースを定義
2. **Infrastructure層**: リポジトリの具体的実装を追加
3. **API層**: requests/responses/usecase/controller/routerを作成
4. **DI層**: 依存関係を登録
5. **index.ts**: ルーターをアプリケーションに追加
6. **⚠️ テストを実行**: `bun run test`で全てのテストが成功することを確認

### サーバーの起動

```bash
# 開発モード
bun run dev

# 本番モード
bun run start
```

### ディレクトリ構造の原則

- **依存の方向**: 外側の層から内側の層へ（Domain層は他に依存しない）
- **インターフェース分離**: Domain層でインターフェースを定義、Infrastructure層で実装
- **単一責任**: 各ファイルは1つの責務のみを持つ
- **型安全性**: Inferを使用してスキーマから型を自動生成

### ベストプラクティス

1. **スキーマファースト**: スキーマ定義から型を推論（単一ソース）
2. **エラーはUseCaseで投げる**: Controller/Routerはエラーハンドリングしない
3. **DIコンテナを使う**: 手動でのインスタンス化を避ける
4. **テスト可能な設計**: インターフェースとDIを活用
5. **レイヤーの責務を守る**: 各層の役割を明確に

---

## まとめ

このプロジェクトは、以下の原則に基づいて構築されています：

- **クリーンアーキテクチャ**: 層の分離と依存性の逆転
- **依存性注入**: 疎結合とテスタビリティの向上
- **型安全性**: Inferによるスキーマファーストな開発
- **自動ドキュメント生成**: OpenAPIによるAPI仕様の自動生成
- **統一的なエラーハンドリング**: グローバルミドルウェアによる一貫したエラー処理
- **包括的なテスト**: AAAパターンによる構造化されたテスト

これらの原則により、保守性、拡張性、テスタビリティの高いAPIを実現しています。

### ⚠️ 開発時の重要な注意事項

**コード修正後は必ず`bun run test`を実行し、全てのテストが成功すること（0 fail）を確認してください。**

これにより、コードの品質を保ち、デグレードを防ぐことができます。
