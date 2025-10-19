# src/infrastructure

## 概要

このディレクトリには、インフラストラクチャ層（外部システムとの接続）の実装を配置します。
ドメイン層で定義されたインターフェース（`src/domain/interface/`）の具体的な実装を提供します。

## ディレクトリ構造

```
src/infrastructure/
├── repository/                 # データベース関連の実装
│   ├── userRepository.ts      # InMemory / RDBMSの実装
│   ├── productRepository.ts
│   └── orderRepository.ts
│
├── external/                  # 外部サービス関連の実装
│   ├── ses/                  # AWS SES（メール送信）
│   │   └── sesEmailService.ts
│   ├── sendgrid/            # SendGrid（メール送信）
│   │   └── sendgridEmailService.ts
│   ├── s3/                  # AWS S3（ストレージ）
│   │   └── s3StorageService.ts
│   ├── googleDrive/         # Google Drive（ストレージ）
│   │   └── driveStorageService.ts
│   └── stripe/              # Stripe（決済）
│       └── stripePaymentService.ts
│
└── database/                 # データベース接続設定
    ├── prisma.ts            # Prisma Client
    └── migrations/          # マイグレーションファイル
```

## Repository vs External

### Repository
- **用途**: RDBMS（PostgreSQL, MySQL）、NoSQL、InMemoryなど
- **実装**: Prisma、TypeORM、Drizzle、生SQLなど
- **例**: UserRepository, ProductRepository

### External
- **用途**: 外部API/SDK（AWS、GCP、サードパーティサービス）
- **実装**: AWS SDK、Google Cloud SDK、サードパーティクライアント
- **例**: SESEmailService, S3StorageService, StripePaymentService

## ファイルの書き方

### 1. Repository の実装

Repositoryは、`src/domain/interface/repository/`で定義されたインターフェースを実装します。

#### InMemory実装（開発・テスト用）

```typescript
import type { User } from "../../domain/user/entity";
import type {
  IUserRepository,
  FindManyParams,
  PaginatedResult,
} from "../../domain/interface/repository/userRepository";
import type {
  CreateUserBody,
  UpdateUserBody,
  PatchUserBody,
} from "../../api/public/users/requests";

export class InMemoryUserRepository implements IUserRepository {
  private users: User[] = [];
  private currentId = 1;

  async findAll(): Promise<User[]> {
    return this.users;
  }

  async findById(id: number): Promise<User | null> {
    const user = this.users.find(u => u.id === id);
    return user || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = this.users.find(u => u.email === email);
    return user || null;
  }

  async findMany(params: FindManyParams): Promise<PaginatedResult<User>> {
    const { page = 1, limit = 10, sortBy = "id", sortOrder = "asc" } = params;

    // ソート
    const sorted = [...this.users].sort((a, b) => {
      const aValue = a[sortBy as keyof User];
      const bValue = b[sortBy as keyof User];
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // ページネーション
    const start = (page - 1) * limit;
    const end = start + limit;
    const data = sorted.slice(start, end);

    return {
      data,
      total: this.users.length,
      page,
      limit,
      totalPages: Math.ceil(this.users.length / limit),
    };
  }

  async create(data: CreateUserBody): Promise<User> {
    const newUser: User = {
      id: this.currentId++,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  async update(id: number, data: UpdateUserBody): Promise<User> {
    const idx = this.users.findIndex(u => u.id === id);
    const updatedUser: User = {
      id,
      ...data,
      createdAt: this.users[idx]?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (idx === -1) {
      this.users.push(updatedUser);
    } else {
      this.users[idx] = updatedUser;
    }

    return updatedUser;
  }

  async patch(id: number, data: PatchUserBody): Promise<User | null> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    const current = this.users[idx];
    const patchedUser: User = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };

    this.users[idx] = patchedUser;
    return patchedUser;
  }

  async delete(id: number): Promise<boolean> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return false;

    this.users.splice(idx, 1);
    return true;
  }

  async exists(id: number): Promise<boolean> {
    return this.users.some(u => u.id === id);
  }

  async count(): Promise<number> {
    return this.users.length;
  }
}
```

#### Prisma実装（本番環境用）

```typescript
import type { User } from "../../domain/user/entity";
import type {
  IUserRepository,
  FindManyParams,
  PaginatedResult,
} from "../../domain/interface/repository/userRepository";
import type {
  CreateUserBody,
  UpdateUserBody,
  PatchUserBody,
} from "../../api/public/users/requests";
import { prisma } from "../database/prisma";

export class PrismaUserRepository implements IUserRepository {
  async findAll(): Promise<User[]> {
    return await prisma.user.findMany();
  }

  async findById(id: number): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  async findMany(params: FindManyParams): Promise<PaginatedResult<User>> {
    const { page = 1, limit = 10, sortBy = "id", sortOrder = "asc", filters = {} } = params;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where: filters,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where: filters }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: CreateUserBody): Promise<User> {
    return await prisma.user.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async update(id: number, data: UpdateUserBody): Promise<User> {
    return await prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async patch(id: number, data: PatchUserBody): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      // レコードが存在しない場合
      return null;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async exists(id: number): Promise<boolean> {
    const count = await prisma.user.count({
      where: { id },
    });
    return count > 0;
  }

  async count(): Promise<number> {
    return await prisma.user.count();
  }
}
```

### 2. External の実装

Externalは、`src/domain/interface/external/`で定義されたインターフェースを実装します。

#### AWS SES（メール送信）

```typescript
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type {
  IEmailService,
  SendEmailParams,
  SendEmailResult,
} from "../../../domain/interface/external/emailService";

export class SESEmailService implements IEmailService {
  private client: SESClient;

  constructor() {
    this.client = new SESClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { to, subject, body, html, from, cc, bcc } = params;

    const command = new SendEmailCommand({
      Source: from || process.env.DEFAULT_FROM_EMAIL!,
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to],
        CcAddresses: cc,
        BccAddresses: bcc,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: body,
            Charset: "UTF-8",
          },
          ...(html && {
            Html: {
              Data: html,
              Charset: "UTF-8",
            },
          }),
        },
      },
    });

    try {
      const response = await this.client.send(command);
      return {
        messageId: response.MessageId!,
        status: "sent",
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("SES send email error:", error);
      throw new Error("Failed to send email");
    }
  }

  async sendTemplateEmail(params: SendTemplateEmailParams): Promise<SendEmailResult> {
    // テンプレートメール送信の実装
    throw new Error("Not implemented");
  }

  async sendBulkEmails(params: SendBulkEmailsParams): Promise<SendBulkEmailsResult> {
    // 一括メール送信の実装
    throw new Error("Not implemented");
  }

  async checkEmailStatus(messageId: string): Promise<EmailStatus> {
    // メールステータスの確認
    throw new Error("Not implemented");
  }
}
```

#### AWS S3（ストレージ）

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  IStorageService,
  UploadParams,
  UploadResult,
  FileInfo,
} from "../../../domain/interface/external/storageService";

export class S3StorageService implements IStorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME!;
    this.client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    const { key, body, contentType, metadata, acl } = params;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
      ACL: acl,
    });

    try {
      const response = await this.client.send(command);

      return {
        key,
        url: `https://${this.bucket}.s3.amazonaws.com/${key}`,
        etag: response.ETag,
        size: Buffer.byteLength(body as Buffer),
      };
    } catch (error) {
      console.error("S3 upload error:", error);
      throw new Error("Failed to upload file");
    }
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);
      const chunks: Uint8Array[] = [];

      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error("S3 download error:", error);
      throw new Error("Failed to download file");
    }
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      console.error("S3 delete error:", error);
      throw new Error("Failed to delete file");
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async listFiles(params?: ListFilesParams): Promise<FileInfo[]> {
    const { prefix, maxKeys = 1000 } = params || {};

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    try {
      const response = await this.client.send(command);

      return (response.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size!,
        lastModified: obj.LastModified!,
        etag: obj.ETag!,
        storageClass: obj.StorageClass,
      }));
    } catch (error) {
      console.error("S3 list files error:", error);
      throw new Error("Failed to list files");
    }
  }

  async exists(key: string): Promise<boolean> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  // その他のメソッド実装
  async getMetadata(key: string): Promise<FileMetadata> { ... }
  async updateMetadata(key: string, metadata: Record<string, string>): Promise<void> { ... }
  async copy(sourceKey: string, destinationKey: string): Promise<void> { ... }
  async move(sourceKey: string, destinationKey: string): Promise<void> { ... }
}
```

## 命名規則

### クラス名
- **InMemory実装**: `InMemory{Entity}Repository`（例: `InMemoryUserRepository`）
- **Prisma実装**: `Prisma{Entity}Repository`（例: `PrismaUserRepository`）
- **External実装**: `{Provider}{Service}Service`（例: `SESEmailService`, `S3StorageService`）

### ファイル名
- **Repository**: `{entity}Repository.ts`（例: `userRepository.ts`）
- **External**: `{provider}/{service}Service.ts`（例: `ses/sesEmailService.ts`）

## ベストプラクティス

### 1. エラーハンドリング

適切なエラーハンドリングとロギングを実装します。

```typescript
async create(data: CreateUserBody): Promise<User> {
  try {
    return await prisma.user.create({ data });
  } catch (error) {
    console.error("Failed to create user:", error);

    // Prismaのエラーコードを確認
    if (error.code === "P2002") {
      throw new DuplicateError("User", "email", data.email);
    }

    throw new InternalServerError("Failed to create user");
  }
}
```

### 2. 環境変数の使用

設定値は環境変数から取得します。

```typescript
export class S3StorageService implements IStorageService {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME!;
    this.region = process.env.AWS_REGION || "us-east-1";

    if (!this.bucket) {
      throw new Error("S3_BUCKET_NAME is not defined");
    }
  }
}
```

### 3. リソースのクリーンアップ

必要に応じて、リソースのクリーンアップメソッドを実装します。

```typescript
export class PrismaUserRepository implements IUserRepository {
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }
}
```

### 4. テスト可能な設計

依存性を注入できるように設計します。

```typescript
// 良い例：依存性注入
export class S3StorageService implements IStorageService {
  constructor(
    private client: S3Client,
    private bucket: string
  ) {}
}

// テストで使用
const mockClient = new MockS3Client();
const service = new S3StorageService(mockClient, "test-bucket");
```

### 5. 複数実装の提供

同じインターフェースに対して複数の実装を提供します。

```typescript
// 開発環境: InMemory
export class InMemoryUserRepository implements IUserRepository { ... }

// 本番環境: Prisma
export class PrismaUserRepository implements IUserRepository { ... }

// テスト環境: Mock
export class MockUserRepository implements IUserRepository { ... }
```

## 注意事項

### 1. インターフェースを実装する

必ずドメイン層のインターフェースを実装します。

```typescript
// 良い例
export class PrismaUserRepository implements IUserRepository { ... }

// 悪い例
export class PrismaUserRepository { ... }  // インターフェースを実装していない
```

### 2. ドメインロジックを含まない

Infrastructure層にはビジネスロジックを含めません。

```typescript
// 悪い例：ビジネスロジックを含む
async create(data: CreateUserBody): Promise<User> {
  // NG: ビジネスルールはUseCase層で実装
  if (data.age < 18) {
    throw new Error("User must be 18 or older");
  }

  return await prisma.user.create({ data });
}

// 良い例：データアクセスのみ
async create(data: CreateUserBody): Promise<User> {
  return await prisma.user.create({ data });
}
```

### 3. シークレット情報の管理

APIキーやシークレットは環境変数で管理し、ハードコードしません。

```typescript
// 悪い例
const apiKey = "sk_live_xxxxx";  // NG

// 良い例
const apiKey = process.env.STRIPE_API_KEY!;
```

## まとめ

- **Repository**: RDBMS関連の実装（InMemory, Prisma, TypeORMなど）
- **External**: 外部サービスの実装（AWS SDK, Google Cloud SDKなど）
- **インターフェース実装**: 必ずドメイン層のインターフェースを実装
- **エラーハンドリング**: 適切なエラー処理とロギング
- **環境変数**: 設定値は環境変数から取得
- **複数実装**: 開発・本番・テスト用に複数の実装を提供

Infrastructure層を適切に実装することで、外部システムへの依存を分離し、テスタビリティの高いコードを実現できます。
