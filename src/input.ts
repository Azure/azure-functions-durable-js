import { DurableClientInput } from "durable-functions";
import { input as azFuncInput } from "@azure/functions";

export function durableClient(): DurableClientInput {
    return azFuncInput.generic({
        type: "durableClient",
    }) as DurableClientInput;
}
