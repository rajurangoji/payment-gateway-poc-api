export class Result<T, E = Error> {
  private constructor(
    private readonly success: boolean,
    private readonly value?: T,
    private readonly error?: E,
  ) {}

  static ok<T>(value: T): Result<T> {
    return new Result<T>(true, value);
  }

  static failed<E = Error>(error: E): Result<never, E> {
    return new Result<never, E>(false, undefined, error);
  }

  isSuccess(): boolean {
    return this.success;
  }

  isFailed(): boolean {
    return !this.success;
  }

  getValue(): T {
    if (!this.success) {
      throw new Error('Cannot get value from a failed result');
    }
    return this.value as T;
  }

  getError(): E {
    if (this.success) {
      throw new Error('Cannot get error from a successful result');
    }
    return this.error as E;
  }
}
