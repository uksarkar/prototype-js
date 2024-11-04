// Global variables
let activeEffect: (() => void) | null = null;

// State managements
export function createEffect(fn: () => void) {
  // Instead of running `fn` immediately, `createEffect` should register the effect
  // This will allow it to be re-run whenever a signal that it depends on updates.
  activeEffect = fn;
  fn();
  activeEffect = null;
}

// Modify createSignal to track effects
export function createSignal<T>(
  initialValue: T | (() => T)
): [() => T, (newValue: T | ((prev: T) => T)) => void] {
  let value =
    typeof initialValue === "function"
      ? (initialValue as () => T)()
      : initialValue;
  const subscribers = new Set<() => void>();

  function get() {
    // If there's an active effect, register it as a subscriber
    if (activeEffect) {
      subscribers.add(activeEffect);
    }
    return value;
  }

  function set(newValue: T | ((prev: T) => T)) {
    value =
      typeof newValue === "function"
        ? (newValue as (prev: T) => T)(value)
        : newValue;
    subscribers.forEach(fn => fn()); // Trigger all registered effects
  }

  return [get, set];
}

// Component management
type ComponentChild =
  | string
  | number
  | Text
  | DocumentFragment
  | Comment
  | HTMLElement;

type ComponentOptions = {
  tagName: string;
  children?:
    | ComponentChild
    | ComponentChild[]
    | (() => ComponentChild | ComponentChild[]);
  classes?:
    | string
    | (() => string | undefined | null)
    | (string | (() => string | undefined | null))[];
  events?: Record<string, (e: Event) => void>;
  attributes?: Record<
    string,
    string | number | (() => string | number | undefined | null)
  >;
};

export function createComponent({
  tagName,
  attributes,
  children,
  classes,
  events
}: ComponentOptions): HTMLElement {
  const parseEmmet = (input: string): [HTMLElement, HTMLElement] => {
    const tagParts = input.split(">");
    let rootElement: HTMLElement | null = null;
    let currentElement: HTMLElement | null = null;

    for (const part of tagParts) {
      const [, tag = "div", id = "", classes = ""] =
        part.match(/(\w+)?(?:#([\w-]+))?(?:\.([\w-.]+))?/) || [];

      const element = document.createElement(tag);

      if (id) element.id = id;
      if (classes) element.className = classes.split(".").join(" ");

      if (!rootElement) {
        rootElement = element;
      } else {
        currentElement?.appendChild(element);
      }

      currentElement = element;
    }

    return [rootElement!, currentElement!];
  };

  // Create the element based on the specified tag
  const [root, element] = parseEmmet(tagName);

  // Apply classes
  if (classes) {
    const addClass = (str: string | (() => string | undefined | null)) => {
      if (typeof str === "function") {
        let referenceClass: string;

        createEffect(() => {
          const strClass = str();

          if (strClass !== undefined && strClass !== null) {
            if (!element.classList.contains(strClass)) {
              element.classList.add(strClass);
            }

            if (referenceClass && strClass !== referenceClass) {
              element.classList.remove(referenceClass);
            }

            referenceClass = strClass;
          } else if (referenceClass) {
            element.classList.remove(referenceClass);
          }
        });
      } else {
        element.classList.add(str);
      }
    };

    if (Array.isArray(classes)) {
      classes.forEach(addClass);
    } else {
      addClass(classes);
    }
  }

  // Apply events
  if (events) {
    for (const [event, handler] of Object.entries(events)) {
      element.addEventListener(event, handler);
    }
  }

  // Apply attributes
  if (attributes) {
    for (const [attr, value] of Object.entries(attributes)) {
      if (typeof value === "function") {
        createEffect(() => {
          const val = value();

          if (val !== undefined && val !== null) {
            element.setAttribute(attr, val.toString());
          } else {
            element.removeAttribute(attr);
          }
        });
      } else {
        element.setAttribute(attr, value.toString());
      }
    }
  }

  // Append children
  if (children) {
    const addChild = (child: ComponentChild) => {
      if (typeof child === "string" || typeof child === "number") {
        element.appendChild(document.createTextNode(String(child)));
      } else {
        element.appendChild(child);
      }
    };

    if (typeof children === "function") {
      const childElement = children();

      if (Array.isArray(childElement)) {
        childElement.forEach(addChild);
      } else {
        addChild(childElement);
      }
    } else if (Array.isArray(children)) {
      children.forEach(addChild);
    } else {
      addChild(children);
    }
  }

  return root;
}

export function textComponent(text: () => string): Text {
  const t = document.createTextNode("");
  createEffect(() => {
    t.textContent = text();
  });

  return t;
}

// Conditionally render an element
// strategy `display` will be show/hide by setting display: none,
// and the `remove` will work by removing and adding the element
export function conditionalComponent(
  options: ComponentOptions,
  condition: () => boolean,
  strategy: "display" | "remove" = "display"
): HTMLElement | Comment {
  if (strategy === "display") {
    const component = createComponent(options);
    // Use display strategy
    createEffect(() => {
      component.style.display = condition() ? "" : "none";
    });
    return component;
  }

  // Use remove strategy
  let elm: ReturnType<typeof createComponent> | undefined;
  let placeholder: Comment | undefined;
  let parentNode: Node;

  createEffect(() => {
    // first let's get the parent node here
    // allays run the parent node strategy at the beginning
    if (!parentNode) {
      if (elm && elm.parentNode) {
        parentNode = elm.parentNode;
      } else if (placeholder && placeholder.parentNode) {
        parentNode = placeholder.parentNode;
      }
    }

    // if there isn't any parent node
    // assuming it's the first run
    if (!parentNode) {
      if (condition()) {
        elm = createComponent(options);
      } else {
        placeholder = document.createComment("hidden");
      }

      return;
    }

    // in this stage if there isn't any parent node
    // the strategy won't work
    if (!parentNode) {
      throw new Error("Unable to find the parent node");
    }

    if (condition()) {
      if (placeholder && parentNode.contains(placeholder)) {
        elm = createComponent(options);
        parentNode.replaceChild(elm, placeholder);
        placeholder = undefined;
      }
    } else {
      if (elm && parentNode.contains(elm)) {
        placeholder = document.createComment("hidden");
        parentNode.replaceChild(placeholder, elm);
        elm = undefined;
      }
    }
  });

  return elm || placeholder!;
}

export function listComponent<T extends object>(
  items: () => T[],
  renderItem: (item: () => T, index: number) => ComponentChild
): ComponentChild[] {
  const itemMap = new Map<
    T,
    {
      element: Text | DocumentFragment | Comment | HTMLElement;
      id: string;
      setter: ReturnType<typeof createSignal<T>>[1];
      position: number;
    }
  >();
  let parentNode: Node | undefined;
  let referenceElm: Comment | undefined;

  // Create effect to reactively handle the list
  createEffect(() => {
    const currentItems = items();

    // Determine the parent node if not set
    if (!parentNode) {
      if (referenceElm && referenceElm.parentNode) {
        parentNode = referenceElm.parentNode;
        parentNode.removeChild(referenceElm);
        referenceElm = undefined;
      } else {
        const elm = itemMap.values().next().value;
        if (elm?.element.parentNode) {
          parentNode = elm?.element.parentNode;
        }
      }
    }

    // Remove items not in the new list
    itemMap.forEach(({ element }, item) => {
      if (!currentItems.includes(item)) {
        parentNode?.removeChild(element);
        itemMap.delete(item);
      }
    });

    // Add or update items
    currentItems.forEach((item, i) => {
      let obj = itemMap.get(item);
      const id = JSON.stringify(item);
      const isPositionChanged = obj?.position !== i;

      if (!obj) {
        const [getter, setter] = createSignal(item);
        let newElement = renderItem(getter, i);

        // Convert primitive to TextNode if needed
        if (typeof newElement === "string" || typeof newElement === "number") {
          newElement = document.createTextNode(String(newElement));
        }

        obj = { id, element: newElement, position: i, setter };
        itemMap.set(item, obj);
      } else if (id !== obj.id) {
        // Update existing item
        obj.setter(() => item);
        obj.id = id;
        obj.position = i;
      }

      if (obj && isPositionChanged) {
        const targetPosition = Array.from(parentNode?.childNodes ?? []).find(
          (_, index) => index === i
        );

        if (targetPosition !== obj.element) {
          if (targetPosition) {
            parentNode?.insertBefore(obj.element, targetPosition);
          } else {
            parentNode?.appendChild(obj.element);
          }
        }

        obj.position = i;
        itemMap.set(item, obj);
      }
    });
  });

  // Convert Map values to an array for the initial render
  const elements = Array.from(itemMap.values()).map(
    ({ element }) => element
  ) as ComponentChild[];

  // to track the parent element
  if (!elements.length) {
    referenceElm = document.createComment("render list items");
    elements.push(referenceElm);
  }

  return elements;
}

interface InputOption extends Omit<ComponentOptions, "tagName"> {
  tagName: "input" | "textarea";
  event: "change" | "input";
  get: ReturnType<typeof createSignal<string>>[0];
  set: ReturnType<typeof createSignal<string>>[1];
}

export function inputComponent({ event, get, set, ...options }: InputOption) {
  const input = createComponent(options) as HTMLInputElement;

  // Initial setting of input value
  input.value = get();

  // Update signal when input changes
  input.addEventListener(event, e => set((e.target as HTMLInputElement).value));

  // Update input when signal changes
  createEffect(() => {
    input.value = get();
  });

  return input;
}
