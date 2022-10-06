import { FunctionInput } from "@azure/functions";

export interface OrchestrationClientInput extends FunctionInput {
    type: "orchestrationClient";
}
