import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'development',
  entry: {
    main: ['./index.js', './index.css']
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '',
  },
  resolve: {
    fallback: {
      "fs": false,
      "net": false,
      "tls": false,
      "child_process": false,
      "dns": false,
      "dgram": false,
      "os": false,
      "path": false,
      "crypto": false,
      "stream": false,
      "buffer": false,
      "util": false
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules\/(?!ice)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            sourceType: 'unambiguous',
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      templateContent: () => {
        const raw = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');
        return raw.replace(
          /<script\s+src=["']index\.js["'][^>]*><\/script>/i,
          '<script src="bundle.js"></script>'
        );
      },
      inject: false
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, './'),
    },
    historyApiFallback: true,
    compress: true,
    port: 8080,
    hot: true,
    open: false, // Prevent auto-opening browser
  },
};
