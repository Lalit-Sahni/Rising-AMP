const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Enable code splitting
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
            },
            // Separate Firebase bundle
            firebase: {
              test: /[\\/]node_modules[\\/]firebase[\\/]/,
              name: 'firebase',
              chunks: 'all',
              priority: 20,
            },
            // Separate chart libraries
            charts: {
              test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
              name: 'charts',
              chunks: 'all',
              priority: 15,
            },
            // Separate OCR libraries
            ocr: {
              test: /[\\/]node_modules[\\/](tesseract)[\\/]/,
              name: 'ocr',
              chunks: 'all',
              priority: 15,
            },
          },
        },
        // Optimize runtime
        runtimeChunk: {
          name: 'runtime',
        },
      };

      // Enable tree shaking
      webpackConfig.optimization.usedExports = true;
      webpackConfig.optimization.sideEffects = false;

      // Optimize module resolution
      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        fallback: {
          ...webpackConfig.resolve.fallback,
          fs: false,
          net: false,
          tls: false,
        },
      };

      // Add bundle analyzer in development
      if (env === 'development') {
        webpackConfig.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'bundle-report.html',
          })
        );
      }

      return webpackConfig;
    },
  },
  
  // Optimize PostCSS
  style: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
        // Add CSS optimization
        require('cssnano')({
          preset: ['default', {
            discardComments: {
              removeAll: true,
            },
            normalizeWhitespace: true,
          }],
        }),
      ],
    },
  },
}; 