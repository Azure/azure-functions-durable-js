import { ManagedIdentityTokenSource } from "../tokensource";

export * from "./activityTypes";
export * from "./durableClientTypes";
export * from "./entityTypes";
export * from "./orchestrationTypes";
export * from "./taskTypes";

// Over time we will likely add more implementations
export type TokenSource = ManagedIdentityTokenSource;
