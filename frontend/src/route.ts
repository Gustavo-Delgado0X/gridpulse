// Landing at "/", workspace at "/app". Old share links ("/#pair=…") still open the workspace.
export function isLandingPath(pathname: string, hash: string): boolean {
  return (pathname === "/" || pathname === "/index.html") && !/[#&]pair=/.test(hash);
}

export const WORKSPACE_PATH = "/app";
