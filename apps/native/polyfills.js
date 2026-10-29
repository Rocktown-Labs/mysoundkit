/* oxlint-disable no-extend-native, func-name-matching, unicorn/consistent-function-scoping, unicorn/no-array-sort, unicorn/no-array-reverse */
/* eslint-disable no-extend-native, func-name-matching, unicorn/consistent-function-scoping, unicorn/no-array-sort, unicorn/no-array-reverse */
import structuredClone from "@ungap/structured-clone";
import { Platform } from "react-native";

// Hermes (React Native JS engine) lacks ES2023 Array#toSorted and Array#toReversed.
// Polyfill synchronously on Array.prototype before any components mount.
if (!Array.prototype.toSorted) {
  Object.defineProperty(Array.prototype, "toSorted", {
    configurable: true,
    value: function toSorted(compareFn) {
      return [...this].sort(compareFn);
    },
    writable: true,
  });
}

if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, "toReversed", {
    configurable: true,
    value: function toReversed() {
      return [...this].reverse();
    },
    writable: true,
  });
}

if (Platform.OS !== "web") {
  const setupPolyfills = async () => {
    const { polyfillGlobal } =
        await import("react-native/Libraries/Utilities/PolyfillFunctions"),
      { TextEncoderStream, TextDecoderStream } =
        await import("@stardazed/streams-text-encoding");

    if (!("structuredClone" in global)) {
      polyfillGlobal("structuredClone", () => structuredClone);
    }

    polyfillGlobal("TextEncoderStream", () => TextEncoderStream);
    polyfillGlobal("TextDecoderStream", () => TextDecoderStream);
  };

  setupPolyfills();
}
