#!/usr/bin/env bun
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import * as readline from "readline/promises";

// =====================================
// ヘルパー関数
// =====================================

/**
 * 複数形を単数形に変換（簡易版）
 * 例: users -> user, products -> product
 */
function toSingular(plural: string): string {
  // sで終わる場合はsを取る
  if (plural.endsWith("ies")) {
    return plural.slice(0, -3) + "y"; // categories -> category
  }
  if (plural.endsWith("s")) {
    return plural.slice(0, -1); // users -> user
  }
  return plural;
}

/**
 * PascalCaseに変換
 * 例: user -> User, product -> Product
 */
function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * camelCaseに変換
 * 例: user -> user, product -> product
 */
function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * UPPER_SNAKE_CASEに変換
 * 例: user -> USER, product -> PRODUCT
 */
function toUpperSnakeCase(str: string): string {
  return str.toUpperCase();
}

// =====================================
// テンプレート生成関数
// =====================================

/**
 * src/domain/{entity}/entity.ts
 */
function generateEntityTemplate(entitySingular: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `import { t, type Static as Infer } from "elysia";

// ドメイン層: ${EntityName}エンティティの定義
export const ${EntityName}Schema = t.Object({
  id: t.Number(),
  name: t.String(),
  description: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// スキーマから型を推論
export type ${EntityName} = Infer<typeof ${EntityName}Schema>;
`;
}

/**
 * src/domain/interface/repository/{entity}Repository.ts
 */
function generateRepositoryInterfaceTemplate(entitySingular: string, entitiesPlural: string, scope: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `// リポジトリインターフェース（依存性の逆転）
import type { ${EntityName} } from "../../${entitySingular}/entity";
import type { Create${EntityName}Body, Update${EntityName}Body, Patch${EntityName}Body } from "../../../api/${scope}/${entitiesPlural}/requests";

export interface I${EntityName}Repository {
  findAll(): Promise<${EntityName}[]>;
  findById(id: number): Promise<${EntityName} | null>;
  create(data: Create${EntityName}Body): Promise<${EntityName}>;
  update(id: number, data: Update${EntityName}Body): Promise<${EntityName}>;
  patch(id: number, data: Patch${EntityName}Body): Promise<${EntityName} | null>;
  delete(id: number): Promise<boolean>;
}
`;
}

/**
 * src/infrastructure/repository/{entity}Repository.ts
 */
function generateRepositoryImplementationTemplate(entitySingular: string, entitiesPlural: string, scope: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `import type { ${EntityName} } from "../../domain/${entitySingular}/entity";
import type { Create${EntityName}Body, Update${EntityName}Body, Patch${EntityName}Body } from "../../api/${scope}/${entitiesPlural}/requests";
import type { I${EntityName}Repository } from "../../domain/interface/repository/${entitySingular}Repository";

// インメモリDB実装
export class InMemory${EntityName}Repository implements I${EntityName}Repository {
  private ${entitiesPlural}: ${EntityName}[] = [];

  async findAll(): Promise<${EntityName}[]> {
    return this.${entitiesPlural};
  }

  async findById(id: number): Promise<${EntityName} | null> {
    const ${entitySingular} = this.${entitiesPlural}.find((item) => item.id === id);
    return ${entitySingular} || null;
  }

  async create(data: Create${EntityName}Body): Promise<${EntityName}> {
    const nextId = this.${entitiesPlural}.length
      ? Math.max(...this.${entitiesPlural}.map((item) => item.id)) + 1
      : 1;
    const new${EntityName}: ${EntityName} = {
      id: nextId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.${entitiesPlural}.push(new${EntityName});
    return new${EntityName};
  }

  async update(id: number, data: Update${EntityName}Body): Promise<${EntityName}> {
    const idx = this.${entitiesPlural}.findIndex((item) => item.id === id);
    const updated${EntityName}: ${EntityName} = {
      id,
      ...data,
      createdAt: this.${entitiesPlural}[idx]?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (idx === -1) {
      this.${entitiesPlural}.push(updated${EntityName});
    } else {
      this.${entitiesPlural}[idx] = updated${EntityName};
    }

    return updated${EntityName};
  }

  async patch(id: number, data: Patch${EntityName}Body): Promise<${EntityName} | null> {
    const idx = this.${entitiesPlural}.findIndex((item) => item.id === id);
    if (idx === -1) return null;

    const current = this.${entitiesPlural}[idx];
    const patched${EntityName}: ${EntityName} = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };

    this.${entitiesPlural}[idx] = patched${EntityName};
    return patched${EntityName};
  }

  async delete(id: number): Promise<boolean> {
    const idx = this.${entitiesPlural}.findIndex((item) => item.id === id);
    if (idx === -1) return false;

    this.${entitiesPlural}.splice(idx, 1);
    return true;
  }
}
`;
}

/**
 * src/di/{entities}.ts
 */
function generateDITemplate(entitySingular: string, entitiesPlural: string, scope: string): string {
  const EntityName = toPascalCase(entitySingular);
  const ENTITY_UPPER = toUpperSnakeCase(entitySingular);

  return `import { container } from "./container";
import type { I${EntityName}Repository } from "../domain/interface/repository/${entitySingular}Repository";
import { InMemory${EntityName}Repository } from "../infrastructure/repository/${entitySingular}Repository";
import { ${EntityName}UseCase } from "../api/${scope}/${entitiesPlural}/usecase";
import { ${EntityName}Controller } from "../api/${scope}/${entitiesPlural}/controller";

// DIコンテナキー
export const DI_KEYS = {
  // Repositories
  INTERNAL_${ENTITY_UPPER}_REPOSITORY: "Internal${EntityName}Repository",

  // UseCases
  INTERNAL_${ENTITY_UPPER}_USECASE: "Internal${EntityName}UseCase",

  // Controllers
  INTERNAL_${ENTITY_UPPER}_CONTROLLER: "Internal${EntityName}Controller",
} as const;

// DIコンテナの初期化関数
export function initialize${EntityName}DI(): void {
  // Repository層をシングルトンとして登録
  container.registerSingleton<I${EntityName}Repository>(
    DI_KEYS.INTERNAL_${ENTITY_UPPER}_REPOSITORY,
    () => new InMemory${EntityName}Repository()
  );

  // UseCase層をシングルトンとして登録
  container.registerSingleton<${EntityName}UseCase>(
    DI_KEYS.INTERNAL_${ENTITY_UPPER}_USECASE,
    () => {
      const repository = container.getSingleton<I${EntityName}Repository>(
        DI_KEYS.INTERNAL_${ENTITY_UPPER}_REPOSITORY
      );
      return new ${EntityName}UseCase(repository);
    }
  );

  // Controller層をシングルトンとして登録
  container.registerSingleton<${EntityName}Controller>(
    DI_KEYS.INTERNAL_${ENTITY_UPPER}_CONTROLLER,
    () => {
      const useCase = container.getSingleton<${EntityName}UseCase>(
        DI_KEYS.INTERNAL_${ENTITY_UPPER}_USECASE
      );
      return new ${EntityName}Controller(useCase);
    }
  );
}

// 便利なヘルパー関数
export function getInternal${EntityName}Controller(): ${EntityName}Controller {
  return container.getSingleton<${EntityName}Controller>(
    DI_KEYS.INTERNAL_${ENTITY_UPPER}_CONTROLLER
  );
}
`;
}

/**
 * src/api/{scope}/{entities}/requests.ts
 */
function generateRequestsTemplate(entitySingular: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `import { t, type Static as Infer } from "elysia";

// POSTリクエストのボディスキーマ（idは自動生成されるため含まない）
export const Create${EntityName}BodySchema = t.Object({
  name: t.String(),
  description: t.String(),
});

// PUT/PATCHリクエストのパラメータスキーマ
export const ${EntityName}IdParamSchema = t.Object({
  id: t.Number(),
});

// PUTリクエストのボディスキーマ（全置換）
export const Update${EntityName}BodySchema = t.Object({
  name: t.String(),
  description: t.String(),
});

// PATCHリクエストのボディスキーマ（部分更新）
export const Patch${EntityName}BodySchema = t.Partial(
  t.Object({
    name: t.String(),
    description: t.String(),
  })
);

// スキーマから型を推論
export type Create${EntityName}Body = Infer<typeof Create${EntityName}BodySchema>;
export type ${EntityName}IdParam = Infer<typeof ${EntityName}IdParamSchema>;
export type Update${EntityName}Body = Infer<typeof Update${EntityName}BodySchema>;
export type Patch${EntityName}Body = Infer<typeof Patch${EntityName}BodySchema>;
`;
}

/**
 * src/api/{scope}/{entities}/responses.ts
 */
function generateResponsesTemplate(entitySingular: string, entitiesPlural: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `import { t, type Static as Infer } from "elysia";
import { ${EntityName}Schema } from "../../../domain/${entitySingular}/entity";

// 単一${EntityName}のレスポンススキーマ
export const ${EntityName}ResponseSchema = ${EntityName}Schema;

// ${EntityName}リストのレスポンススキーマ
export const ${EntityName}ListResponseSchema = t.Array(${EntityName}Schema);

// 削除成功時のレスポンススキーマ
export const DeleteResponseSchema = t.Void();

// スキーマから型を推論
export type ${EntityName}Response = Infer<typeof ${EntityName}ResponseSchema>;
export type ${EntityName}ListResponse = Infer<typeof ${EntityName}ListResponseSchema>;
export type DeleteResponse = Infer<typeof DeleteResponseSchema>;
`;
}

/**
 * src/api/{scope}/{entities}/usecase.ts
 */
function generateUseCaseTemplate(entitySingular: string, entitiesPlural: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `import type { ${EntityName} } from "../../../domain/${entitySingular}/entity";
import type { Create${EntityName}Body, Update${EntityName}Body, Patch${EntityName}Body } from "./requests";
import { NotFoundError } from "../../../domain/errors/httpErrors";
import type { I${EntityName}Repository } from "../../../domain/interface/repository/${entitySingular}Repository";

// UseCaseクラス: ビジネスロジックを記述
export class ${EntityName}UseCase {
  constructor(private repository: I${EntityName}Repository) {}

  // ${EntityName}リスト取得
  async get${EntityName}s(): Promise<${EntityName}[]> {
    return await this.repository.findAll();
  }

  // 単一${EntityName}取得
  async get${EntityName}ById(id: number): Promise<${EntityName}> {
    const ${entitySingular} = await this.repository.findById(id);
    if (!${entitySingular}) {
      throw new NotFoundError(\`${EntityName} with id \${id} not found\`);
    }
    return ${entitySingular};
  }

  // ${EntityName}作成
  async create${EntityName}(data: Create${EntityName}Body): Promise<${EntityName}> {
    // ここでビジネスロジックを追加可能（例: バリデーション、重複チェックなど）
    return await this.repository.create(data);
  }

  // ${EntityName}全置換
  async update${EntityName}(id: number, data: Update${EntityName}Body): Promise<${EntityName}> {
    return await this.repository.update(id, data);
  }

  // ${EntityName}部分更新
  async patch${EntityName}(id: number, data: Patch${EntityName}Body): Promise<${EntityName}> {
    const ${entitySingular} = await this.repository.patch(id, data);
    if (!${entitySingular}) {
      throw new NotFoundError(\`${EntityName} with id \${id} not found\`);
    }
    return ${entitySingular};
  }

  // ${EntityName}削除
  async delete${EntityName}(id: number): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError(\`${EntityName} with id \${id} not found\`);
    }
  }
}
`;
}

/**
 * src/api/{scope}/{entities}/controller.ts
 */
function generateControllerTemplate(entitySingular: string, entitiesPlural: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `import type { ${EntityName}UseCase } from "./usecase";
import type { Create${EntityName}Body, Update${EntityName}Body, Patch${EntityName}Body } from "./requests";
import type { ${EntityName} } from "../../../domain/${entitySingular}/entity";

// Controllerクラス: HTTPリクエスト/レスポンスを処理
export class ${EntityName}Controller {
  constructor(private useCase: ${EntityName}UseCase) {}

  // GET /${entitiesPlural}
  async get${EntityName}s(): Promise<${EntityName}[]> {
    return await this.useCase.get${EntityName}s();
  }

  // GET /${entitiesPlural}/:id
  async get${EntityName}ById(id: number): Promise<${EntityName}> {
    return await this.useCase.get${EntityName}ById(id);
  }

  // POST /${entitiesPlural}
  async create${EntityName}(body: Create${EntityName}Body): Promise<${EntityName}> {
    return await this.useCase.create${EntityName}(body);
  }

  // PUT /${entitiesPlural}/:id
  async update${EntityName}(id: number, body: Update${EntityName}Body): Promise<${EntityName}> {
    return await this.useCase.update${EntityName}(id, body);
  }

  // PATCH /${entitiesPlural}/:id
  async patch${EntityName}(id: number, body: Patch${EntityName}Body): Promise<${EntityName}> {
    return await this.useCase.patch${EntityName}(id, body);
  }

  // DELETE /${entitiesPlural}/:id
  async delete${EntityName}(id: number): Promise<void> {
    await this.useCase.delete${EntityName}(id);
  }
}
`;
}

/**
 * src/api/{scope}/{entities}/router.ts
 */
function generateRouterTemplate(entitySingular: string, entitiesPlural: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `import { Elysia } from "elysia";
import {
  Create${EntityName}BodySchema,
  Update${EntityName}BodySchema,
  ${EntityName}IdParamSchema,
  Patch${EntityName}BodySchema,
} from "./requests";
import {
  ${EntityName}ResponseSchema,
  ${EntityName}ListResponseSchema,
  DeleteResponseSchema,
} from "./responses";
import { errorHandler } from "../../middleware/errorHandler";
import {
  initialize${EntityName}DI,
  getInternal${EntityName}Controller,
} from "../../../di/${entitiesPlural}";

// DIコンテナの初期化
initialize${EntityName}DI();

// DIコンテナからControllerを取得
const controller = getInternal${EntityName}Controller();

// ルーター定義
export const ${entitySingular}Router = new Elysia({ prefix: "/${entitiesPlural}" })
  .use(errorHandler) // エラーハンドリングミドルウェアを適用
  // GET /${entitiesPlural} - ${EntityName}リスト取得
  .get("/", async () => await controller.get${EntityName}s(), {
    response: ${EntityName}ListResponseSchema,
  })
  // GET /${entitiesPlural}/:id - 単一${EntityName}取得
  .get(
    "/:id",
    async ({ params }) => await controller.get${EntityName}ById(params.id),
    {
      params: ${EntityName}IdParamSchema,
      response: ${EntityName}ResponseSchema,
    }
  )
  // POST /${entitiesPlural} - ${EntityName}作成
  .post("/", async ({ body }) => await controller.create${EntityName}(body), {
    body: Create${EntityName}BodySchema,
    response: ${EntityName}ResponseSchema,
  })
  // PUT /${entitiesPlural}/:id - ${EntityName}全置換
  .put(
    "/:id",
    async ({ params, body }) =>
      await controller.update${EntityName}(params.id, body),
    {
      params: ${EntityName}IdParamSchema,
      body: Update${EntityName}BodySchema,
      response: ${EntityName}ResponseSchema,
    }
  )
  // PATCH /${entitiesPlural}/:id - ${EntityName}部分更新
  .patch(
    "/:id",
    async ({ params, body }) =>
      await controller.patch${EntityName}(params.id, body),
    {
      params: ${EntityName}IdParamSchema,
      body: Patch${EntityName}BodySchema,
      response: ${EntityName}ResponseSchema,
    }
  )
  // DELETE /${entitiesPlural}/:id - ${EntityName}削除
  .delete(
    "/:id",
    async ({ params }) => await controller.delete${EntityName}(params.id),
    {
      params: ${EntityName}IdParamSchema,
      response: DeleteResponseSchema,
    }
  );
`;
}

/**
 * test/{entities}.test.ts
 */
function generateTestTemplate(entitySingular: string, entitiesPlural: string, scope: string): string {
  const EntityName = toPascalCase(entitySingular);
  const ENTITY_UPPER = toUpperSnakeCase(entitySingular);

  return `import { describe, expect, it, beforeEach } from "bun:test";
import { container } from "../src/di/container";
import { DI_KEYS } from "../src/di/${entitiesPlural}";
import { Mock${EntityName}Repository } from "./mocks/mock${EntityName}Repository";
import { ${EntityName}UseCase } from "../src/api/${scope}/${entitiesPlural}/usecase";
import { ${EntityName}Controller } from "../src/api/${scope}/${entitiesPlural}/controller";
import { createTestApp } from "./helpers/createTestApp";
import {
  Create${EntityName}BodySchema,
  Update${EntityName}BodySchema,
  Patch${EntityName}BodySchema,
  ${EntityName}IdParamSchema,
} from "../src/api/${scope}/${entitiesPlural}/requests";
import {
  ${EntityName}ResponseSchema,
  ${EntityName}ListResponseSchema,
  DeleteResponseSchema,
} from "../src/api/${scope}/${entitiesPlural}/responses";
import type { ${EntityName} } from "../src/domain/${entitySingular}/entity";

describe("${EntityName} API Endpoints", () => {
  let app: any;
  let mockRepository: Mock${EntityName}Repository;

  // テスト用のサンプルデータ
  const sample${EntityName}s: ${EntityName}[] = [
    {
      id: 1,
      name: "Test ${EntityName} 1",
      description: "Description for test ${entitySingular} 1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: "Test ${EntityName} 2",
      description: "Description for test ${entitySingular} 2",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    // DIコンテナをリセット
    container.reset();

    // モックリポジトリを作成
    mockRepository = new Mock${EntityName}Repository();
    mockRepository.set${EntityName}s(sample${EntityName}s);

    // DIコンテナにモックリポジトリを登録
    container.registerSingleton(
      DI_KEYS.INTERNAL_${ENTITY_UPPER}_REPOSITORY,
      () => mockRepository
    );

    // UseCaseを登録
    container.registerSingleton(DI_KEYS.INTERNAL_${ENTITY_UPPER}_USECASE, () => {
      const repository = container.getSingleton<Mock${EntityName}Repository>(
        DI_KEYS.INTERNAL_${ENTITY_UPPER}_REPOSITORY
      );
      return new ${EntityName}UseCase(repository);
    });

    // Controllerを登録
    container.registerSingleton(
      DI_KEYS.INTERNAL_${ENTITY_UPPER}_CONTROLLER,
      () => {
        const useCase = container.getSingleton<${EntityName}UseCase>(
          DI_KEYS.INTERNAL_${ENTITY_UPPER}_USECASE
        );
        return new ${EntityName}Controller(useCase);
      }
    );

    // Controllerを取得
    const controller = container.getSingleton<${EntityName}Controller>(
      DI_KEYS.INTERNAL_${ENTITY_UPPER}_CONTROLLER
    );

    // テスト用のElysiaアプリケーションを作成
    app = createTestApp("/${entitiesPlural}")
      // GET /${entitiesPlural} - ${EntityName}一覧取得
      .get("/", async () => await controller.get${EntityName}s(), {
        response: ${EntityName}ListResponseSchema,
      })
      // GET /${entitiesPlural}/:id - 単一${EntityName}取得
      .get(
        "/:id",
        async ({ params }) => await controller.get${EntityName}ById(params.id),
        {
          params: ${EntityName}IdParamSchema,
          response: ${EntityName}ResponseSchema,
        }
      )
      // POST /${entitiesPlural} - ${EntityName}作成
      .post(
        "/",
        async ({ body }) => await controller.create${EntityName}(body),
        {
          body: Create${EntityName}BodySchema,
          response: ${EntityName}ResponseSchema,
        }
      )
      // PUT /${entitiesPlural}/:id - ${EntityName}更新
      .put(
        "/:id",
        async ({ params, body }) =>
          await controller.update${EntityName}(params.id, body),
        {
          params: ${EntityName}IdParamSchema,
          body: Update${EntityName}BodySchema,
          response: ${EntityName}ResponseSchema,
        }
      )
      // PATCH /${entitiesPlural}/:id - ${EntityName}部分更新
      .patch(
        "/:id",
        async ({ params, body }) =>
          await controller.patch${EntityName}(params.id, body),
        {
          params: ${EntityName}IdParamSchema,
          body: Patch${EntityName}BodySchema,
          response: ${EntityName}ResponseSchema,
        }
      )
      // DELETE /${entitiesPlural}/:id - ${EntityName}削除
      .delete(
        "/:id",
        async ({ params }) => await controller.delete${EntityName}(params.id),
        {
          params: ${EntityName}IdParamSchema,
          response: DeleteResponseSchema,
        }
      );
  });

  describe("GET /${entitiesPlural}", () => {
    it("全${EntityName}を取得できる", async () => {
      // Setup
      // beforeEachで準備済み

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}")
      );

      // Assert
      expect(response.status).toBe(200);

      const ${entitiesPlural} = await response.json();
      expect(${entitiesPlural}).toHaveLength(2);
      expect(${entitiesPlural}[0].name).toBe("Test ${EntityName} 1");
      expect(${entitiesPlural}[1].name).toBe("Test ${EntityName} 2");
    });

    it("${EntityName}が存在しない場合は空配列を返す", async () => {
      // Setup
      mockRepository.clear();

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}")
      );

      // Assert
      expect(response.status).toBe(200);
      const ${entitiesPlural} = await response.json();
      expect(${entitiesPlural}).toHaveLength(0);
    });
  });

  describe("GET /${entitiesPlural}/:id", () => {
    it("IDで${EntityName}を取得できる", async () => {
      // Setup
      // beforeEachで準備済み

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}/1")
      );

      // Assert
      expect(response.status).toBe(200);

      const ${entitySingular} = await response.json();
      expect(${entitySingular}.id).toBe(1);
      expect(${entitySingular}.name).toBe("Test ${EntityName} 1");
      expect(${entitySingular}.description).toBe("Description for test ${entitySingular} 1");
    });

    it("${EntityName}が存在しない場合は404を返す", async () => {
      // Setup
      // beforeEachで準備済み

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}/999")
      );

      // Assert
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.error).toBe("NotFoundError");
      expect(error.message).toContain("${EntityName} with id 999 not found");
    });
  });

  describe("POST /${entitiesPlural}", () => {
    it("新しい${EntityName}を作成できる", async () => {
      // Setup
      const new${EntityName} = {
        name: "New ${EntityName}",
        description: "New ${EntityName} description",
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(new${EntityName}),
        })
      );

      // Assert
      expect(response.status).toBe(200);

      const created${EntityName} = await response.json();
      expect(created${EntityName}.id).toBeDefined();
      expect(created${EntityName}.name).toBe("New ${EntityName}");
      expect(created${EntityName}.description).toBe("New ${EntityName} description");

      // リポジトリに${EntityName}が追加されているか確認
      expect(mockRepository.get${EntityName}Count()).toBe(3);
    });

    it("必須フィールドが欠落している場合は422を返す", async () => {
      // Setup
      const invalid${EntityName} = {
        name: "Incomplete ${EntityName}",
        // description が欠落
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invalid${EntityName}),
        })
      );

      // Assert
      expect(response.status).toBe(422);

      const error = await response.json();
      expect(error.error).toBe("ValidationError");
    });
  });

  describe("PUT /${entitiesPlural}/:id", () => {
    it("既存${EntityName}を更新できる", async () => {
      // Setup
      const updatedData = {
        name: "Updated ${EntityName} 1",
        description: "Updated description",
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}/1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData),
        })
      );

      // Assert
      expect(response.status).toBe(200);

      const updated${EntityName} = await response.json();
      expect(updated${EntityName}.id).toBe(1);
      expect(updated${EntityName}.name).toBe("Updated ${EntityName} 1");
      expect(updated${EntityName}.description).toBe("Updated description");
    });
  });

  describe("PATCH /${entitiesPlural}/:id", () => {
    it("${EntityName}を部分更新できる", async () => {
      // Setup
      const patchData = {
        name: "Patched ${EntityName} 1",
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}/1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchData),
        })
      );

      // Assert
      expect(response.status).toBe(200);

      const patched${EntityName} = await response.json();
      expect(patched${EntityName}.id).toBe(1);
      expect(patched${EntityName}.name).toBe("Patched ${EntityName} 1");
      // 他のフィールドは変更されていないことを確認
      expect(patched${EntityName}.description).toBe("Description for test ${entitySingular} 1");
    });

    it("${EntityName}が存在しない場合は404を返す", async () => {
      // Setup
      const patchData = {
        name: "Non-existent ${EntityName}",
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}/999", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchData),
        })
      );

      // Assert
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.error).toBe("NotFoundError");
    });
  });

  describe("DELETE /${entitiesPlural}/:id", () => {
    it("${EntityName}を削除できる", async () => {
      // Setup
      // beforeEachで準備済み

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}/1", {
          method: "DELETE",
        })
      );

      // Assert
      expect(response.status).toBe(200);

      // リポジトリから${EntityName}が削除されているか確認
      expect(mockRepository.get${EntityName}Count()).toBe(1);
      const remaining${EntityName} = await mockRepository.findById(1);
      expect(remaining${EntityName}).toBeNull();
    });

    it("${EntityName}が存在しない場合は404を返す", async () => {
      // Setup
      // beforeEachで準備済み

      // Execute
      const response = await app.handle(
        new Request("http://localhost/${entitiesPlural}/999", {
          method: "DELETE",
        })
      );

      // Assert
      expect(response.status).toBe(404);

      const error = await response.json();
      expect(error.error).toBe("NotFoundError");
    });
  });
});
`;
}

/**
 * test/mocks/mock{Entity}Repository.ts
 */
function generateMockRepositoryTemplate(entitySingular: string, entitiesPlural: string, scope: string): string {
  const EntityName = toPascalCase(entitySingular);

  return `import type { ${EntityName} } from "../../src/domain/${entitySingular}/entity";
import type { I${EntityName}Repository } from "../../src/domain/interface/repository/${entitySingular}Repository";
import type {
  Create${EntityName}Body,
  Update${EntityName}Body,
  Patch${EntityName}Body,
} from "../../src/api/${scope}/${entitiesPlural}/requests";

export class Mock${EntityName}Repository implements I${EntityName}Repository {
  private ${entitiesPlural}: ${EntityName}[] = [];
  private currentId = 1;

  /**
   * テストデータをセットアップ
   */
  set${EntityName}s(${entitiesPlural}: ${EntityName}[]): void {
    this.${entitiesPlural} = [...${entitiesPlural}];
    if (${entitiesPlural}.length > 0) {
      this.currentId = Math.max(...${entitiesPlural}.map((item) => item.id)) + 1;
    }
  }

  /**
   * データをクリア
   */
  clear(): void {
    this.${entitiesPlural} = [];
    this.currentId = 1;
  }

  /**
   * ${EntityName}の数を取得
   */
  get${EntityName}Count(): number {
    return this.${entitiesPlural}.length;
  }

  async findAll(): Promise<${EntityName}[]> {
    return [...this.${entitiesPlural}];
  }

  async findById(id: number): Promise<${EntityName} | null> {
    const ${entitySingular} = this.${entitiesPlural}.find((item) => item.id === id);
    return ${entitySingular} ? { ...${entitySingular} } : null;
  }

  async create(data: Create${EntityName}Body): Promise<${EntityName}> {
    const new${EntityName}: ${EntityName} = {
      id: this.currentId++,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.${entitiesPlural}.push(new${EntityName});
    return { ...new${EntityName} };
  }

  async update(id: number, data: Update${EntityName}Body): Promise<${EntityName}> {
    const idx = this.${entitiesPlural}.findIndex((item) => item.id === id);
    const updated${EntityName}: ${EntityName} = {
      id,
      ...data,
      createdAt: this.${entitiesPlural}[idx]?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (idx === -1) {
      this.${entitiesPlural}.push(updated${EntityName});
    } else {
      this.${entitiesPlural}[idx] = updated${EntityName};
    }

    return { ...updated${EntityName} };
  }

  async patch(
    id: number,
    data: Patch${EntityName}Body
  ): Promise<${EntityName} | null> {
    const idx = this.${entitiesPlural}.findIndex((item) => item.id === id);
    if (idx === -1) return null;

    const current = this.${entitiesPlural}[idx];
    const patched${EntityName}: ${EntityName} = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };

    this.${entitiesPlural}[idx] = patched${EntityName};
    return { ...patched${EntityName} };
  }

  async delete(id: number): Promise<boolean> {
    const idx = this.${entitiesPlural}.findIndex((item) => item.id === id);
    if (idx === -1) return false;

    this.${entitiesPlural}.splice(idx, 1);
    return true;
  }
}
`;
}

// =====================================
// ファイル作成関数
// =====================================

function createFile(filePath: string, content: string): void {
  const dir = join(process.cwd(), filePath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(join(process.cwd(), filePath), content, "utf-8");
  console.log(`✅ Created: ${filePath}`);
}

// =====================================
// メイン関数
// =====================================

async function main() {
  console.log("\n🚀 クリーンアーキテクチャ - エンドポイント生成スクリプト\n");

  let scope: string;
  let entitiesPlural: string;

  // コマンドライン引数をチェック
  // 使用方法: bun run ddd <scope> <entities>
  // 例: bun run ddd public products
  const args = process.argv.slice(2);

  if (args.length >= 2) {
    // コマンドライン引数モード
    const scopeArg = args[0].toLowerCase();

    // スコープの検証
    if (!["public", "user", "admin"].includes(scopeArg)) {
      console.error("❌ 無効なスコープです。public, user, admin のいずれかを指定してください。");
      return;
    }

    scope = scopeArg;
    entitiesPlural = args[1];

    console.log(`✅ スコープ: ${scope}`);
    console.log(`✅ エンドポイント名: ${entitiesPlural}\n`);
  } else {
    // インタラクティブモード
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 1. スコープを選択
    console.log("📂 エンドポイントのスコープを選択してください:");
    console.log("  1. public (未認証)");
    console.log("  2. user (一般ユーザー)");
    console.log("  3. admin (システム管理者)\n");

    const scopeChoice = await rl.question("選択 (1-3): ");

    switch (scopeChoice.trim()) {
      case "1":
        scope = "public";
        break;
      case "2":
        scope = "user";
        break;
      case "3":
        scope = "admin";
        break;
      default:
        console.error("❌ 無効な選択です。終了します。");
        rl.close();
        return;
    }

    console.log(`✅ スコープ: ${scope}\n`);

    // 2. エンドポイント名を入力
    entitiesPlural = await rl.question(
      "📝 作成するエンドポイント名を入力してください (複数形, 例: products): "
    );

    if (!entitiesPlural || entitiesPlural.trim() === "") {
      console.error("❌ エンドポイント名が入力されていません。終了します。");
      rl.close();
      return;
    }

    entitiesPlural = entitiesPlural.trim();
    rl.close();
  }

  const entitySingular = toSingular(entitiesPlural);
  console.log(`✅ 単数形: ${entitySingular}\n`);

  // 3. ファイル生成
  console.log("📁 ファイルを生成しています...\n");

  // Domain層
  createFile(
    `src/domain/${entitySingular}/entity.ts`,
    generateEntityTemplate(entitySingular)
  );
  createFile(
    `src/domain/interface/repository/${entitySingular}Repository.ts`,
    generateRepositoryInterfaceTemplate(entitySingular, entitiesPlural, scope)
  );

  // Infrastructure層
  createFile(
    `src/infrastructure/repository/${entitySingular}Repository.ts`,
    generateRepositoryImplementationTemplate(entitySingular, entitiesPlural, scope)
  );

  // DI層
  createFile(
    `src/di/${entitiesPlural}.ts`,
    generateDITemplate(entitySingular, entitiesPlural, scope)
  );

  // API層
  createFile(
    `src/api/${scope}/${entitiesPlural}/requests.ts`,
    generateRequestsTemplate(entitySingular)
  );
  createFile(
    `src/api/${scope}/${entitiesPlural}/responses.ts`,
    generateResponsesTemplate(entitySingular, entitiesPlural)
  );
  createFile(
    `src/api/${scope}/${entitiesPlural}/usecase.ts`,
    generateUseCaseTemplate(entitySingular, entitiesPlural)
  );
  createFile(
    `src/api/${scope}/${entitiesPlural}/controller.ts`,
    generateControllerTemplate(entitySingular, entitiesPlural)
  );
  createFile(
    `src/api/${scope}/${entitiesPlural}/router.ts`,
    generateRouterTemplate(entitySingular, entitiesPlural)
  );

  // Test層
  createFile(
    `test/mocks/mock${toPascalCase(entitySingular)}Repository.ts`,
    generateMockRepositoryTemplate(entitySingular, entitiesPlural, scope)
  );
  createFile(
    `test/${entitiesPlural}.test.ts`,
    generateTestTemplate(entitySingular, entitiesPlural, scope)
  );

  console.log("\n✨ すべてのファイルが生成されました！\n");

  // 次のステップを表示
  console.log("📌 次のステップ:");
  console.log(`1. src/index.ts に以下を追加してください:`);
  console.log(`   import { ${entitySingular}Router } from "./api/${scope}/${entitiesPlural}/router";`);
  console.log(`   app.use(${entitySingular}Router);`);
  console.log(`\n2. テストを実行してください:`);
  console.log(`   bun run test`);
  console.log(`\n3. サーバーを起動してください:`);
  console.log(`   bun run dev`);
  console.log(`\n4. OpenAPI ドキュメントを確認してください:`);
  console.log(`   http://localhost:3000/swagger\n`);
}

main().catch((error) => {
  console.error("❌ エラーが発生しました:", error);
  process.exit(1);
});
