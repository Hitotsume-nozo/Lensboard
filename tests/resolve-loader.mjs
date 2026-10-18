export async function resolve(specifier, context, defaultResolve) {
  if (specifier === '@lensboard/core') {
    return {
      url: new URL('../packages/core/dist/index.js', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return defaultResolve(specifier, context);
}
