// The iOS app bundles the web app's shared TypeScript (src/lib, src/stores,
// src/types, src/hooks) straight from ../src, so a logic change lands in both
// apps at once. See AGENTS.md > "Sharing code with the web app".
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const webSrc = path.resolve(projectRoot, '../src');
const appSrc = path.join(projectRoot, 'src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [webSrc];

// Import aliases, resolved here rather than from tsconfig paths (disabled in
// app.json) so bundling never depends on TypeScript-only mappings.
const PATH_ALIASES = [
  ['@/', webSrc],
  ['~/', appSrc],
];

// Web-only packages imported by shared modules, mapped to their React Native
// builds (same export names).
const PACKAGE_ALIASES = {
  'lucide-react': 'lucide-react-native',
  '@tabler/icons-react': '@tabler/icons-react-native',
};

// Shared modules that talk to browser APIs, replaced by native
// implementations. Keyed by resolved path so every import style is caught.
// src/platform/parity.ts type-checks each replacement against the web API.
const NATIVE_REPLACEMENTS = {
  [path.join(webSrc, 'lib/supabase/client.ts')]: path.join(appSrc, 'platform/supabase-client.ts'),
  [path.join(webSrc, 'lib/haptics.ts')]: path.join(appSrc, 'platform/haptics.ts'),
  [path.join(webSrc, 'lib/share.ts')]: path.join(appSrc, 'platform/share.ts'),
};

// Packages imported by the shared web files resolve as if imported from this
// project, so they come from mobile/node_modules and never from the web app's
// own node_modules (a second React would break every hook).
const projectOrigin = path.join(projectRoot, 'index.ts');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  let target = PACKAGE_ALIASES[moduleName] ?? moduleName;
  for (const [prefix, dir] of PATH_ALIASES) {
    if (moduleName.startsWith(prefix)) target = path.join(dir, moduleName.slice(prefix.length));
  }

  const isPackage = !target.startsWith('.') && !path.isAbsolute(target);
  const fromWebSrc = context.originModulePath.startsWith(webSrc + path.sep);
  const resolveContext = isPackage && fromWebSrc ? { ...context, originModulePath: projectOrigin } : context;

  const resolution = context.resolveRequest(resolveContext, target, platform);
  if (resolution.type === 'sourceFile' && NATIVE_REPLACEMENTS[resolution.filePath]) {
    return { type: 'sourceFile', filePath: NATIVE_REPLACEMENTS[resolution.filePath] };
  }
  return resolution;
};

module.exports = config;
