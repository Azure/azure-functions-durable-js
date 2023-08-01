import {
    DurableClientOptions,
    HttpDurableClientOptions,
    TimerDurableClientOptions,
} from "./durableClient";

/**
 * Registers an HTTP-triggered durable client function for your Function App.
 * This function can be triggered as a normal HTTP function, but will receive
 * a Durable Client instance as its second argument.
 *
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function http(functionName: string, options: HttpDurableClientOptions): void;

/**
 * Registered a timer-triggered durable client function for your Function App.
 * This function will be triggered as a normal timer function, but will receive
 * a Durable Client instance as its second argument.
 *
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function timer(functionName: string, options: TimerDurableClientOptions): void;

/**
 * Registers a generic function for your Function App with a Durable Client input.
 *
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function generic(functionName: string, options: DurableClientOptions): void;
