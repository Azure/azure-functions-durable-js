import * as df from "../../src";
import { IEntityFunctionContext, Entity } from "../../src/classes";

export class TestEntities {
    public static StringStore : any = df.entity(function*(context : IEntityFunctionContext) : any  {
        switch(context.df.operationName) {
            case "set":
                context.df.setState(context.df.getInput<string>());
                break;
            case "get":
                context.df.return(context.df.getState<string>(() => ""));
                break;
            default: 
                throw new Error("No such operation exists");
        }
    });
}