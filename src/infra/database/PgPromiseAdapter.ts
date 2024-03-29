import { config } from "dotenv";
config();
import pgp from "pg-promise";
import DatabaseConnection from "./DatabaseConnection";

export class PgPromiseAdapter implements DatabaseConnection {
  private connection: any;

  constructor() {
    this.connection = pgp()(
      process.env.DATABASE_URL ||
        "postgresql://admin:123@localhost:5432/rinha?schema=public?pool=20?max=20?sslmode=disable"
    );
  }

  async query<T = any>(
    statement: string,
    params?: any[] | undefined
  ): Promise<T> {
    return this.connection.query(statement, params);
  }
  async close(): Promise<void> {
    await this.connection.$pool.end();
  }
}
