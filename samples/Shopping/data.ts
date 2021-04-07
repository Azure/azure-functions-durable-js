export type Item = {
    itemId: string;
    price: number;
};

export const items = [
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

export type CartItem = {
    itemId: string;
    quantity: number;
};
export class ShoppingCart {
    #items: CartItem[];

    constructor() {
        this.#items = [];
    }

    public addItem(item: CartItem): void {
        this.#items.push(item);
    }

    public remoteItem(itemId: string): void {
        const index = this.#items.findIndex((item) => item.itemId === itemId);
        this.#items = this.#items.slice(index, index + 1);
    }

    public getCartValue(): number {
        return this.#items.reduce(
            (value, item) =>
                value + item.quantity * items.find((i) => i.itemId === item.itemId).price,
            0
        );
    }
}

export enum Operations {
    ADD_ITEM = "ADD_ITEM",
    REMOVE_ITEM = "REMOVE_ITEM",
    GET_VALUE = "GET_VALUE",
}
