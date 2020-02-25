import * as df from "../../src";
import { IEntityFunctionContext } from "../../src/classes";

export class TestEntities {
    public static StringStore: any = df.entity((context: IEntityFunctionContext): void => {
        switch (context.df.operationName) {
            case "set":
                context.df.setState(context.df.getInput());
                break;
            case "get":
                context.df.return(context.df.getState());
                break;
            default:
                throw new Error("No such operation exists");
        }
    });

    public static Counter: any = df.entity((context: IEntityFunctionContext): void => {
        const input: number = context.df.getInput() as number;
        const state: number = context.df.getState() as number;
        switch (context.df.operationName) {
            case "increment":
                context.df.setState(input + 1);
                break;
            case "add":
                context.df.setState(state + input);
                break;
            case "get":
                context.df.return(state);
                break;
            case "set":
                context.df.setState(input);
                break;
            case "delete":
                context.df.destructOnExit();
                break;
            default:
                throw Error("Invalid operation");
        }
    });

    public static AsyncStringStore: any = df.entity(async (context: IEntityFunctionContext) => {
        await new Promise((resolve) => {
            switch (context.df.operationName) {
                case "set":
                    context.df.setState(context.df.getInput());
                    break;
                case "get":
                    context.df.return(context.df.getState());
                    break;
                default:
                    throw new Error("No such operation exists");
            }

            resolve();
        });
    });
}
