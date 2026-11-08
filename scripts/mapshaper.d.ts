declare module "mapshaper" {
  /** Runs mapshaper commands on in-memory files and resolves with the output files by name. */
  function applyCommands(
    argv: string | string[],
    input?: Record<string, string>,
  ): Promise<Record<string, string>>;
  const mapshaper: { applyCommands: typeof applyCommands };
  export default mapshaper;
}
