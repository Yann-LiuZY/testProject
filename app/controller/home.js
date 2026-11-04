const { Controller } = require('egg');

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    ctx.body = 'hi, egg';
  }

  test() {
    const { ctx } = this;
    ctx.body = {
      data: 'test',
    };
  }
}

module.exports = HomeController;
