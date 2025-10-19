// リポジトリインターフェース（依存性の逆転）
import {User} from "../../user/entity";
import {CreateUserBody, PatchUserNameBody, UpdateUserBody} from "../../../api/public/users/requests";

export interface IUserRepository {
  findAll(): Promise<User[]>;
  findById(id: number): Promise<User | null>;
  create(data: CreateUserBody): Promise<User>;
  update(id: number, data: UpdateUserBody): Promise<User>;
  patch(id: number, data: PatchUserNameBody): Promise<User | null>;
  delete(id: number): Promise<boolean>;
}