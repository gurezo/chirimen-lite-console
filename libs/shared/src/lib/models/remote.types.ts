/** One row from `forever list` / `forever list --plain` (tabular output). */
export interface ForeverProcess {
  /** Row index in forever list output, e.g. `[0]` — usable with `forever stop 0`. */
  listIndex: number;
  /** Forever uid (namespace), used with `forever stop <uid>`. */
  uid: string;
  command: string;
  /** Script path and args as shown in the script column. */
  script: string;
  foreverPid?: string;
  pid?: string;
  logFile?: string;
  uptime?: string;
  running: boolean;
}
