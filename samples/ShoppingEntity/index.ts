import * as df from "durable-functions";
import { CartItem, ShoppingCart, Operations } from "../Shopping/data";

module.exports = df.entity<ShoppingCart>(function (context) {
    const cart = context.df.getState(() => new ShoppingCart());

    switch (context.df.operationName) {
        case Operations.ADD_ITEM:
            const cartItem = context.df.getInput<CartItem>();
            cart.addItem(cartItem);
            break;
        case Operations.REMOVE_ITEM:
            const itemToRemove = context.df.getInput<string>();
            cart.remoteItem(itemToRemove);
            break;
        case Operations.GET_VALUE:
            const value = cart.getCartValue();
            context.df.return(value);
            break;
    }

    context.df.setState(cart);
});
