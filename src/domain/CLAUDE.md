# src/domain

## 概要

このディレクトリには、ドメイン層（ビジネスロジックの核心）を配置します。
ドメイン層は、アプリケーションの最も内側に位置し、他のどの層にも依存しません。
ビジネスルール、エンティティ、インターフェース、ドメイン固有のエラーなどを定義します。

## ディレクトリ構造

```
src/domain/
├── user/                    # Userドメイン
│   ├── entity.ts           # Userエンティティとスキーマ
│   └── valueObject.ts      # 値オブジェクト（例: Email, Password）
│
├── product/                 # Productドメイン（例）
│   ├── entity.ts
│   └── valueObject.ts
│
├── interface/              # インターフェース定義（依存性の逆転）
│   ├── repository/         # リポジトリインターフェース
│   │   ├── userRepository.ts
│   │   └── productRepository.ts
│   └── external/           # 外部サービスインターフェース
│       ├── emailService.ts
│       └── storageService.ts
│
└── errors/                 # ドメイン固有のエラー
    ├── httpErrors.ts       # HTTPエラー
    └── businessErrors.ts   # ビジネスロジックエラー
```

## ファイルの書き方

### 1. エンティティ (entity.ts)

エンティティは、ビジネスドメインの核心となるオブジェクトです。
Elysiaの`t`（Type Box）を使用してスキーマを定義し、`Infer`で型を推論します。

**基本構造**:

```typescript
import { t, type Static as Infer } from "elysia";

// 1. スキーマ定義（Elysiaで使用）
export const UserSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  email: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// 2. 型推論（TypeScriptで使用）
export type User = Infer<typeof UserSchema>;
```

**ネストされたオブジェクト**:

```typescript
// Companyスキーマ
export const CompanySchema = t.Object({
  name: t.String(),
  address: t.String(),
});

// Userスキーマ（Companyを含む）
export const UserSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  email: t.String(),
  company: CompanySchema,  // ネスト
});

export type Company = Infer<typeof CompanySchema>;
export type User = Infer<typeof UserSchema>;
```

**配列とオプショナル**:

```typescript
export const UserSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  email: t.String(),
  tags: t.Array(t.String()),              // 配列
  bio: t.Optional(t.String()),            // オプショナル
  socialLinks: t.Optional(t.Array(        // オプショナルな配列
    t.Object({
      platform: t.String(),
      url: t.String(),
    })
  )),
});
```

### 2. 値オブジェクト (valueObject.ts)

値オブジェクトは、ドメイン固有の値を表現するオブジェクトです。
不変性とバリデーションロジックを持ちます。

**Email値オブジェクト**:

```typescript
export class Email {
  private constructor(private readonly value: string) {}

  static create(value: string): Email {
    if (!this.isValid(value)) {
      throw new Error("Invalid email format");
    }
    return new Email(value);
  }

  private static isValid(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
```

**Password値オブジェクト**:

```typescript
export class Password {
  private constructor(private readonly hashedValue: string) {}

  static async create(plainPassword: string): Promise<Password> {
    if (!this.isValid(plainPassword)) {
      throw new Error("Password must be at least 8 characters");
    }
    const hashed = await this.hash(plainPassword);
    return new Password(hashed);
  }

  private static isValid(password: string): boolean {
    return password.length >= 8;
  }

  private static async hash(password: string): Promise<string> {
    // bcryptなどでハッシュ化
    return await Bun.password.hash(password);
  }

  async verify(plainPassword: string): Promise<boolean> {
    return await Bun.password.verify(plainPassword, this.hashedValue);
  }

  getHashedValue(): string {
    return this.hashedValue;
  }
}
```

### 3. エラー (errors/)

ドメイン固有のエラーを定義します。

**HTTPエラー** (`errors/httpErrors.ts`):

```typescript
// ベースクラス
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

// 具体的なエラー
export class BadRequestError extends HttpError {
  constructor(message: string = "Bad Request", details?: any) {
    super(400, message, details);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string = "Unauthorized", details?: any) {
    super(401, message, details);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string = "Forbidden", details?: any) {
    super(403, message, details);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = "Not Found", details?: any) {
    super(404, message, details);
    this.name = "NotFoundError";
  }
}

export class InternalServerError extends HttpError {
  constructor(message: string = "Internal Server Error", details?: any) {
    super(500, message, details);
    this.name = "InternalServerError";
  }
}
```

**ビジネスロジックエラー** (`errors/businessErrors.ts`):

```typescript
// ビジネスルール違反
export class BusinessRuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleViolationError";
  }
}

// 重複エラー
export class DuplicateError extends BusinessRuleViolationError {
  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`);
    this.name = "DuplicateError";
  }
}

// 無効な操作
export class InvalidOperationError extends BusinessRuleViolationError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOperationError";
  }
}
```

## 実装例

### 完全なUserドメイン

**user/entity.ts**:

```typescript
import { t, type Static as Infer } from "elysia";

// Address値オブジェクトスキーマ
export const AddressSchema = t.Object({
  street: t.String(),
  city: t.String(),
  state: t.String(),
  zipCode: t.String(),
  country: t.String(),
});

// Company値オブジェクトスキーマ
export const CompanySchema = t.Object({
  name: t.String(),
  address: t.Optional(AddressSchema),
});

// Userエンティティスキーマ
export const UserSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  email: t.String(),
  role: t.Union([
    t.Literal("admin"),
    t.Literal("user"),
    t.Literal("guest"),
  ]),
  company: t.Optional(CompanySchema),
  isActive: t.Boolean({ default: true }),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// 型推論
export type Address = Infer<typeof AddressSchema>;
export type Company = Infer<typeof CompanySchema>;
export type User = Infer<typeof UserSchema>;
export type UserRole = "admin" | "user" | "guest";
```

**user/valueObject.ts**:

```typescript
// Email値オブジェクト
export class Email {
  private constructor(private readonly value: string) {}

  static create(value: string): Email {
    if (!this.isValid(value)) {
      throw new Error("Invalid email format");
    }
    return new Email(value.toLowerCase());
  }

  private static isValid(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  getValue(): string {
    return this.value;
  }

  getDomain(): string {
    return this.value.split("@")[1];
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

// UserRole値オブジェクト
export class UserRole {
  private static readonly VALID_ROLES = ["admin", "user", "guest"] as const;

  private constructor(private readonly value: typeof UserRole.VALID_ROLES[number]) {}

  static create(value: string): UserRole {
    if (!this.isValid(value)) {
      throw new Error(`Invalid role: ${value}`);
    }
    return new UserRole(value as typeof UserRole.VALID_ROLES[number]);
  }

  private static isValid(value: string): boolean {
    return this.VALID_ROLES.includes(value as any);
  }

  getValue(): string {
    return this.value;
  }

  isAdmin(): boolean {
    return this.value === "admin";
  }

  canManageUsers(): boolean {
    return this.value === "admin";
  }
}
```

## 命名規則

### ファイル名
- `entity.ts`: エンティティ定義
- `valueObject.ts`: 値オブジェクト定義
- `{domain}Error.ts`: ドメイン固有のエラー

### ディレクトリ名
- `{domain}/`: ドメイン名（小文字、単数形）
  - 例: `user/`, `product/`, `order/`

### 型名
- エンティティ: `PascalCase`（例: `User`, `Product`）
- スキーマ: `{Entity}Schema`（例: `UserSchema`, `ProductSchema`）
- 値オブジェクト: `PascalCase`（例: `Email`, `Password`）

## ベストプラクティス

### 1. 単一ソースの原則

スキーマから型を推論し、重複を避けます。

```typescript
// 良い例：スキーマから型を推論
export const UserSchema = t.Object({ ... });
export type User = Infer<typeof UserSchema>;

// 悪い例：スキーマと型を別々に定義
export const UserSchema = t.Object({ ... });
export type User = { ... };  // 重複
```

### 2. ドメインロジックはドメイン層に

ビジネスルールはドメイン層に配置します。

```typescript
// 良い例：ドメイン層でバリデーション
export class Email {
  static create(value: string): Email {
    if (!this.isValid(value)) {
      throw new Error("Invalid email");
    }
    return new Email(value);
  }
}

// 悪い例：UseCase層でバリデーション
class UserUseCase {
  createUser(email: string) {
    if (!isValidEmail(email)) {  // NG
      throw new Error("Invalid email");
    }
  }
}
```

### 3. 不変性を保つ

値オブジェクトは不変にします。

```typescript
// 良い例：不変
export class Email {
  private constructor(private readonly value: string) {}
  getValue(): string { return this.value; }
}

// 悪い例：可変
export class Email {
  public value: string;  // NG: 外部から変更可能
}
```

### 4. インターフェースで依存性を逆転

ドメイン層でインターフェースを定義し、Infrastructure層で実装します。

```typescript
// src/domain/interface/repository/userRepository.ts
export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}

// src/infrastructure/repository/userRepository.ts
export class UserRepository implements IUserRepository {
  async findById(id: number): Promise<User | null> { ... }
  async create(data: CreateUserData): Promise<User> { ... }
}
```

### 5. 型安全なEnum

`t.Union`と`t.Literal`を使用して型安全なEnumを作成します。

```typescript
// スキーマ
export const UserRoleSchema = t.Union([
  t.Literal("admin"),
  t.Literal("user"),
  t.Literal("guest"),
]);

export const UserSchema = t.Object({
  id: t.Number(),
  role: UserRoleSchema,
});

// 型推論
export type UserRole = Infer<typeof UserRoleSchema>;
// "admin" | "user" | "guest"
```

## 注意事項

### 1. 他の層に依存しない

ドメイン層は、Infrastructure層やAPI層に依存してはいけません。

```typescript
// 悪い例：Infrastructure層に依存
import { UserRepository } from "../../infrastructure/repository/userRepository";  // NG

// 良い例：インターフェースに依存
import { IUserRepository } from "../interface/repository/userRepository";  // OK
```

### 2. フレームワーク非依存

ドメインロジックはElysiaに依存しない設計にします（スキーマ定義を除く）。

```typescript
// 良い例：フレームワーク非依存
export class Email {
  static create(value: string): Email { ... }
}

// 悪い例：Elysiaに依存
import { Context } from "elysia";  // NG: ドメイン層でフレームワークに依存
```

### 3. ビジネスルールの集約

関連するビジネスルールは、同じエンティティまたは値オブジェクトに集約します。

```typescript
// 良い例：Userエンティティにビジネスルールを集約
export class User {
  canEditProfile(requestUserId: number): boolean {
    return this.id === requestUserId || this.role === "admin";
  }

  canDeleteUser(requestUserRole: string): boolean {
    return requestUserRole === "admin";
  }
}
```

## Type Boxの主な型

```typescript
// プリミティブ型
t.String()
t.Number()
t.Boolean()
t.Date()
t.Null()

// 構造型
t.Object({ key: t.String() })
t.Array(t.String())
t.Tuple([t.String(), t.Number()])

// ユニオン・リテラル
t.Union([t.String(), t.Number()])
t.Literal("admin")

// オプショナル・デフォルト
t.Optional(t.String())
t.String({ default: "hello" })

// 数値・文字列の制約
t.Number({ minimum: 0, maximum: 100 })
t.String({ minLength: 1, maxLength: 255 })
t.String({ pattern: "^[a-zA-Z]+$" })

// 複雑な型
t.Record(t.String(), t.Number())  // { [key: string]: number }
t.Partial(t.Object({ ... }))      // 全フィールドがoptional
t.Required(t.Object({ ... }))     // 全フィールドがrequired
```

## まとめ

- **エンティティ**: Type Boxでスキーマ定義 → `Infer`で型推論
- **値オブジェクト**: 不変性とバリデーションロジックを持つクラス
- **エラー**: ドメイン固有のエラークラスを定義
- **インターフェース**: `src/domain/interface/`で定義
- **依存の方向**: ドメイン層は他の層に依存しない（最も内側）
- **ビジネスロジック**: ドメイン層に集約

ドメイン層を適切に設計することで、ビジネスロジックが明確になり、保守性の高いコードを実現できます。
