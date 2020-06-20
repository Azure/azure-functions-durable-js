import * as df from "durable-functions";
import { CartItem, items, Operations } from "../Shopping/data";

module.exports = df.orchestrator(function* (context) {
    const entityId = new df.EntityId("ShoppingCart", "shoppingCart");

    yield context.df.callEntity<CartItem>(entityId, Operations.ADD_ITEM, {
        itemId: items[0].itemId,
        quantity: 1,
    });
    yield context.df.callEntity<CartItem>(entityId, Operations.ADD_ITEM, {
        itemId: items[2].itemId,
        quantity: 2,
    });
    yield context.df.callEntity<CartItem>(entityId, Operations.ADD_ITEM, {
        itemId: items[1].itemId,
        quantity: 10,
    });

    const cartValue: number = yield context.df.callEntity<number>(entityId, Operations.GET_VALUE);

    console.log(cartValue);
});
