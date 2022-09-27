import { FunctionInput } from "@azure/functions";

export interface ClientInput extends FunctionInput {
    type: "orchestrationClient";
}
