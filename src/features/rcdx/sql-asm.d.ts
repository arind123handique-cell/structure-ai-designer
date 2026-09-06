declare module 'sql.js/dist/sql-asm.js' {
  import { SqlJsStatic } from 'sql.js';
  const initSqlJs: (config?: Partial<{ locateFile: (file: string) => string }>) => Promise<SqlJsStatic>;
  export default initSqlJs;
}