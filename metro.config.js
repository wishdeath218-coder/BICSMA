const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Supabase ships ESM (.mjs) sub-packages that Metro's default resolver can't
// follow. Enabling package "exports" resolution + adding .mjs/.cjs fixes it.
config.resolver.unstable_enablePackageExports = true;
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = withNativeWind(config, { input: './global.css' });
