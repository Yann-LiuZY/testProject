/* eslint valid-jsdoc: "off" */

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1721452540862_9720';

  // add your middleware config here
  config.middleware = [];

  config.security = {
    csrf: {
      ignore: [ '/api/debug-config', '/api/page-visit' ],
    },
  };

  config.customLogger = {
    pageVisitLogger: {
      file: 'page-visit.log',
    },
  };

  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  };

  return {
    ...config,
    ...userConfig,
  };
};
