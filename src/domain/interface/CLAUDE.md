# src/domain/interface

## 概要

このディレクトリには、依存性の逆転原則(Dependency Inversion Principle)に基づいたインターフェース定義を配置します。
ドメイン層がInfrastructure層に依存しないように、ドメイン層でインターフェースを定義し、Infrastructure層で実装します。

## ディレクトリ構造

```
src/domain/interface/
├── repository/              # データベース関連のインターフェース
│   ├── userRepository.ts
│   ├── productRepository.ts
│   └── orderRepository.ts
│
└── external/               # 外部サービス関連のインターフェース
    ├── emailService.ts     # メール送信（SES, SendGridなど）
    ├── storageService.ts   # ストレージ（S3, GoogleDriveなど）
    ├── paymentService.ts   # 決済（Stripe, PayPalなど）
    └── notificationService.ts  # 通知（Firebase, Twilio）
```

## Repository vs External

### Repository
- **用途**: RDBMS（PostgreSQL, MySQL）などのデータベース関連
- **特徴**: CRUD操作、クエリ、トランザクション
- **例**: UserRepository, ProductRepository, OrderRepository

### External
- **用途**: 外部API/SDK（AWS、Google Cloud、サードパーティサービス）
- **特徴**: メール送信、ファイルアップロード、決済処理など
- **例**: EmailService, StorageService, PaymentService

## ファイルの書き方

### 1. Repository インターフェース

**基本構造**:

```typescript
import type { User } from "../../user/entity";
import type { CreateUserBody, UpdateUserBody, PatchUserBody } from "../../../api/public/users/requests";

export interface IUserRepository {
  // 検索
  findAll(): Promise<User[]>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;

  // 作成
  create(data: CreateUserBody): Promise<User>;

  // 更新
  update(id: number, data: UpdateUserBody): Promise<User>;
  patch(id: number, data: PatchUserBody): Promise<User | null>;

  // 削除
  delete(id: number): Promise<boolean>;
}
```

### 2. External インターフェース

**メールサービス**:

```typescript
export interface IEmailService {
  sendEmail(params: SendEmailParams): Promise<void>;
  sendTemplateEmail(params: SendTemplateEmailParams): Promise<void>;
  sendBulkEmails(params: SendBulkEmailsParams): Promise<void>;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendTemplateEmailParams {
  to: string | string[];
  templateId: string;
  templateData: Record<string, any>;
  from?: string;
}

export interface SendBulkEmailsParams {
  emails: Array<{
    to: string;
    subject: string;
    body: string;
  }>;
  from?: string;
}
```

**ストレージサービス**:

```typescript
export interface IStorageService {
  upload(params: UploadParams): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  listFiles(prefix?: string): Promise<string[]>;
}

export interface UploadParams {
  key: string;              // ファイルパス/キー
  body: Buffer | ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: "private" | "public-read";
}

export interface UploadResult {
  key: string;
  url: string;
  etag?: string;
}
```

## 実装例

### 1. UserRepository インターフェース

**src/domain/interface/repository/userRepository.ts**:

```typescript
import type { User } from "../../user/entity";
import type {
  CreateUserBody,
  UpdateUserBody,
  PatchUserBody,
} from "../../../api/public/users/requests";

export interface IUserRepository {
  // --- 検索メソッド ---
  findAll(): Promise<User[]>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByRole(role: string): Promise<User[]>;

  // ページネーション付き検索
  findMany(params: FindManyParams): Promise<PaginatedResult<User>>;

  // --- 作成メソッド ---
  create(data: CreateUserBody): Promise<User>;
  createMany(data: CreateUserBody[]): Promise<User[]>;

  // --- 更新メソッド ---
  update(id: number, data: UpdateUserBody): Promise<User>;
  patch(id: number, data: PatchUserBody): Promise<User | null>;

  // --- 削除メソッド ---
  delete(id: number): Promise<boolean>;
  deleteMany(ids: number[]): Promise<number>;  // 削除件数を返す

  // --- ユーティリティメソッド ---
  exists(id: number): Promise<boolean>;
  count(): Promise<number>;
}

// ページネーション用の型
export interface FindManyParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 2. EmailService インターフェース

**src/domain/interface/external/emailService.ts**:

```typescript
export interface IEmailService {
  // 単一メール送信
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;

  // テンプレートメール送信
  sendTemplateEmail(params: SendTemplateEmailParams): Promise<SendEmailResult>;

  // 一括メール送信
  sendBulkEmails(params: SendBulkEmailsParams): Promise<SendBulkEmailsResult>;

  // メール送信履歴の確認
  checkEmailStatus(messageId: string): Promise<EmailStatus>;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;            // HTMLボディ
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;  // メタデータ
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface SendTemplateEmailParams {
  to: string | string[];
  templateId: string;
  templateData: Record<string, any>;
  from?: string;
  replyTo?: string;
}

export interface SendBulkEmailsParams {
  emails: Array<{
    to: string;
    subject: string;
    body: string;
    html?: string;
    templateData?: Record<string, any>;
  }>;
  from?: string;
}

export interface SendEmailResult {
  messageId: string;
  status: "sent" | "queued" | "failed";
  timestamp: Date;
}

export interface SendBulkEmailsResult {
  successCount: number;
  failureCount: number;
  results: SendEmailResult[];
}

export type EmailStatus = "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained";
```

### 3. StorageService インターフェース

**src/domain/interface/external/storageService.ts**:

```typescript
export interface IStorageService {
  // アップロード
  upload(params: UploadParams): Promise<UploadResult>;
  uploadMultiple(params: UploadParams[]): Promise<UploadResult[]>;

  // ダウンロード
  download(key: string): Promise<Buffer>;
  downloadAsStream(key: string): Promise<ReadableStream>;

  // 削除
  delete(key: string): Promise<void>;
  deleteMultiple(keys: string[]): Promise<DeleteResult>;

  // URL生成
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): string;

  // リスト・検索
  listFiles(params?: ListFilesParams): Promise<FileInfo[]>;
  exists(key: string): Promise<boolean>;

  // メタデータ
  getMetadata(key: string): Promise<FileMetadata>;
  updateMetadata(key: string, metadata: Record<string, string>): Promise<void>;

  // コピー・移動
  copy(sourceKey: string, destinationKey: string): Promise<void>;
  move(sourceKey: string, destinationKey: string): Promise<void>;
}

export interface UploadParams {
  key: string;
  body: Buffer | ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: "private" | "public-read" | "public-read-write";
  cacheControl?: string;
  contentDisposition?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  etag?: string;
  versionId?: string;
  size: number;
}

export interface DeleteResult {
  deletedCount: number;
  errors: Array<{ key: string; error: string }>;
}

export interface ListFilesParams {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  storageClass?: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  metadata: Record<string, string>;
  etag: string;
}
```

### 4. PaymentService インターフェース

**src/domain/interface/external/paymentService.ts**:

```typescript
export interface IPaymentService {
  // 決済作成
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;

  // 決済確認
  confirmPayment(paymentId: string): Promise<PaymentStatus>;

  // 返金
  refund(params: RefundParams): Promise<RefundResult>;

  // 決済履歴
  getPaymentHistory(customerId: string): Promise<Payment[]>;

  // 顧客管理
  createCustomer(params: CreateCustomerParams): Promise<Customer>;
  updateCustomer(customerId: string, params: UpdateCustomerParams): Promise<Customer>;
}

export interface CreatePaymentParams {
  amount: number;
  currency: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
  paymentMethod?: string;
}

export interface PaymentResult {
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  createdAt: Date;
  clientSecret?: string;  // フロントエンドで使用
}

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "refunded";

export interface RefundParams {
  paymentId: string;
  amount?: number;  // 未指定の場合は全額返金
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  status: "succeeded" | "failed";
  amount: number;
  createdAt: Date;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description?: string;
  createdAt: Date;
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface UpdateCustomerParams {
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}
```

## 命名規則

### インターフェース名
- **Repository**: `I{Entity}Repository`（例: `IUserRepository`）
- **External**: `I{Service}Service`（例: `IEmailService`）

### ファイル名
- **Repository**: `{entity}Repository.ts`（例: `userRepository.ts`）
- **External**: `{service}Service.ts`（例: `emailService.ts`）

### メソッド名
- **検索**: `find*`, `get*`（例: `findById`, `getAll`）
- **作成**: `create*`（例: `create`, `createMany`）
- **更新**: `update*`, `patch*`（例: `update`, `patch`）
- **削除**: `delete*`, `remove*`（例: `delete`, `deleteMany`）
- **存在確認**: `exists*`, `has*`（例: `exists`, `hasPermission`）
- **カウント**: `count*`（例: `count`, `countByStatus`）

## ベストプラクティス

### 1. 戻り値は明示的に

Promiseの型を明示的に指定します。

```typescript
// 良い例：戻り値の型を明示
findById(id: number): Promise<User | null>;

// 悪い例：戻り値の型なし
findById(id: number);
```

### 2. null vs undefined

存在しない場合は`null`を返します（`undefined`ではなく）。

```typescript
// 良い例
findById(id: number): Promise<User | null>;

// 悪い例
findById(id: number): Promise<User | undefined>;
```

### 3. パラメータは型定義

複雑なパラメータは別途型定義します。

```typescript
// 良い例：パラメータを型定義
export interface CreateUserParams {
  name: string;
  email: string;
  role: string;
}

create(params: CreateUserParams): Promise<User>;

// 悪い例：直接定義
create(name: string, email: string, role: string): Promise<User>;
```

### 4. オプショナルパラメータ

デフォルト値が必要な場合は、オプショナルにします。

```typescript
export interface FindManyParams {
  page?: number;        // オプショナル（デフォルト: 1）
  limit?: number;       // オプショナル（デフォルト: 10）
  sortBy?: string;      // オプショナル
}
```

### 5. 一貫性のある命名

同じ操作には同じ命名を使用します。

```typescript
// 良い例：一貫性のある命名
interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}

// 悪い例：バラバラの命名
interface IUserRepository {
  findById(id: number): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;  // NG
}
```

## 注意事項

### 1. Infrastructure層に依存しない

インターフェースは具体的な実装に依存してはいけません。

```typescript
// 悪い例：具体的な実装に依存
import { PrismaClient } from "@prisma/client";  // NG

export interface IUserRepository {
  prisma: PrismaClient;  // NG
}

// 良い例：抽象的なインターフェース
export interface IUserRepository {
  findById(id: number): Promise<User | null>;
}
```

### 2. ビジネスロジックは含まない

インターフェースはメソッド定義のみ、ビジネスロジックは含みません。

```typescript
// 悪い例：ビジネスロジックを含む
export interface IUserRepository {
  canDeleteUser(userId: number, requestUserId: number): boolean;  // NG
}

// 良い例：データアクセスのみ
export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  delete(id: number): Promise<boolean>;
}
```

### 3. 型のインポートは`type`を使用

型のインポートには`type`キーワードを使用します。

```typescript
// 良い例
import type { User } from "../../user/entity";

// 悪い例
import { User } from "../../user/entity";
```

## 依存性の逆転原則の図

```
┌─────────────────────────────────┐
│  Domain Layer                   │
│  (ビジネスロジック)             │
│  ┌───────────────────────────┐  │
│  │  IUserRepository          │  │ ← インターフェース定義
│  └───────────────────────────┘  │
└─────────────┬───────────────────┘
              │ 依存
              ↓
┌─────────────────────────────────┐
│  Infrastructure Layer           │
│  (具体的な実装)                 │
│  ┌───────────────────────────┐  │
│  │  UserRepository           │  │ ← インターフェース実装
│  │  implements IUserRepository│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## まとめ

- **Repository**: RDBMS関連のインターフェース
- **External**: 外部API/SDK関連のインターフェース
- **命名**: `I{Entity}Repository`, `I{Service}Service`
- **戻り値**: 明示的な型定義、`null` vs `undefined`
- **依存性の逆転**: ドメイン層でインターフェース定義、Infrastructure層で実装
- **一貫性**: 統一された命名規則とパターン

インターフェースを適切に定義することで、テスタビリティが向上し、実装の差し替えが容易になります。
