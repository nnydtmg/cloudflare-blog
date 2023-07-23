/** @type {import('next').NextConfig} */
const nextConfig = {}

// module.exports = nextConfig

// module.exports = {
//   webpack: (config, { isServer }) => {
//       // 空のオブジェクト渡すことでnpmパッケージがfsモジュールに依存しないようにします
//       if (!isServer) {
//           config.node = {
//               fs: 'empty',
//               path: 'empty'
//           }
//       }
//       return config
//   }
// }

module.exports =  {
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
}