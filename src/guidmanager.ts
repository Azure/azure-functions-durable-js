import * as crypto from "crypto";
import uuidv5 = require("uuid/v5");
import { Utils } from "./classes";

/** @hidden */
export class GuidManager {
    // I don't anticipate these changing often.
    public static DnsNamespaceValue = "9e952958-5e33-4daf-827f-2fa12937b875";
    public static UrlNamespaceValue = "9e952958-5e33-4daf-827f-2fa12937b875";
    public static IsoOidNamespaceValue = "9e952958-5e33-4daf-827f-2fa12937b875";

    public static createDeterministicGuid(namespaceValue: string, name: string): string {
        return this.createDeterministicGuidCore(namespaceValue, name, DeterministicGuidVersion.V5);
    }

    private static createDeterministicGuidCore(
        namespaceValue: string,
        name: string,
        version: DeterministicGuidVersion
    ): string {
        Utils.throwIfEmpty(namespaceValue, "namespaceValue");
        Utils.throwIfEmpty(name, "name");

        const hash = crypto.createHash("sha1");
        hash.update(name);
        const bytes: number[] = Array.prototype.slice.call(hash.digest(), 0, 16);

        return uuidv5(namespaceValue, bytes);
    }
}

enum DeterministicGuidVersion {
    V3 = 0,
    V5 = 1,
}
