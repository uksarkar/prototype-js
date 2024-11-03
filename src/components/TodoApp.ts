import { createComponent } from "../lib";
import { TodoContainer } from "./TodoContainer";
import { TodoForm } from "./TodoForm";

export function TodoApp() {
  return createComponent({
    tagName: "main",
    children: [
      TodoForm(),
      createComponent({
        tagName: "hr"
      }),
      TodoContainer()
    ]
  });
}
