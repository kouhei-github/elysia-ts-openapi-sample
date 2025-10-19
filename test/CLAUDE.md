# テストガイド

このドキュメントでは、Elysiaプロジェクトにおけるテストの書き方を詳細に説明します。

## 目次

1. [テストの基本方針](#テストの基本方針)
2. [AAAパターン](#aaaパターン)
3. [テストアプリケーションの作成](#テストアプリケーションの作成)
4. [モックリポジトリの使用](#モックリポジトリの使用)
5. [テストの実装例](#テストの実装例)
6. [ベストプラクティス](#ベストプラクティス)

---

## テストの基本方針

### テストフレームワーク

- **テストランナー**: Bun組み込みテストランナー
- **アサーションライブラリ**: `bun:test`
- **テストパターン**: AAA（Arrange-Act-Assert）

### テストの構造

すべてのテストは以下の3つのセクションに分離されています：

1. **Setup（準備）**: テストデータの作成、モックのセットアップ
2. **Execute（実行）**: テスト対象の実行（APIリクエスト送信など）
3. **Assert（検証）**: 期待値との比較

---

## AAAパターン

### 概要

AAAパターン（Arrange-Act-Assert）は、テストを3つの明確なセクションに分離するテスト構造化パターンです。

### 構造

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

### 各セクションの詳細

#### Setup（準備）

テストを実行するための準備を行います。

- テストデータの作成
- モックオブジェクトのセットアップ
- 初期状態の設定

```typescript
// Setup
const newUser = {
  name: "Test User",
  username: "testuser",
  email: "test@example.com",
  company: { name: "Test Company" },
};
```

**beforeEachで準備が完了している場合**:

```typescript
// Setup
// beforeEachで準備済み
```

#### Execute（実行）

テスト対象を実行します。

- APIリクエストの送信
- 関数の呼び出し
- 操作の実行

```typescript
// Execute
const response = await app.handle(
  new Request("http://localhost/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newUser),
  })
);
```

#### Assert（検証）

結果を期待値と比較して検証します。

- ステータスコードの確認
- レスポンスボディの検証
- 副作用の確認（DBの状態など）

```typescript
// Assert
expect(response.status).toBe(200);

const createdUser = await response.json();
expect(createdUser.id).toBeDefined();
expect(createdUser.name).toBe("Test User");
```

---

## テストアプリケーションの作成

### createTestApp ヘルパー関数

`createTestApp`は、エラーハンドラーなどの共通設定を含むElysiaアプリケーションを生成します。

#### 定義場所

```
test/helpers/createTestApp.ts
```

#### 使用方法

```typescript
import { createTestApp } from "./helpers/createTestApp";

// プレフィックス付き（推奨）
const app = createTestApp("/users");

// プレフィックスなし
const app = createTestApp();
```

#### createTestAppの実装

```typescript
import { Elysia } from "elysia";
import { HttpError } from "../../src/domain/errors/httpErrors";

export function createTestApp(prefix: string = "") {
  return new Elysia({ prefix })
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
        // 他のエラーコード...
      }
    });
}
```

#### メリット

1. **共通設定の一元管理**: エラーハンドラーを毎回書く必要がない
2. **保守性の向上**: エラーハンドリングロジックを1箇所で管理
3. **テストの簡潔化**: ビジネスロジックのテストに集中できる

---

## モックリポジトリの使用

### 概要

テストでは、実際のデータベースや外部APIを使用せず、モックリポジトリを使用します。

### モックリポジトリの実装

#### 定義場所

```
test/mocks/mockUserRepository.ts
```

#### 実装例

```typescript
import type { User } from "../../src/domain/user/entity";
import type { IUserRepository } from "../../src/domain/interface/repository/userRepository";

export class MockUserRepository implements IUserRepository {
  private users: User[] = [];
  private currentId = 1;

  /**
   * テストデータをセットアップ
   */
  setUsers(users: User[]): void {
    this.users = [...users];
    if (users.length > 0) {
      this.currentId = Math.max(...users.map(u => u.id)) + 1;
    }
  }

  /**
   * データをクリア
   */
  clear(): void {
    this.users = [];
    this.currentId = 1;
  }

  async findAll(): Promise<User[]> {
    return [...this.users];
  }

  async findById(id: number): Promise<User | null> {
    const user = this.users.find(u => u.id === id);
    return user || null;
  }

  async create(data: CreateUserBody): Promise<User> {
    const newUser: User = {
      id: this.currentId++,
      ...data,
    };
    this.users.push(newUser);
    return { ...newUser };
  }

  // 他のメソッド...
}
```

### DIコンテナへの注入

```typescript
import { container } from "../src/di/container";
import { DI_KEYS } from "../src/di/users";
import { MockUserRepository } from "./mocks/mockUserRepository";

let mockRepository: MockUserRepository;

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

  // UseCaseを登録
  container.registerSingleton(
    DI_KEYS.INTERNAL_USER_USECASE,
    () => {
      const repository = container.getSingleton<MockUserRepository>(
        DI_KEYS.INTERNAL_USER_REPOSITORY
      );
      return new UserUseCase(repository);
    }
  );

  // Controllerを登録
  container.registerSingleton(
    DI_KEYS.INTERNAL_USER_CONTROLLER,
    () => {
      const useCase = container.getSingleton<UserUseCase>(
        DI_KEYS.INTERNAL_USER_USECASE
      );
      return new UserController(useCase);
    }
  );
});
```

---

## テストの実装例

### 基本的なテスト構造

```typescript
import { describe, expect, it, beforeEach } from "bun:test";
import { container } from "../src/di/container";
import { DI_KEYS } from "../src/di/users";
import { MockUserRepository } from "./mocks/mockUserRepository";
import { UserUseCase } from "../src/api/public/users/usecase";
import { UserController } from "../src/api/public/users/controller";
import { createTestApp } from "./helpers/createTestApp";
import type { User } from "../src/domain/user/entity";

describe("User API Endpoints", () => {
  let app: any;
  let mockRepository: MockUserRepository;

  // テスト用のサンプルデータ
  const sampleUsers: User[] = [
    {
      id: 1,
      name: "Test User 1",
      username: "testuser1",
      email: "test1@example.com",
      company: { name: "Test Company 1" },
    },
    {
      id: 2,
      name: "Test User 2",
      username: "testuser2",
      email: "test2@example.com",
      company: { name: "Test Company 2" },
    },
  ];

  beforeEach(() => {
    // DIコンテナのセットアップ
    container.reset();
    mockRepository = new MockUserRepository();
    mockRepository.setUsers(sampleUsers);

    // DIコンテナに登録
    container.registerSingleton(
      DI_KEYS.INTERNAL_USER_REPOSITORY,
      () => mockRepository
    );

    container.registerSingleton(
      DI_KEYS.INTERNAL_USER_USECASE,
      () => {
        const repository = container.getSingleton<MockUserRepository>(
          DI_KEYS.INTERNAL_USER_REPOSITORY
        );
        return new UserUseCase(repository);
      }
    );

    container.registerSingleton(
      DI_KEYS.INTERNAL_USER_CONTROLLER,
      () => {
        const useCase = container.getSingleton<UserUseCase>(
          DI_KEYS.INTERNAL_USER_USECASE
        );
        return new UserController(useCase);
      }
    );

    const controller = container.getSingleton<UserController>(
      DI_KEYS.INTERNAL_USER_CONTROLLER
    );

    // createTestAppでアプリケーションを作成
    app = createTestApp("/users")
      .get("/", async () => await controller.getUsers())
      .get("/:id", async ({ params }) => await controller.getUserById(params.id))
      .post("/", async ({ body }) => await controller.createUser(body));
  });

  // テストケース...
});
```

### GET リクエストのテスト

```typescript
describe("GET /users", () => {
  it("全ユーザーを取得できる", async () => {
    // Setup
    // beforeEachで準備済み

    // Execute
    const response = await app.handle(
      new Request("http://localhost/users")
    );

    // Assert
    expect(response.status).toBe(200);

    const users = await response.json();
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe("Test User 1");
    expect(users[1].name).toBe("Test User 2");
  });
});
```

### POST リクエストのテスト

```typescript
describe("POST /users", () => {
  it("新しいユーザーを作成できる", async () => {
    // Setup
    const newUser = {
      name: "New User",
      username: "newuser",
      email: "newuser@example.com",
      company: { name: "New Company" },
    };

    // Execute
    const response = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })
    );

    // Assert
    expect(response.status).toBe(200);

    const createdUser = await response.json();
    expect(createdUser.id).toBeDefined();
    expect(createdUser.name).toBe("New User");
    expect(createdUser.email).toBe("newuser@example.com");

    // リポジトリにユーザーが追加されているか確認
    expect(mockRepository.getUserCount()).toBe(3);
  });
});
```

### エラーケースのテスト

```typescript
describe("GET /users/:id", () => {
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

### バリデーションエラーのテスト

```typescript
describe("POST /users", () => {
  it("必須フィールドが欠落している場合は422を返す", async () => {
    // Setup
    const invalidUser = {
      name: "Incomplete User",
      // username, email, company が欠落
    };

    // Execute
    const response = await app.handle(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidUser),
      })
    );

    // Assert
    expect(response.status).toBe(422);

    const error = await response.json();
    expect(error.error).toBe("ValidationError");
  });
});
```

---

## ベストプラクティス

### 1. Setup, Execute, Assertを明確に分離

**必須ルール**: すべてのテストに以下のコメントを追加します。

```typescript
it("テストの説明", async () => {
  // Setup
  // （準備のコード）

  // Execute
  // （実行のコード）

  // Assert
  // （検証のコード）
});
```

### 2. createTestAppを使用

テストアプリケーションは必ず`createTestApp`を使用して作成します。

```typescript
// 良い例
const app = createTestApp("/users");

// 悪い例
const app = new Elysia({ prefix: "/users" })
  .onError(...); // エラーハンドラーを毎回書くのはNG
```

### 3. beforeEachでセットアップ

各テストの前に初期化を行います。

```typescript
beforeEach(() => {
  container.reset();
  mockRepository = new MockUserRepository();
  mockRepository.setUsers(sampleUsers);
  // ...
});
```

### 4. 日本語のテスト説明

テストの説明は日本語で記述します。

```typescript
// 良い例
it("全ユーザーを取得できる", async () => {

// 悪い例
it("should return all users", async () => {
```

### 5. テストデータは明示的に

テストデータは各テストで明示的に作成します。

```typescript
// 良い例
const newUser = {
  name: "New User",
  username: "newuser",
  email: "newuser@example.com",
  company: { name: "New Company" },
};

// 悪い例
const newUser = createRandomUser(); // ランダムデータはNG
```

### 6. アサーションは具体的に

期待値は具体的に指定します。

```typescript
// 良い例
expect(user.name).toBe("Test User 1");
expect(users).toHaveLength(2);

// 悪い例
expect(user.name).toBeTruthy(); // あいまいな検証はNG
```

### 7. エラーメッセージも検証

エラーケースでは、エラーメッセージも検証します。

```typescript
// Assert
expect(response.status).toBe(404);

const error = await response.json();
expect(error.error).toBe("NotFoundError");
expect(error.message).toContain("User with id 999 not found");
```

---

## テストのチェックリスト

新しいテストを書く際は、以下を確認してください：

- [ ] `// Setup`, `// Execute`, `// Assert`のコメントが全て含まれている
- [ ] `createTestApp`を使用してアプリケーションを作成している
- [ ] モックリポジトリをDIコンテナに注入している
- [ ] テストの説明が日本語で記述されている
- [ ] beforeEachで初期化を行っている
- [ ] アサーションが具体的で明確である
- [ ] エラーケースをテストしている
- [ ] テストが独立している（他のテストに依存しない）

---

## まとめ

このプロジェクトのテストは、以下の原則に基づいています：

1. **AAAパターン**: Setup, Execute, Assertの3層構造
2. **createTestApp**: 共通設定を含むテストアプリの使用
3. **モックリポジトリ**: DIコンテナを活用したモック注入
4. **日本語の説明**: 可読性を重視したテスト記述
5. **明示的な検証**: 具体的なアサーション

これらの原則により、保守性が高く、読みやすいテストを実現しています。
