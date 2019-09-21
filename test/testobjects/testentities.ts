import * as df from "../../src";
import { IEntityFunctionContext, Entity } from "../../src/classes";

export class TestEntities {
    public static StringStore : any = df.entity(function*(context : IEntityFunctionContext) : any  {
        switch(context.df.operationName) {
            case "set":
                context.df.setState(context.df.getInput<string>());
                break;
            case "get":
                let state = context.df.getState<string>();
                context.df.return(state);
                break;
            default: 
                throw new Error("No such operation exists");
        }
    });

    public static Counter : any = df.entity(function*(context: IEntityFunctionContext) : any {
        switch(context.df.operationName) {
            case "increment":
                    
                context.df.setState(context.df.getInput<number>() + 1);
                break;
            case "add":
                context.df.setState(context.df.getState<number>() + context.df.getInput<number>());
                break;
            case "get":
                context.df.return(context.df.getState<number>());
                break;
            case "set":
                context.df.setState(context.df.getInput<number>())
                break;
            case "delete":
                context.df.destructOnExit();
                break;
            default:
                throw Error("Invalid operation");
        }

    });
}