import { FunctionInput } from "@azure/functions";

export interface DurableClientInput extends FunctionInput {
    type: "orchestrationClient";
}
