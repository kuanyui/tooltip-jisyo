const webpack = require('webpack')
const CopyPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const config = {
    entry: {
        background: './src/background.ts',
        content: './src/content.ts',
        options_ui: './options_ui/index.tsx'
    },
    output: {
        filename: '[name].js',
        path: __dirname + '/dist'
    },
    module: {
        rules: [
            // { test: /\.ts$/, use: {
            //     loader: 'ts-loader',
            //     }
            // },
            {
                test: /\.tsx?$/,
                use: [
                    { loader: 'babel-loader', },
                    { loader: 'ts-loader', },
                ]
            },
            { test: /\.pug$/, loader: 'pug-plain-loader' },
            { test: /\.styl(us)?$/, use: [ 'css-loader', 'stylus-loader' ] },
            { test: /\.(gif|svg|jpg|png)$/, loader: "file-loader" },
            { test: /\.css$/, use: ['style-loader', 'css-loader'] }
        ]
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js', '.jsx' ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './options_ui/index.html',
            filename: 'options_ui.html',
            chunks: ['options_ui']
        }),
        new CopyPlugin([
            // { from: 'options_ui/index.html', to: 'options_ui.html', force: true, toType: 'file' },
            { from: 'src/content.css', to: 'content.css', force: true, toType: 'file' },
            // { from: 'manifest.json', to: 'manifest.json', force: true, toType: 'file' },
        ]),
    ]
}

module.exports = (env, argv) => {
    console.log('Current webpack mode is', argv.mode)
    config.plugins.push(
        new webpack.DefinePlugin({
            __COMPILE_ENV__: {
                NODE_ENV: JSON.stringify(argv.mode),
            },
        })
    )
    if (argv.mode === 'development') {
        config.devtool = 'source-map';
    }

    if (argv.mode === 'production') {
        //...
    }

    return config
};
