import {
  conditionalComponent,
  createComponent,
  createSignal,
  textComponent
} from "../lib";
import { removeTodo, Todo, updateTodo } from "../states/todo-db";

export function TodoItem(todo: () => Todo) {
  const [isLoading, setIsLoading] = createSignal(false);

  function onDelete() {
    setIsLoading(true);
    setTimeout(() => {
      removeTodo(todo().id);
      setIsLoading(false);
    }, 3000);
  }

  return createComponent({
    tagName: "div.todo-item",
    children: () => {
      const deleteButton = createComponent({
        tagName: "button.btn.delete-sm",
        children: textComponent(() => (isLoading() ? "Removing" : "Remove")),
        classes: () => (isLoading() ? "is-loading" : null),
        attributes: {
          disabled: () => (isLoading() ? "true" : null)
        },
        events: {
          click: onDelete
        }
      });

      const sign = createComponent({
        tagName: "i",
        classes: () => (todo().done ? "success" : "danger"),
        children: textComponent(() => (todo().done ? "✔" : "✖"))
      });

      const doneButton = conditionalComponent(
        {
          tagName: "button.done-sm",
          children: "Done",
          events: {
            click: () => updateTodo(todo().id, "done", true)
          }
        },
        () => !todo().done
      );

      return [
        sign,
        textComponent(() => todo().label),
        createComponent({
          tagName: "div.group",
          children: [doneButton, deleteButton]
        })
      ];
    }
  });
}
