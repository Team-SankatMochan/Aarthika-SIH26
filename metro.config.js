const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude backend, virtual environments, and mock API from Metro file watcher and resolver
const exclusionList = [
  /.*[/\\]backend[/\\].*/,
  /.*[/\\]AARTHIKA_mock_api[/\\].*/,
  /.*[/\\]\.venv[/\\].*/,
];

if (config.resolver.blockList) {
  if (Array.isArray(config.resolver.blockList)) {
    config.resolver.blockList.push(...exclusionList);
  } else {
    config.resolver.blockList = [config.resolver.blockList, ...exclusionList];
  }
} else {
  config.resolver.blockList = exclusionList;
}

module.exports = config;
