import type { User } from "../../../domain/user/entity";
import type { CreateUserBody, UpdateUserBody, PatchUserNameBody } from "./requests";
import { NotFoundError } from "../../../domain/errors/httpErrors";
import {IUserRepository} from "../../../domain/interface/repository/userRepository";

// UseCaseクラス: ビジネスロジックを記述
export class UserUseCase {
  constructor(private repository: IUserRepository) {}

  // ユーザーリスト取得
  async getUsers(): Promise<User[]> {
    return await this.repository.findAll();
  }

  // 単一ユーザー取得
  async getUserById(id: number): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }

  // ユーザー作成
  async createUser(data: CreateUserBody): Promise<User> {
    // ここでビジネスロジックを追加可能（例: バリデーション、重複チェックなど）
    return await this.repository.create(data);
  }

  // ユーザー全置換
  async updateUser(id: number, data: UpdateUserBody): Promise<User> {
    return await this.repository.update(id, data);
  }

  // ユーザー部分更新
  async patchUser(id: number, data: PatchUserNameBody): Promise<User> {
    const user = await this.repository.patch(id, data);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }

  // ユーザー削除
  async deleteUser(id: number): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
  }
}
