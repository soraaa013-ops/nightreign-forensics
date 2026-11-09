import { ruleset } from "../data/rules.js";
import { inspectRelic } from "./check.js";

const form = document.querySelector("#relic-form");
const inputs = [...form.querySelectorAll('input[name="effect"]')];
const datalist = document.querySelector("#effects");
const report = document.querySelector("#report");
const stamp = document.querySelector("#report-stamp");
const title = document.querySelector("#report-title");
const summary = document.querySelector("#report-summary");
const order = document.querySelector("#report-order");

datalist.replaceChildren(...ruleset.effects.map((effect) => {
  const option = document.createElement("option");
  option.value = effect.name;
  return option;
}));
document.querySelector("#ruleset-version").textContent = ruleset.version;

function render(result) {
  report.className = `report ${result.status}`;
  stamp.textContent = ({ valid: "合法", invalid: "驳回", reorder: "调序", unknown: "待核", incomplete: "缺件" })[result.status];
  title.textContent = result.title;
  summary.textContent = result.summary;
  order.replaceChildren();
  if (result.order) {
    result.order.forEach((item, index) => {
      const li = document.createElement("li");
      li.textContent = `${String(index + 1).padStart(2, "0")}  ${item}`;
      order.append(li);
    });
    order.hidden = false;
  } else order.hidden = true;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  render(inspectRelic(inputs.map((input) => input.value), ruleset));
});
form.addEventListener("reset", () => setTimeout(() => {
  report.className = "report"; stamp.textContent = "待检"; title.textContent = "等待检材";
  summary.textContent = "填入三个词条后，我们再来判断它有没有“出生证明”。"; order.hidden = true;
}, 0));
document.querySelector("#randomize").addEventListener("click", () => {
  const shuffled = [...ruleset.effects].sort(() => Math.random() - .5).slice(0, 3);
  inputs.forEach((input, index) => { input.value = shuffled[index].name; });
  render(inspectRelic(shuffled.map((effect) => effect.name), ruleset));
});
