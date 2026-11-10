/* eslint valid-jsdoc: "off" */

const path = require('path');

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
  config.middleware = [ 'requestId' ];

  // 调试页静态资源，只暴露 assets 目录，避免把 app/public 下的其他文件暴露出去
  config.static = {
    prefix: '/assets/',
    dir: path.join(appInfo.baseDir, 'app/public/assets'),
  };

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

  // 内存中保留的页面打开记录上限，超出后淘汰最久没有被打开过的 tab
  config.pageVisit = {
    maxTabs: 100,
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
