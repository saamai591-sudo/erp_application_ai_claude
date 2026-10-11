// تبدیل خروجی tsc به بایت‌کد V8 (bytenode) برای ایمیج تحویل.
//   node release/compile-bytecode.cjs <ورودی: build-tsc> <خروجی: dist> <نقشه‌ها: dist-maps>
// هر x.js → x.jsc (کنار هم، همان ساختار پوشه‌ها؛ require("./x") خودش x.jsc را پیدا می‌کند و وابستگی دوری مثل قبل کار می‌کند)،
// هر x.js.map به dist-maps می‌رود (فقط برای خودِ شما در پشتیبانی؛ داخل ایمیج نمی‌ماند)، فایل‌های دیگر (json…) عیناً کپی می‌شوند.
// بایت‌کد به نسخه‌ی دقیق Node/V8 وابسته است: این اسکریپت باید با همان Node که در ایمیج اجرا می‌شود اجرا شود (Dockerfile.release).
const fs = require("fs");
const path = require("path");
const bytenode = require("bytenode");

const [inDir, outDir, mapDir] = process.argv.slice(2);
if (!inDir || !outDir || !mapDir) {
  console.error("usage: compile-bytecode.cjs <in> <out> <maps>");
  process.exit(1);
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

(async () => {
  let js = 0;
  let other = 0;
  for (const file of walk(inDir)) {
    const rel = path.relative(inDir, file);
    if (rel.endsWith(".map")) {
      const dest = path.join(mapDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
      continue;
    }
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (rel.endsWith(".js")) {
      await bytenode.compileFile({ filename: file, output: dest.replace(/\.js$/, ".jsc"), compileAsModule: true });
      js += 1;
    } else {
      fs.copyFileSync(file, dest);
      other += 1;
    }
  }
  console.log(`bytecode: ${js} files compiled, ${other} copied as-is`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
