declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }

  interface Database {
    run(sql: string, params?: (string | number | null)[]): Database
    prepare(sql: string): Statement
    export(): Uint8Array
    getRowsModified(): number
    close(): void
  }

  interface Statement {
    bind(params?: (string | number | null)[]): boolean
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): boolean
  }

  export default function initSqlJs(): Promise<SqlJsStatic>
  export { Database, Statement, SqlJsStatic }
}
