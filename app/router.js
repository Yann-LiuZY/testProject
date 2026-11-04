/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  router.get('/test', controller.home.test);
  router.get('/api/debug-config/consume', controller.debugConfig.consume);
  router.get('/api/debug-config', controller.debugConfig.show);
  router.post('/api/debug-config', controller.debugConfig.create);
  router.delete('/api/debug-config', controller.debugConfig.destroy);
  router.get('/api/page-visit', controller.pageVisit.show);
  router.post('/api/page-visit', controller.pageVisit.open);
};
