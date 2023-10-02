import {
    CosmosDBDurableClientOptions,
    DurableClientOptions,
    EventGridDurableClientOptions,
    EventHubDurableClientOptions,
    HttpDurableClientOptions,
    ServiceBusQueueDurableClientOptions,
    ServiceBusTopicDurableClientOptions,
    StorageBlobDurableClientOptions,
    StorageQueueDurableClientOptions,
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
 * Registers a storage blob-triggered Durable Client function for your app.
 * This function will be triggered whenever an item is added to a storage blob path,
 *   and receives a DurableClient instance as its second argument.
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function storageBlob(functionName: string, options: StorageBlobDurableClientOptions): void;

/**
 * Registers a storage queue-triggered durable client function in  your app.
 * This function will be triggered whenever an item is added to a storage queue,
 *   and receives a DurableClient instance as its second argument.
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function storageQueue(functionName: string, options: StorageQueueDurableClientOptions): void;

/**
 * Registers a service bus queue-triggered durable client function in your app.
 * This function will be triggered whenever a message is added to a service bus queue,
 *   and receives a DurableClient instance as its second argument.
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function serviceBusQueue(
    functionName: string,
    options: ServiceBusQueueDurableClientOptions
): void;

/**
 * Registers a service bus topic-triggered durable client function in your app.
 * This function will be triggered whenever a message is added to a service bus topic,
 *  and receives a DurableClient instance as its second argument.
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function serviceBusTopic(
    functionName: string,
    options: ServiceBusTopicDurableClientOptions
): void;

/**
 * Registers an EventHub-triggered durable client function in your app.
 * This function will be triggered whenever a message is added to an event hub,
 *   and receives a DurableClient instance as its second argument.
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function eventHub(functionName: string, options: EventHubDurableClientOptions): void;

/**
 * Registers an EventGrid-triggered durable client function in your app.
 * This function will be triggered whenever an event is sent by an event grid source,
 *  and receives a DurableClient instance as its second argument.
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function eventGrid(functionName: string, options: EventGridDurableClientOptions): void;

/**
 * Registers a CosmosDB-triggered durable client function in your app.
 * This function will be triggered whenever inserts and updates occur (not deletions),
 *  and receives a DurableClient instance as its second argument.
 * @param name The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function cosmosDB(functionName: string, options: CosmosDBDurableClientOptions): void;

/**
 * Registers a generic function for your Function App with a Durable Client input.
 *
 * @param functionName The name of the function. The name must be unique within your app and will mostly be used for your own tracking purposes
 * @param options Configuration options describing the inputs, outputs, and handler for this function
 */
export function generic(functionName: string, options: DurableClientOptions): void;
