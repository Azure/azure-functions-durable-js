const items = [
    {
        itemId: "qwe",
        price: 5,
    },
    {
        itemId: "asd",
        price: 1,
    },
    {
        itemId: "zxc",
        price: 3,
    },
    {
        itemId: "iop",
        price: 10,
    },
    {
        itemId: "jkl",
        price: 8,
    },
    {
        itemId: "bnm",
        price: 2,
    },
];

module.exports.items = items;

class ShoppingCart {
    #items = [];

    constructor() {
        this.#items = [];
    }

    addItem(item) {
        this.#items.push(item);
    }

    remoteItem(itemId) {
        const index = this.#items.findIndex((item) => item.itemId === itemId);
        this.#items = this.#items.slice(index, index + 1);
    }

    getCartValue() {
        return this.#items.reduce(
            (value, item) =>
                value + item.quantity * items.find((i) => i.itemId === item.itemId).price,
            0
        );
    }
}
module.exports.ShoppingCart = ShoppingCart;
