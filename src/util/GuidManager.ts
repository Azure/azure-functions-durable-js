import * as crypto from "crypto";
/** @hidden */
import { v5 as uuidv5 } from "uuid";
import { Utils } from "./Utils";

/** @hidden */
export class GuidManager {
    // I don't anticipate these changing often.
    public static DnsNamespaceValue = "9e952958-5e33-4daf-827f-2fa12937b875";
    public static UrlNamespaceValue = "9e952958-5e33-4daf-827f-2fa12937b875";
    public static IsoOidNamespaceValue = "9e952958-5e33-4daf-827f-2fa12937b875";

    public static createDeterministicGuid(namespaceValue: string, name: string): string {
        return this.createDeterministicGuidCore(namespaceValue, name);
    }

    private static createDeterministicGuidCore(namespaceValue: string, name: string): string {
        Utils.throwIfEmpty(namespaceValue, "namespaceValue");
        Utils.throwIfEmpty(name, "name");

        const hash = crypto.createHash("sha1"); // CodeQL [SM04514] Suppressed: SHA1 is not used for cryptographic purposes here. The information being hashed is not sensitive, 
                                              //   and the goal is to generate a deterministic Guid. We cannot update to SHA2-based algorithms without breaking
                                              //   customers' inflight orchestrations.
        hash.update(name);
        const bytes: number[] = Array.prototype.slice.call(hash.digest(), 0, 16);

        return uuidv5(namespaceValue, bytes);
    }
}
