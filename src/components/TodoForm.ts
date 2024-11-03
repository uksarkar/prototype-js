import {
  conditionalComponent,
  createComponent,
  createSignal,
  inputComponent
} from "../lib";
import { addTodo } from "../states/todo-db";

export function TodoForm() {
  const [text, setText] = createSignal("");

  function createTodo() {
    if (text().length < 4) {
      return;
    }

    addTodo({
      done: false,
      label: text()
    });
    setText("");
  }

  return createComponent({
    tagName: "div.form-group",
    children: [
      createComponent({
        tagName: "div.form-input",
        children: [
          inputComponent({
            tagName: "input",
            event: "input",
            attributes: {
              type: "text",
              placeholder: "Type todo name"
            },
            get: text,
            set: setText
          }),
          createComponent({
            tagName: "button.btn-success",
            children: "Add",
            events: {
              click: () => createTodo()
            }
          })
        ]
      }),
      conditionalComponent(
        {
          tagName: "strong.feedback",
          children: "Todo name must be at least 4 charters long"
        },
        () => text().length < 4,
        "remove"
      )
    ]
  });
}
