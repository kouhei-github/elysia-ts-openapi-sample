# src/di

## 概要

このディレクトリには、依存性注入(Dependency Injection)コンテナとモジュールごとの依存関係定義を配置します。
DIコンテナを使用することで、コードの疎結合化、テスタビリティの向上、依存関係の一元管理を実現します。

## ディレクトリ構造

```
src/di/
├── container.ts       # DIコンテナの実装
├── users.ts          # Userモジュールの依存関係定義
├── products.ts       # Productモジュールの依存関係定義（例）
└── orders.ts         # Orderモジュールの依存関係定義（例）
```

## ファイルの書き方

### 1. DIコンテナの実装 (`container.ts`)

**このファイルは既に実装済みです。基本的に変更不要です。**

```typescript
type Factory<T> = () => T;
type Singleton<T> = { instance?: T; factory: Factory<T> };

class DIContainer {
  private singletons = new Map<string, Singleton<any>>();
  private factories = new Map<string, Factory<any>>();

  // シングルトンとして登録
  registerSingleton<T>(key: string, factory: Factory<T>): void {
    this.singletons.set(key, { factory });
  }

  // ファクトリとして登録
  registerFactory<T>(key: string, factory: Factory<T>): void {
    this.factories.set(key, factory);
  }

  // シングルトンインスタンスを取得
  getSingleton<T>(key: string): T {
    const singleton = this.singletons.get(key);
    if (!singleton) {
      throw new Error(`Singleton not registered: ${key}`);
    }
    if (!singleton.instance) {
      singleton.instance = singleton.factory();
    }
    return singleton.instance as T;
  }

  // ファクトリから新しいインスタンスを取得
  getFactory<T>(key: string): T {
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Factory not registered: ${key}`);
    }
    return factory();
  }

  // リセット（主にテスト用）
  reset(): void {
    this.singletons.clear();
    this.factories.clear();
  }
}

export const container = new DIContainer();
```

### 2. モジュールごとの依存関係定義

各モジュール（例: users, products, orders）ごとに、依存関係を定義するファイルを作成します。

## 実装例

### Users モジュール (`users.ts`)

```typescript
import { container } from "./container";
import type { IUserRepository } from "../domain/interface/repository/userRepository";
import { InMemoryUserRepository, ExternalApiUserRepository } from "../infrastructure/repository/userRepository";
import { UserUseCase } from "../api/public/users/usecase";
import { UserController } from "../api/public/users/controller";

// DIコンテナキーの定義
export const DI_KEYS = {
  // Repositories
  INTERNAL_USER_REPOSITORY: "InternalUserRepository",
  EXTERNAL_USER_REPOSITORY: "ExternalUserRepository",

  // UseCases
  INTERNAL_USER_USECASE: "InternalUserUseCase",
  EXTERNAL_USER_USECASE: "ExternalUserUseCase",

  // Controllers
  INTERNAL_USER_CONTROLLER: "InternalUserController",
  EXTERNAL_USER_CONTROLLER: "ExternalUserController",
} as const;

// DIコンテナの初期化関数
export function initializeUserDI(): void {
  // Repository層をシングルトンとして登録
  container.registerSingleton<IUserRepository>(
    DI_KEYS.INTERNAL_USER_REPOSITORY,
    () => new InMemoryUserRepository()
  );

  container.registerSingleton<IUserRepository>(
    DI_KEYS.EXTERNAL_USER_REPOSITORY,
    () => new ExternalApiUserRepository()
  );

  // UseCase層をシングルトンとして登録
  container.registerSingleton<UserUseCase>(
    DI_KEYS.INTERNAL_USER_USECASE,
    () => {
      const repository = container.getSingleton<IUserRepository>(
        DI_KEYS.INTERNAL_USER_REPOSITORY
      );
      return new UserUseCase(repository);
    }
  );

  container.registerSingleton<UserUseCase>(
    DI_KEYS.EXTERNAL_USER_USECASE,
    () => {
      const repository = container.getSingleton<IUserRepository>(
        DI_KEYS.EXTERNAL_USER_REPOSITORY
      );
      return new UserUseCase(repository);
    }
  );

  // Controller層をシングルトンとして登録
  container.registerSingleton<UserController>(
    DI_KEYS.INTERNAL_USER_CONTROLLER,
    () => {
      const useCase = container.getSingleton<UserUseCase>(
        DI_KEYS.INTERNAL_USER_USECASE
      );
      return new UserController(useCase);
    }
  );

  container.registerSingleton<UserController>(
    DI_KEYS.EXTERNAL_USER_CONTROLLER,
    () => {
      const useCase = container.getSingleton<UserUseCase>(
        DI_KEYS.EXTERNAL_USER_USECASE
      );
      return new UserController(useCase);
    }
  );
}

// 便利なヘルパー関数
export function getInternalUserController(): UserController {
  return container.getSingleton<UserController>(DI_KEYS.INTERNAL_USER_CONTROLLER);
}

export function getExternalUserController(): UserController {
  return container.getSingleton<UserController>(DI_KEYS.EXTERNAL_USER_CONTROLLER);
}
```

### Products モジュール（例）

```typescript
import { container } from "./container";
import type { IProductRepository } from "../domain/interface/repository/productRepository";
import { ProductRepository } from "../infrastructure/repository/productRepository";
import { ProductUseCase } from "../api/public/products/usecase";
import { ProductController } from "../api/public/products/controller";

export const PRODUCT_DI_KEYS = {
  PRODUCT_REPOSITORY: "ProductRepository",
  PRODUCT_USECASE: "ProductUseCase",
  PRODUCT_CONTROLLER: "ProductController",
} as const;

export function initializeProductDI(): void {
  // Repository
  container.registerSingleton<IProductRepository>(
    PRODUCT_DI_KEYS.PRODUCT_REPOSITORY,
    () => new ProductRepository()
  );

  // UseCase
  container.registerSingleton<ProductUseCase>(
    PRODUCT_DI_KEYS.PRODUCT_USECASE,
    () => {
      const repository = container.getSingleton<IProductRepository>(
        PRODUCT_DI_KEYS.PRODUCT_REPOSITORY
      );
      return new ProductUseCase(repository);
    }
  );

  // Controller
  container.registerSingleton<ProductController>(
    PRODUCT_DI_KEYS.PRODUCT_CONTROLLER,
    () => {
      const useCase = container.getSingleton<ProductUseCase>(
        PRODUCT_DI_KEYS.PRODUCT_USECASE
      );
      return new ProductController(useCase);
    }
  );
}

export function getProductController(): ProductController {
  return container.getSingleton<ProductController>(PRODUCT_DI_KEYS.PRODUCT_CONTROLLER);
}
```

## 使用方法

### 1. Router での使用

```typescript
// src/api/public/users/router.ts
import { Elysia } from "elysia";
import { initializeUserDI, getInternalUserController, getExternalUserController } from "../../../di/users";

// DIコンテナの初期化
initializeUserDI();

// DIコンテナからControllerを取得
const controller = getInternalUserController();
const externalController = getExternalUserController();

export const userRouter = new Elysia({ prefix: "/users" })
  .get("/", async () => await externalController.getUsers())
  .post("/", async ({ body }) => await controller.createUser(body));
```

### 2. テストでの使用

```typescript
import { container } from "../di/container";
import { DI_KEYS, initializeUserDI } from "../di/users";
import { MockUserRepository } from "./mocks/mockUserRepository";

describe("UserController", () => {
  beforeEach(() => {
    // テスト前にコンテナをリセット
    container.reset();

    // モックRepositoryを登録
    container.registerSingleton(
      DI_KEYS.INTERNAL_USER_REPOSITORY,
      () => new MockUserRepository()
    );

    // 他の依存関係を初期化
    initializeUserDI();
  });

  it("should get users", async () => {
    const controller = container.getSingleton(DI_KEYS.INTERNAL_USER_CONTROLLER);
    const users = await controller.getUsers();
    expect(users).toHaveLength(0);
  });
});
```

## ファイル構造のテンプレート

新しいモジュールを追加する際は、以下のテンプレートを使用します。

```typescript
import { container } from "./container";
import type { I[Module]Repository } from "../domain/interface/repository/[module]Repository";
import { [Module]Repository } from "../infrastructure/repository/[module]Repository";
import { [Module]UseCase } from "../api/[scope]/[module]/usecase";
import { [Module]Controller } from "../api/[scope]/[module]/controller";

// 1. DIキーの定義
export const [MODULE]_DI_KEYS = {
  [MODULE]_REPOSITORY: "[Module]Repository",
  [MODULE]_USECASE: "[Module]UseCase",
  [MODULE]_CONTROLLER: "[Module]Controller",
} as const;

// 2. 初期化関数
export function initialize[Module]DI(): void {
  // Repository層
  container.registerSingleton<I[Module]Repository>(
    [MODULE]_DI_KEYS.[MODULE]_REPOSITORY,
    () => new [Module]Repository()
  );

  // UseCase層
  container.registerSingleton<[Module]UseCase>(
    [MODULE]_DI_KEYS.[MODULE]_USECASE,
    () => {
      const repository = container.getSingleton<I[Module]Repository>(
        [MODULE]_DI_KEYS.[MODULE]_REPOSITORY
      );
      return new [Module]UseCase(repository);
    }
  );

  // Controller層
  container.registerSingleton<[Module]Controller>(
    [MODULE]_DI_KEYS.[MODULE]_CONTROLLER,
    () => {
      const useCase = container.getSingleton<[Module]UseCase>(
        [MODULE]_DI_KEYS.[MODULE]_USECASE
      );
      return new [Module]Controller(useCase);
    }
  );
}

// 3. ヘルパー関数
export function get[Module]Controller(): [Module]Controller {
  return container.getSingleton<[Module]Controller>([MODULE]_DI_KEYS.[MODULE]_CONTROLLER);
}
```

## 命名規則

### ファイル名
- `camelCase.ts`（例: `users.ts`, `products.ts`, `orders.ts`）
- モジュール名を使用

### DIキー
- `UPPER_SNAKE_CASE`（例: `USER_REPOSITORY`, `PRODUCT_USECASE`）
- `{モジュール名}_{層名}`の形式

### 関数名
- `initialize{Module}DI()`: 初期化関数
- `get{Module}Controller()`: Controllerを取得するヘルパー関数
- `get{Module}UseCase()`: UseCaseを取得するヘルパー関数（必要に応じて）

## ベストプラクティス

### 1. シングルトン vs ファクトリ

**シングルトンを使用する場合**:
- Repository: データベース接続など、状態を共有する
- UseCase: ビジネスロジック、状態を持たない
- Controller: HTTPハンドラー、状態を持たない

**ファクトリを使用する場合**:
- リクエストごとに異なる状態を持つオブジェクト
- テストで毎回新しいインスタンスが必要な場合

```typescript
// シングルトン（推奨: Repository, UseCase, Controller）
container.registerSingleton("UserRepository", () => new UserRepository());

// ファクトリ（特殊なケース）
container.registerFactory("RequestContext", () => new RequestContext());
```

### 2. 依存関係の順序

依存関係は以下の順序で登録します:

1. Repository層（最も内側）
2. External層（外部サービス）
3. UseCase層（Repositoryに依存）
4. Controller層（UseCaseに依存）

```typescript
export function initializeUserDI(): void {
  // 1. Repository層
  container.registerSingleton(...);

  // 2. UseCase層
  container.registerSingleton(...);

  // 3. Controller層
  container.registerSingleton(...);
}
```

### 3. 型安全性の確保

DIキーには型を明示的に指定します。

```typescript
// 良い例：型を明示
container.registerSingleton<IUserRepository>(
  DI_KEYS.USER_REPOSITORY,
  () => new UserRepository()
);

// 悪い例：型なし
container.registerSingleton(
  DI_KEYS.USER_REPOSITORY,
  () => new UserRepository()
);
```

### 4. ヘルパー関数の提供

Controllerを取得するヘルパー関数を提供し、コードを簡潔にします。

```typescript
// ヘルパー関数を提供
export function getUserController(): UserController {
  return container.getSingleton<UserController>(DI_KEYS.USER_CONTROLLER);
}

// Router側で使用
const controller = getUserController();  // シンプル
```

### 5. テスト可能な設計

テストでモックを注入できるように設計します。

```typescript
// テストで使用
beforeEach(() => {
  container.reset();
  container.registerSingleton(
    DI_KEYS.USER_REPOSITORY,
    () => new MockUserRepository()  // モックを注入
  );
  initializeUserDI();
});
```

## 注意事項

### 1. 循環依存を避ける

モジュール間で循環依存が発生しないように注意します。

```typescript
// 悪い例：循環依存
// users.ts → orders.ts → users.ts

// 良い例：一方向の依存
// users.ts ← orders.ts
```

### 2. 初期化は1回のみ

`initialize{Module}DI()`は、アプリケーション起動時に1回だけ呼び出します。

```typescript
// src/api/public/users/router.ts
initializeUserDI();  // Routerの初期化時に1回だけ

// 複数回呼び出さない
```

### 3. グローバルコンテナの使用

`container`はグローバルシングルトンです。複数のコンテナを作成しないでください。

```typescript
// 良い例：グローバルコンテナを使用
import { container } from "./container";

// 悪い例：新しいコンテナを作成
const myContainer = new DIContainer();  // NG
```

## 依存関係の可視化

```
DIコンテナ (container.ts)
  ↓
モジュール定義 (users.ts, products.ts, ...)
  ↓
┌─────────────────┐
│  Repository層   │ ← 最も内側
└────────┬────────┘
         │ 依存
┌────────↓────────┐
│  UseCase層      │
└────────┬────────┘
         │ 依存
┌────────↓────────┐
│  Controller層   │
└────────┬────────┘
         │ 使用
┌────────↓────────┐
│  Router         │
└─────────────────┘
```

## まとめ

- **container.ts**: 基本的に変更不要
- **{module}.ts**: モジュールごとに作成
- **初期化関数**: `initialize{Module}DI()`を定義
- **ヘルパー関数**: `get{Module}Controller()`を提供
- **テスト**: `container.reset()`でリセット可能
- **型安全性**: TypeScriptの型を活用

DIコンテナを適切に使用することで、疎結合で保守性の高いコードを実現できます。
