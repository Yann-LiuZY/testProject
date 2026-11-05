const fs = require('fs');
const path = require('path');
const { Controller } = require('egg');

const debugPage = path.join(__dirname, '../public/api-debug.html');

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    ctx.type = 'html';
    ctx.set('Cache-Control', 'no-store');
    ctx.body = await fs.promises.readFile(debugPage);
  }

  test() {
    const { ctx } = this;
    ctx.body = {
      data: 'test',
    };
  }
}

module.exports = HomeController;
