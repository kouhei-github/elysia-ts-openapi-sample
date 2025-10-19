import type { User } from "../../domain/user/entity";
import type { CreateUserBody, UpdateUserBody, PatchUserNameBody } from "../../api/public/users/requests";
import {IUserRepository} from "../../domain/interface/repository/userRepository";

// インメモリDB実装
export class InMemoryUserRepository implements IUserRepository {
  private users: User[] = [];

  async findAll(): Promise<User[]> {
    return this.users;
  }

  async findById(id: number): Promise<User | null> {
    const user = this.users.find(u => u.id === id);
    return user || null;
  }

  async create(data: CreateUserBody): Promise<User> {
    const nextId = this.users.length ? Math.max(...this.users.map(u => u.id)) + 1 : 1;
    const newUser: User = { id: nextId, ...data };
    this.users.push(newUser);
    return newUser;
  }

  async update(id: number, data: UpdateUserBody): Promise<User> {
    const idx = this.users.findIndex(u => u.id === id);
    const updatedUser: User = { id, ...data };

    if (idx === -1) {
      this.users.push(updatedUser);
    } else {
      this.users[idx] = updatedUser;
    }

    return updatedUser;
  }

  async patch(id: number, data: PatchUserNameBody): Promise<User | null> {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    const current = this.users[idx];
    const patchedUser: User = {
      ...current,
      ...data,
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
}

// 外部API実装
export class ExternalApiUserRepository implements IUserRepository {
  private baseUrl = "https://jsonplaceholder.typicode.com/users";

  async findAll(): Promise<User[]> {
    return await fetch(this.baseUrl).then(res => res.json());
  }

  async findById(id: number): Promise<User | null> {
    return await fetch(`${this.baseUrl}/${id}`).then(res => res.json());
  }

  async create(data: CreateUserBody): Promise<User> {
    // 外部APIの実装（実際には動作しない可能性があるため、ダミー実装）
    throw new Error("Not implemented for external API");
  }

  async update(id: number, data: UpdateUserBody): Promise<User> {
    throw new Error("Not implemented for external API");
  }

  async patch(id: number, data: PatchUserNameBody): Promise<User | null> {
    throw new Error("Not implemented for external API");
  }

  async delete(id: number): Promise<boolean> {
    throw new Error("Not implemented for external API");
  }
}

