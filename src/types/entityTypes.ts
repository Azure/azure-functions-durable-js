import { FunctionOptions, FunctionTrigger } from "@azure/functions";
import { IEntityFunctionContext } from "../ientityfunctioncontext";

export type EntityHandler<T> = (context: IEntityFunctionContext<T>) => void;

export interface EntityOptions<T> extends Partial<FunctionOptions> {
    handler: EntityHandler<T>;
}

export interface EntityTrigger extends FunctionTrigger {
    type: "entityTrigger";
}
