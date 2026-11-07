const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const bundlePath = path.join(__dirname, "showcase.bundle.js");

esbuild.buildSync({
  entryPoints: [path.join(__dirname, "showcase.js")],
  bundle: true,
  platform: "browser",
  format: "iife",
  minify: true,
  legalComments: "inline",
  outfile: bundlePath,
});

const bundle = fs.readFileSync(bundlePath, "utf8");
fs.writeFileSync(bundlePath, bundle.replace(/[ \t]+$/gm, ""));