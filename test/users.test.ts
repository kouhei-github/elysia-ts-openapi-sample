import { describe, expect, it, beforeEach } from "bun:test";
import { container } from "../src/di/container";
import { DI_KEYS } from "../src/di/users";
import { MockUserRepository } from "./mocks/mockUserRepository";
import { UserUseCase } from "../src/api/public/users/usecase";
import { UserController } from "../src/api/public/users/controller";
import { createTestApp } from "./helpers/createTestApp";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
  PatchUserNameSchema,
  UserIdParamSchema,
} from "../src/api/public/users/requests";
import {
  UserResponseSchema,
  UserListResponseSchema,
  DeleteResponseSchema,
} from "../src/api/public/users/responses";
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

    // Controllerを取得
    const controller = container.getSingleton<UserController>(
      DI_KEYS.INTERNAL_USER_CONTROLLER
    );

    // テスト用のElysiaアプリケーションを作成
    app = createTestApp("/users")
      // GET /users - ユーザー一覧取得
      .get("/", async () => await controller.getUsers(), {
        response: UserListResponseSchema,
      })
      // GET /users/:id - 単一ユーザー取得
      .get(
        "/:id",
        async ({ params }) => await controller.getUserById(params.id),
        {
          params: UserIdParamSchema,
          response: UserResponseSchema,
        }
      )
      // POST /users - ユーザー作成
      .post("/", async ({ body }) => await controller.createUser(body), {
        body: CreateUserBodySchema,
        response: UserResponseSchema,
      })
      // PUT /users/:id - ユーザー更新
      .put(
        "/:id",
        async ({ params, body }) => await controller.updateUser(params.id, body),
        {
          params: UserIdParamSchema,
          body: UpdateUserBodySchema,
          response: UserResponseSchema,
        }
      )
      // PATCH /users/:id/name - ユーザー名部分更新
      .patch(
        "/:id/name",
        async ({ params, body }) => await controller.patchUser(params.id, body),
        {
          params: UserIdParamSchema,
          body: PatchUserNameSchema,
          response: UserResponseSchema,
        }
      )
      // DELETE /users/:id - ユーザー削除
      .delete(
        "/:id",
        async ({ params }) => await controller.deleteUser(params.id),
        {
          params: UserIdParamSchema,
          response: DeleteResponseSchema,
        }
      );
  });

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

    it("ユーザーが存在しない場合は空配列を返す", async () => {
      // Setup
      mockRepository.clear();

      // Execute
      const response = await app.handle(
        new Request("http://localhost/users")
      );

      // Assert
      expect(response.status).toBe(200);
      const users = await response.json();
      expect(users).toHaveLength(0);
    });
  });

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
      expect(createdUser.company.name).toBe("New Company");

      // リポジトリにユーザーが追加されているか確認
      expect(mockRepository.getUserCount()).toBe(3);
    });

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

  describe("PUT /users/:id", () => {
    it("既存ユーザーを更新できる", async () => {
      // Setup
      const updatedData = {
        name: "Updated User 1",
        username: "updateduser1",
        email: "updated1@example.com",
        company: { name: "Updated Company 1" },
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/users/1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData),
        })
      );

      // Assert
      expect(response.status).toBe(200);

      const updatedUser = await response.json();
      expect(updatedUser.id).toBe(1);
      expect(updatedUser.name).toBe("Updated User 1");
      expect(updatedUser.email).toBe("updated1@example.com");
    });

    it("IDが存在しない場合は新しいユーザーを作成する", async () => {
      // Setup
      const newData = {
        name: "New User via PUT",
        username: "newuserput",
        email: "newput@example.com",
        company: { name: "PUT Company" },
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/users/999", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newData),
        })
      );

      // Assert
      expect(response.status).toBe(200);

      const user = await response.json();
      expect(user.id).toBe(999);
      expect(user.name).toBe("New User via PUT");
    });
  });

  describe("PATCH /users/:id/name", () => {
    it("ユーザー名を部分更新できる", async () => {
      // Setup
      const patchData = {
        name: "Patched User 1",
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/users/1/name", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchData),
        })
      );

      // Assert
      expect(response.status).toBe(200);

      const patchedUser = await response.json();
      expect(patchedUser.id).toBe(1);
      expect(patchedUser.name).toBe("Patched User 1");
      // 他のフィールドは変更されていないことを確認
      expect(patchedUser.email).toBe("test1@example.com");
      expect(patchedUser.username).toBe("testuser1");
    });

    it("ユーザーが存在しない場合は404を返す", async () => {
      // Setup
      const patchData = {
        name: "Non-existent User",
      };

      // Execute
      const response = await app.handle(
        new Request("http://localhost/users/999/name", {
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

  describe("DELETE /users/:id", () => {
    it("ユーザーを削除できる", async () => {
      // Setup
      // beforeEachで準備済み

      // Execute
      const response = await app.handle(
        new Request("http://localhost/users/1", {
          method: "DELETE",
        })
      );

      // Assert
      expect(response.status).toBe(200);

      // リポジトリからユーザーが削除されているか確認
      expect(mockRepository.getUserCount()).toBe(1);
      const remainingUser = await mockRepository.findById(1);
      expect(remainingUser).toBeNull();
    });

    it("ユーザーが存在しない場合は404を返す", async () => {
      // Setup
      // beforeEachで準備済み

      // Execute
      const response = await app.handle(
        new Request("http://localhost/users/999", {
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
