const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** 감시·해석 범위를 이 프로젝트로 고정한다. */
const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
