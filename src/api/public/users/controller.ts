import type { UserUseCase } from "./usecase";
import {CreateUserBody, UpdateUserBody, PatchUserNameBody} from "./requests";
import type { User } from "../../../domain/user/entity";

// Controllerクラス: HTTPリクエスト/レスポンスを処理
export class UserController {
  constructor(private useCase: UserUseCase) {}

  // GET /users
  async getUsers(): Promise<User[]> {
    return await this.useCase.getUsers();
  }

  // GET /users/:id
  async getUserById(id: number): Promise<User> {
    return await this.useCase.getUserById(id);
  }

  // POST /users
  async createUser(body: CreateUserBody): Promise<User> {
    return await this.useCase.createUser(body);
  }

  // PUT /users/:id
  async updateUser(id: number, body: UpdateUserBody): Promise<User> {
    return await this.useCase.updateUser(id, body);
  }

  // PATCH /users/:id
  async patchUser(id: number, body: PatchUserNameBody): Promise<User> {
    return await this.useCase.patchUser(id, body);
  }

  // DELETE /users/:id
  async deleteUser(id: number): Promise<void> {
    await this.useCase.deleteUser(id);
  }
}
