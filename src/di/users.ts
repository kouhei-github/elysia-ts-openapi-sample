import { container } from "./container";
import type { IUserRepository } from "../domain/interface/repository/userRepository";
import { InMemoryUserRepository, ExternalApiUserRepository } from "../infrastructure/repository/userRepository";
import { UserUseCase } from "../api/public/users/usecase";
import { UserController } from "../api/public/users/controller";

// DIコンテナキー
export const DI_KEYS = {
  // Repositories
  INTERNAL_USER_REPOSITORY: "InternalUserRepository",
  EXTERNAL_USER_REPOSITORY: "ExternalUserRepository",

  // UseCases
  INTERNAL_USER_USECASE: "InternalUserUseCase",
  EXTERNAL_USER_USECASE: "ExternalUserUseCase",

  // Controllers
  INTERNAL_USER_CONTROLLER: "InternalUserController",
  EXTERNAL_USER_CONTROLLER: "ExternalUserController",
} as const;

// DIコンテナの初期化関数
export function initializeUserDI(): void {
  // Repository層をシングルトンとして登録
  container.registerSingleton<IUserRepository>(
    DI_KEYS.INTERNAL_USER_REPOSITORY,
    () => new InMemoryUserRepository()
  );

  container.registerSingleton<IUserRepository>(
    DI_KEYS.EXTERNAL_USER_REPOSITORY,
    () => new ExternalApiUserRepository()
  );

  // UseCase層をシングルトンとして登録
  container.registerSingleton<UserUseCase>(
    DI_KEYS.INTERNAL_USER_USECASE,
    () => {
      const repository = container.getSingleton<IUserRepository>(
        DI_KEYS.INTERNAL_USER_REPOSITORY
      );
      return new UserUseCase(repository);
    }
  );

  container.registerSingleton<UserUseCase>(
    DI_KEYS.EXTERNAL_USER_USECASE,
    () => {
      const repository = container.getSingleton<IUserRepository>(
        DI_KEYS.EXTERNAL_USER_REPOSITORY
      );
      return new UserUseCase(repository);
    }
  );

  // Controller層をシングルトンとして登録
  container.registerSingleton<UserController>(
    DI_KEYS.INTERNAL_USER_CONTROLLER,
    () => {
      const useCase = container.getSingleton<UserUseCase>(
        DI_KEYS.INTERNAL_USER_USECASE
      );
      return new UserController(useCase);
    }
  );

  container.registerSingleton<UserController>(
    DI_KEYS.EXTERNAL_USER_CONTROLLER,
    () => {
      const useCase = container.getSingleton<UserUseCase>(
        DI_KEYS.EXTERNAL_USER_USECASE
      );
      return new UserController(useCase);
    }
  );
}

// 便利なヘルパー関数
export function getInternalUserController(): UserController {
  return container.getSingleton<UserController>(DI_KEYS.INTERNAL_USER_CONTROLLER);
}

export function getExternalUserController(): UserController {
  return container.getSingleton<UserController>(DI_KEYS.EXTERNAL_USER_CONTROLLER);
}
