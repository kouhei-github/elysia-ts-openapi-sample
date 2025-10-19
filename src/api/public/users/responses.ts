import { t, type Static as Infer } from "elysia";
import { UserSchema } from "../../../domain/user/entity";

// 単一ユーザーのレスポンススキーマ
export const UserResponseSchema = UserSchema;

// ユーザーリストのレスポンススキーマ
export const UserListResponseSchema = t.Array(UserSchema);

// 削除成功時のレスポンススキーマ
export const DeleteResponseSchema = t.Void();

// スキーマから型を推論
export type UserResponse = Infer<typeof UserResponseSchema>;
export type UserListResponse = Infer<typeof UserListResponseSchema>;
export type DeleteResponse = Infer<typeof DeleteResponseSchema>;
