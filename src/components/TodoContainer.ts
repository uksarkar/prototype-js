import { createComponent, listComponent } from "../lib";
import { getTodoItems } from "../states/todo-db";
import { TodoItem } from "./TodoItem";

export function TodoContainer() {
  return createComponent({
    tagName: "div.todo-container",
    children: listComponent(getTodoItems, item => TodoItem(item))
  });
}
