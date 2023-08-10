const { merge } = require('webpack-merge');

/**
 *
 * @param env {{goal:string} }
 * @returns {*}
 */
module.exports = (env) => {

  console.log(`获取env`)
  console.log(env)
  const envConfig = require(`./webpack.${env.goal}.js`);
  global.env = env
  const baseConfig = require('./webpack.base.js');
  return merge(baseConfig, envConfig);
};
