declare module "mapshaper" {
  /**
   * Runs mapshaper commands on in-memory files and resolves with the output files by name.
   * An input can also be a GeoJSON object, which spares turning very large data into a string.
   */
  function applyCommands(
    argv: string | string[],
    input?: Record<string, string | { type: string }>,
  ): Promise<Record<string, string>>;
  const mapshaper: { applyCommands: typeof applyCommands };
  export default mapshaper;
}
