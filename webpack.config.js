const path = require('path')

module.exports = {
  target: 'node',
  entry: './src/index.ts',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  externals: [
    '@angular/animations',
    '@angular/common',
    '@angular/compiler',
    '@angular/core',
    '@angular/forms',
    '@angular/platform-browser',
    '@angular/platform-browser-dynamic',
    '@ng-bootstrap/ng-bootstrap',
    'rxjs',
    'rxjs/operators',
    'tabby-core',
    'tabby-terminal',
    'tabby-ssh',
    'electron',
    /^electron\/.*$/,
    /^@electron\/.*$/,
  ],
}
