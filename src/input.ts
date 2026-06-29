import { DurableClientInput } from "durable-functions";
import { input as azFuncInput } from "@azure/functions";
import { addDurableGrpcMetadata, DurableGrpcOptions } from "./durableGrpc";

export function durableClient(options: DurableGrpcOptions = {}): DurableClientInput {
    return azFuncInput.generic(
        addDurableGrpcMetadata(
            {
                type: "durableClient",
            },
            options
        )
    ) as DurableClientInput;
}
