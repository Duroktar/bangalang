/* eslint-disable */
// Generated using webpack-cli https://github.com/webpack/webpack-cli

// const path = require("path");

const isProduction = process.env.NODE_ENV == "production";

const config = {
    target: 'node',
    entry: {
        extension: "./client/src/extension.ts",
        server: "./server/src/server.ts",
    },
    output: {
        filename: '[name].js',
        path: __dirname + '/dist',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    plugins: [
        // Add your plugins here
        // Learn more about plugins from https://webpack.js.org/configuration/plugins/
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: __dirname + "/client/tsconfig.json"
                    }
                }],
                exclude: /node_modules/,
            },
            {
                test: /\.ts$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: __dirname + "/server/tsconfig.json"
                    }
                }],
                exclude: /node_modules/,
            }
            // Add your rules for custom modules here
            // Learn more about loaders from https://webpack.js.org/loaders/
        ],
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    externals: {
        vscode: 'commonjs vscode'
    }
};

module.exports = () => {
    if (isProduction) {
        config.mode = "production";
    } else {
        config.mode = "development";
        consig.devtool = "eval-cheap-module-source-map";
    }
    return config;
};
