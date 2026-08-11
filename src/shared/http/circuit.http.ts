export interface ICircuitHttpClient {
  get<T>(url: string): Promise<T>;
  post<T, R>(url: string, data?: R): Promise<T>;
}
