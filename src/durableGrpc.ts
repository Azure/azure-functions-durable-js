export interface DurableGrpcOptions {
    durableRequiresGrpc?: boolean;
}

export type DurableBindingMetadata = { type: string } & Record<string, unknown>;

export function addDurableGrpcMetadata(
    binding: DurableBindingMetadata,
    options: DurableGrpcOptions = {}
): DurableBindingMetadata & DurableGrpcOptions {
    if (options.durableRequiresGrpc === true) {
        return {
            ...binding,
            durableRequiresGrpc: true,
        };
    }

    return binding;
}

export function omitDurableGrpcOptions<TOptions extends DurableGrpcOptions>(
    options: TOptions
): Omit<TOptions, "durableRequiresGrpc"> {
    const functionOptions = { ...options };
    delete functionOptions.durableRequiresGrpc;
    return functionOptions;
}
