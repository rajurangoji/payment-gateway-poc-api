export abstract class ValueObject<T> {
  protected constructor(protected readonly props: T) {
    Object.freeze(this);
  }

  equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}

export abstract class Entity<T> {
  constructor(
    protected readonly props: T,
    protected readonly _id: string,
  ) {
    Object.freeze(this);
  }

  equals(other: Entity<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    return this._id === other._id;
  }

  get value(): T {
    return this.props;
  }

  get id(): string {
    return this._id;
  }
}
