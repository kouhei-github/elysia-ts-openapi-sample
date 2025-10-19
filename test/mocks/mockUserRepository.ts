import type { User } from "../../src/domain/user/entity";
import type { IUserRepository } from "../../src/domain/interface/repository/userRepository";
import type {
  CreateUserBody,
  UpdateUserBody,
  PatchUserNameBody,
} from "../../src/api/public/users/requests";

/**
 * テスト用のモックUserRepository
 * テストデータを簡単に設定でき、予測可能な動作を提供します
 */
export class MockUserRepository implements IUserRepository {
  private users: User[] = [];
  private currentId = 1;

  /**
   * テストデータをセットアップ
   */
  setUsers(users: User[]): void {
    this.users = [...users];
    if (users.length > 0) {
      this.currentId = Math.max(...users.map(u => u.id)) + 1;
    }
  }

  /**
   * データをクリア
   */
  clear(): void {
    this.users = [];
    this.currentId = 1;
  }

  /**
   * 全ユーザーを取得
   */
  async findAll(): Promise<User[]> {
    return [...this.users];
  }

  /**
   * IDでユーザーを検索
   */
  async findById(id: number): Promise<User | null> {
    const user = this.users.find(u => u.id === id);
    return user || null;
  }

  /**
   * ユーザーを作成
   */
  async create(data: CreateUserBody): Promise<User> {
    const newUser: User = {
      id: this.currentId++,
      ...data,
    };
    this.users.push(newUser);
    return { ...newUser };
  }

  /**
   * ユーザーを更新（全置換）
   */
  async update(id: number, data: UpdateUserBody): Promise<User> {
    const idx = this.users.findIndex(u => u.id === id);
    const updatedUser: User = { id, ...data };

    if (idx === -1) {
      this.users.push(updatedUser);
    } else {
      this.users[idx] = updatedUser;
    }

    return { ...updatedUser };
  }

  /**
   * ユーザーを部分更新
   */
  async patch(id: number, data: PatchUserNameBody): Promise<User | null> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    const current = this.users[idx];
    const patchedUser: User = {
      ...current,
      ...data,
    };

    this.users[idx] = patchedUser;
    return { ...patchedUser };
  }

  /**
   * ユーザーを削除
   */
  async delete(id: number): Promise<boolean> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return false;

    this.users.splice(idx, 1);
    return true;
  }

  /**
   * 現在のユーザー数を取得（テストユーティリティ）
   */
  getUserCount(): number {
    return this.users.length;
  }

  /**
   * 全ユーザーデータを取得（テストユーティリティ）
   */
  getAllUsers(): User[] {
    return [...this.users];
  }
}
