import { Elysia } from "elysia";
import {
  CreateUserBodySchema,
  UpdateUserBodySchema,
  UserIdParamSchema, PatchUserNameSchema,
} from "./requests";
import {
  UserResponseSchema,
  UserListResponseSchema,
  DeleteResponseSchema,
} from "./responses";
import { errorHandler } from "../../middleware/errorHandler";
import { initializeUserDI, getInternalUserController, getExternalUserController } from "../../../di/users";

// DIコンテナの初期化
initializeUserDI();

// DIコンテナからControllerを取得
const controller = getInternalUserController();
const externalController = getExternalUserController();

// ルーター定義
export const userRouter = new Elysia({ prefix: "/users" })
  .use(errorHandler)  // エラーハンドリングミドルウェアを適用
  // GET /users - 外部APIからユーザーリスト取得
  .get(
    "/",
    async () => await externalController.getUsers(),
    {
      response: UserListResponseSchema,
    }
  )
  // GET /users/:id - 外部APIから単一ユーザー取得
  .get(
    "/:id",
    async ({ params }) => await externalController.getUserById(params.id),
    {
      params: UserIdParamSchema,
      response: UserResponseSchema,
    }
  )
  // POST /users - インメモリDBにユーザー作成
  .post(
    "/",
    async ({ body }) => await controller.createUser(body),
    {
      body: CreateUserBodySchema,
      response: UserResponseSchema,
    }
  )
  // PUT /users/:id - インメモリDBでユーザー全置換
  .put(
    "/:id",
    async ({ params, body }) => await controller.updateUser(params.id, body),
    {
      params: UserIdParamSchema,
      body: UpdateUserBodySchema,
      response: UserResponseSchema,
    }
  )
  // PATCH /users/:id/name - インメモリDBでユーザー名部分更新
  .patch(
    "/:id/name",
    async ({ params, body }) => await controller.patchUser(params.id, body),
    {
      params: UserIdParamSchema,
      body: PatchUserNameSchema,
      response: UserResponseSchema,
    }
  )
  // DELETE /users/:id - インメモリDBからユーザー削除
  .delete(
    "/:id",
    async ({ params }) => await controller.deleteUser(params.id),
    {
      params: UserIdParamSchema,
      response: DeleteResponseSchema,
    }
  );
