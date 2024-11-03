import { TodoApp } from "./components/TodoApp";
import "./style.css";

document.querySelector<HTMLDivElement>("#app")?.append(TodoApp());
