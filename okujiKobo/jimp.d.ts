// jimp is an OPTIONAL runtime dependency. app/api/assets/upload/route.ts
// dynamically imports it inside a try/catch (with `webpackIgnore` so it's
// never bundled) and returns null when it's absent — so it's intentionally
// NOT in package.json. This ambient declaration only stops the dynamic
// `import('jimp')` from erroring under `tsc`; the call site already treats
// the module as `any`. If jimp is ever added as a real dependency, delete
// this shim and rely on its bundled types.
declare module 'jimp'
