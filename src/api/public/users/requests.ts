import { t, type Static as Infer } from "elysia";
import { CompanySchema } from "../../../domain/user/entity";

// POSTリクエストのボディスキーマ（idは自動生成されるため含まない）
export const CreateUserBodySchema = t.Object({
  name: t.String(),
  username: t.String(),
  email: t.String(),
  company: CompanySchema,
});

// PUT/PATCHリクエストのパラメータスキーマ
export const UserIdParamSchema = t.Object({
  id: t.Number(),
});

// PUTリクエストのボディスキーマ（全置換）
export const UpdateUserBodySchema = t.Object({
  name: t.String(),
  username: t.String(),
  email: t.String(),
  company: CompanySchema,
});

// PATCHリクエストのボディスキーマ（部分更新）
export const PatchUserNameSchema = t.Partial(
  t.Object({
    name: t.String(),
  })
);

// スキーマから型を推論
export type CreateUserBody = Infer<typeof CreateUserBodySchema>;
export type UserIdParam = Infer<typeof UserIdParamSchema>;
export type UpdateUserBody = Infer<typeof UpdateUserBodySchema>;
export type PatchUserNameBody = Infer<typeof PatchUserNameSchema>;
