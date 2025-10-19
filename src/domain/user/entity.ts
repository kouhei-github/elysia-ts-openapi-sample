import { t, type Static as Infer } from "elysia";

// ドメイン層: Userエンティティの定義
export const CompanySchema = t.Object({
  name: t.String(),
});

export const UserSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  username: t.String(),
  email: t.String(),
  company: CompanySchema,
});

// スキーマから型を推論
export type User = Infer<typeof UserSchema>;
export type Company = Infer<typeof CompanySchema>;
