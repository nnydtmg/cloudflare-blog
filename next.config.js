// next.config.mjs
// import nextMDX from "@next/mdx";
// import gfm from "remark-gfm";
// import remarkMath from "remark-math";
// import rehypeKatex from "rehype-katex";
// import rehypePrism from "@mapbox/rehype-prism";
// import rehypeSlug from "rehype-slug";
// import remarkToc from "remark-toc";
// const gfm = require('remark-gfm')();
// const remarkMath = require('remark-math')();
// const rehypeKatex = require('rehype-katex')();
// const rehypePrism = require('@mapbox/rehype-prism')();
// const rehypeSlug = require('rehype-slug')();
// const remarkToc = require('remark-toc')();

// const withMDX = require('@next/mdx')({
//   extensions: /\.mdx?$/,
//   options: {
//     remarkPlugins: [
//       gfm,
//       remarkMath,
//       [remarkToc, { maxDepth: 3, heading: "目次" }],
//     ],
//     rehypePlugins: [rehypeKatex, rehypePrism, rehypeSlug],
//  },
// });

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//  // Configure pageExtensions to include md and mdx
//  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
//  // Optionally, add any other Next.js config below
//  reactStrictMode: true,
// };

// // Merge MDX config with Next.js config
// module.exports = withMDX(nextConfig);

/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports =  {
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
}