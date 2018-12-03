const webpack = require('webpack');
const path = require('path');
const productionConfig = require('./webpack.config.production.babel');
const baseConfig = require('./webpack.config.base.babel');
const pkg = require('../package.json');

const PORT = pkg.dev['dev-server-port'];

let devtool;
let plugins;
const output = {
  libraryTarget: 'commonjs2',
  filename: 'cli.min.js'
};

if (process.env.NODE_ENV === 'development') {
  output.path = path.join(__dirname, '../app');
  devtool = 'eval-source-map';
  plugins = [
    new webpack.DefinePlugin({
      'process.env.APP_RENDER_URL': JSON.stringify(`http://localhost:${PORT}/renderer.html`),
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development')
    })
  ];
} else {
  output.path = path.join(__dirname, '../dist');
  devtool = baseConfig.devtool;
  plugins = baseConfig.plugins;
}

module.exports = {
  ...productionConfig,
  devtool: devtool,
  entry: ['./cli.development.js'],
  output: output,
  node: {
    __dirname: false // Use node.js __dirname
  },
  target: 'node',
  plugins: plugins,
  stats: 'errors-only'
};
