// Ambient declaration of Symbol.dispose for projects targeting < ES2023.
// TypeScript >=5.2 includes this in lib.esnext.disposable, but the SDK
// targets ES6 to support older Node versions, so we augment the symbol
// globally here.

declare global {
    interface SymbolConstructor {
        readonly dispose: unique symbol;
    }
}

export {};
