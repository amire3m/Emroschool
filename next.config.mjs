import withSerwist from "@serwist/next";

const nextConfig = {
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/api/favicon" }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "imamruhollahschool.com" },
    ],
  },
};

export default withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: true,
  reloadOnOnline: true,
  globPublicPatterns: ["icons/**/*", "sw.js"],
})(nextConfig);
