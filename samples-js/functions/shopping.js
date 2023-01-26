const df = require("durable-functions");
const { ShoppingCart, items } = require("./shoppingData");

const entityName = "shoppingCartEntity";

df.app.entity(entityName, function (context) {
    const cart = context.df.getState(() => new ShoppingCart());

    switch (context.df.operationName) {
        case "ADD_ITEM":
            const cartItem = context.df.getInput();
            cart.addItem(cartItem);
            break;
        case "REMOVE_ITEM":
            const itemToRemove = context.df.getInput();
            cart.remoteItem(itemToRemove);
            break;
        case "GET_VALUE":
            const value = cart.getCartValue();
            context.df.return(value);
            break;
    }

    context.df.setState(cart);
});

df.app.orchestration("shoppingOrchestration", function* (context) {
    const entityId = new df.EntityId(entityName, "shoppingCart");

    yield context.df.callEntity(entityId, "ADD_ITEM", {
        itemId: items[0].itemId,
        quantity: 1,
    });
    yield context.df.callEntity(entityId, "ADD_ITEM", {
        itemId: items[2].itemId,
        quantity: 2,
    });
    yield context.df.callEntity(entityId, "ADD_ITEM", {
        itemId: items[1].itemId,
        quantity: 10,
    });

    const cartValue = yield context.df.callEntity(entityId, "GET_VALUE");

    context.log(`Final cart value is: ${cartValue}`);
    return cartValue;
});
