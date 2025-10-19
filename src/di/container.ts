// シンプルなDIコンテナ実装
type Factory<T> = () => T;
type Singleton<T> = { instance?: T; factory: Factory<T> };

class DIContainer {
  private singletons = new Map<string, Singleton<any>>();
  private factories = new Map<string, Factory<any>>();

  // シングルトンとして登録（初回呼び出し時にインスタンス化、その後は同じインスタンスを返す）
  registerSingleton<T>(key: string, factory: Factory<T>): void {
    this.singletons.set(key, { factory });
  }

  // ファクトリとして登録（毎回新しいインスタンスを生成）
  registerFactory<T>(key: string, factory: Factory<T>): void {
    this.factories.set(key, factory);
  }

  // シングルトンインスタンスを取得
  getSingleton<T>(key: string): T {
    const singleton = this.singletons.get(key);
    if (!singleton) {
      throw new Error(`Singleton not registered: ${key}`);
    }

    if (!singleton.instance) {
      singleton.instance = singleton.factory();
    }

    return singleton.instance as T;
  }

  // ファクトリから新しいインスタンスを取得
  getFactory<T>(key: string): T {
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Factory not registered: ${key}`);
    }

    return factory();
  }

  // リセット（主にテスト用）
  reset(): void {
    this.singletons.clear();
    this.factories.clear();
  }
}

// グローバルDIコンテナインスタンス
export const container = new DIContainer();
