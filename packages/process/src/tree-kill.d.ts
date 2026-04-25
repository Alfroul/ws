declare module "tree-kill" {
  type TreeKillCallback = (err?: Error) => void;

  function treeKill(pid: number, callback?: TreeKillCallback): void;
  function treeKill(
    pid: number,
    signal: string | number,
    callback?: TreeKillCallback,
  ): void;

  export default treeKill;
}
