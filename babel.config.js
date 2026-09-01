module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'], // 반드시 plugins 마지막
  };
};
