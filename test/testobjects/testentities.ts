import * as df from "../../src";

export class TestEntities {
    public static StringStore = df.entity<string>((context): void => {
        switch (context.df.operationName) {
            case "set":
                context.df.setState(context.df.getInput() || "");
                break;
            case "get":
                context.df.return(context.df.getState() || "");
                break;
            default:
                throw new Error("No such operation exists");
        }
    });

    public static Counter = df.entity<number>((context): void => {
        const input = context.df.getInput();
        const state = context.df.getState();

        if (input === undefined || state === undefined) {
            throw new Error("Input or state not set");
        }

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

    public static AsyncStringStore = df.entity<string>(async (context) => {
        await new Promise((resolve) => setTimeout(() => resolve(), 0)); // force onto the event loop and result in a no-op delay
        switch (context.df.operationName) {
            case "set":
                context.df.setState(context.df.getInput() || "");
                break;
            case "get":
                context.df.return(context.df.getState() || "");
                break;
            default:
                throw new Error("No such operation exists");
        }
    });
}
