import { DurableClientInput } from "./durableClient";
import { DurableGrpcOptions } from "./durableGrpc";

/**
 * @returns a durable client input configuration object
 */
export function durableClient(options?: DurableGrpcOptions): DurableClientInput;
