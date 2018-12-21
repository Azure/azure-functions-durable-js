/** @hidden */
export class Constants {
    public static readonly OrchestrationClientNoBindingFoundMessage: string = "An orchestration client function must have an orchestrationClient input binding. Check your function.json definition."; // tslint:disable-line max-line-length

    public static readonly DefaultLocalHost: string = "localhost:7071";
    public static readonly DefaultLocalOrigin: string = `http://${Constants.DefaultLocalHost}`;
}
