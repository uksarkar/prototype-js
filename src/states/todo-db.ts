import { createEffect, createSignal } from "../lib";

export type Todo = {
  id: string;
  label: string;
  done: boolean;
};

const [todoItems, setTodoItems] = createSignal<Todo[]>(() => {
  try {
    const items = localStorage.getItem("TODO_ITEMS");
    return items ? JSON.parse(items) : [];
  } catch (error) {
    return [];
  }
});

export function getTodoItems() {
  return todoItems();
}

createEffect(() => {
  localStorage.setItem("TODO_ITEMS", JSON.stringify(todoItems()));
});

export function addTodo(todo: Omit<Todo, "id">) {
  setTodoItems(items => [{ ...todo, id: crypto.randomUUID() }, ...items]);
}

export function addAt(todo: Omit<Todo, "id">, position: number) {
  setTodoItems(items => {
    const arr = [...items];
    arr.splice(position, 0, { ...todo, id: crypto.randomUUID() });

    return arr;
  });
}

export function removeTodo(id: string) {
  setTodoItems(items => items.filter(item => item.id !== id));
}

export function updateTodo<K extends keyof Omit<Todo, "id">>(
  id: string,
  key: K,
  value: Todo[K]
) {
  setTodoItems(items =>
    items.map(item => {
      if (item.id === id) {
        item[key] = value;
      }

      return item;
    })
  );
}
