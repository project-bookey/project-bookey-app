const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * 앱은 자기 디렉터리 안에서 자족적으로 번들한다.
 * 저장소 루트에는 설치된 모듈이 없으므로 감시 범위를 명시적으로 좁힌다.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

// 앱 자신과, 백엔드 계약을 담은 packages/ 만 감시한다.
config.watchFolders = [projectRoot, path.resolve(workspaceRoot, 'packages')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
