export default interface DatabaseConnection {
  query<T = any>(statement: string, params?: any[]): Promise<T>;
  close(): Promise<void>;
}
