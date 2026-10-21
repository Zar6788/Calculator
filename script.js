(() => {
  const expressionEl = document.querySelector("#expression");
  const resultEl = document.querySelector("#result");
  const modeEl = document.querySelector("#mode");

  let expression = "";
  let answer = 0;
  let angleMode = "DEG";
  let justCalculated = false;
  let history = [];

  try {
    history = JSON.parse(
      localStorage.getItem("scientificCalculatorHistory") || "[]"
    );

    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }

  const pretty = text => text
    .replaceAll("*", "×")
    .replaceAll("/", "÷")
    .replaceAll("-", "−");

  function format(number) {
    if (!Number.isFinite(number)) {
      throw new Error("Math error");
    }

    if (Math.abs(number) < 1e-14) {
      return "0";
    }

    return Number(number.toPrecision(12)).toString();
  }

  function tokenize(text) {
    const tokens = [];
    let i = 0;

    while (i < text.length) {
      if (/\s/.test(text[i])) {
        i++;
        continue;
      }

      const rest = text.slice(i);
      const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);

      if (number) {
        tokens.push({ type: "number", value: Number(number[0]) });
        i += number[0].length;
        continue;
      }

      const name = rest.match(/^[a-z]+/i);

      if (name) {
        tokens.push({ type: "name", value: name[0].toLowerCase() });
        i += name[0].length;
        continue;
      }

      if ("+-*/%^!()".includes(text[i])) {
        tokens.push({ type: text[i], value: text[i] });
        i++;
        continue;
      }

      throw new Error("Invalid input");
    }

    return tokens;
  }

  function evaluate(text) {
    const tokens = tokenize(text);
    let position = 0;

    const peek = () => tokens[position];
    const take = () => tokens[position++];

    function factorial(n) {
      if (n < 0 || !Number.isInteger(n) || n > 170) {
        throw new Error("Invalid factorial");
      }

      let value = 1;
      for (let i = 2; i <= n; i++) value *= i;
      return value;
    }

    function primary() {
      const token = peek();

      if (!token) throw new Error("Incomplete expression");

      if (token.type === "+" || token.type === "-") {
        take();
        const value = primary();
        return token.type === "-" ? -value : value;
      }

      if (token.type === "number") {
        take();
        return token.value;
      }

      if (token.type === "(") {
        take();
        const value = addition();

        if (!peek() || take().type !== ")") {
          throw new Error("Missing )");
        }

        return value;
      }

      if (token.type === "name") {
        const name = take().value;

        if (name === "pi") return Math.PI;
        if (name === "e") return Math.E;
        if (name === "ans") return answer;

        const x = primary();
        const radians = angleMode === "DEG" ? x * Math.PI / 180 : x;
        let value;

        switch (name) {
          case "sin":
            value = Math.sin(radians);
            break;
          case "cos":
            value = Math.cos(radians);
            break;
          case "tan":
            value = Math.tan(radians);
            break;
          case "asin":
            value = Math.asin(x) * (angleMode === "DEG" ? 180 / Math.PI : 1);
            break;
          case "acos":
            value = Math.acos(x) * (angleMode === "DEG" ? 180 / Math.PI : 1);
            break;
          case "atan":
            value = Math.atan(x) * (angleMode === "DEG" ? 180 / Math.PI : 1);
            break;
          case "sqrt":
            value = Math.sqrt(x);
            break;
          case "cbrt":
            value = Math.cbrt(x);
            break;
          case "ln":
            value = Math.log(x);
            break;
          case "log":
            value = Math.log10(x);
            break;
          case "abs":
            value = Math.abs(x);
            break;
          case "fact":
            value = factorial(x);
            break;
          default:
            throw new Error("Unknown function");
        }

        if (!Number.isFinite(value)) throw new Error("Math error");
        return value;
      }

      throw new Error("Syntax error");
    }

    function postfix() {
      let value = primary();

      while (peek() && peek().type === "!") {
        take();
        value = factorial(value);
      }

      return value;
    }

    function power() {
      let value = postfix();

      if (peek() && peek().type === "^") {
        take();
        value = Math.pow(value, unary());
      }

      return value;
    }

    function unary() {
      if (peek() && (peek().type === "+" || peek().type === "-")) {
        const operator = take().type;
        const value = unary();
        return operator === "-" ? -value : value;
      }

      return power();
    }

    function multiplication() {
      let value = unary();

      while (peek() && ["*", "/", "%"].includes(peek().type)) {
        const operator = take().type;
        const right = unary();

        if ((operator === "/" || operator === "%") && right === 0) {
          throw new Error("Cannot divide by zero");
        }

        if (operator === "*") value *= right;
        if (operator === "/") value /= right;
        if (operator === "%") value %= right;
      }

      return value;
    }

    function addition() {
      let value = multiplication();

      while (peek() && ["+", "-"].includes(peek().type)) {
        const operator = take().type;
        const right = multiplication();
        value = operator === "+" ? value + right : value - right;
      }

      return value;
    }

    const value = addition();

    if (position !== tokens.length) throw new Error("Syntax error");
    if (!Number.isFinite(value)) throw new Error("Math error");

    return value;
  }

  function render() {
  expressionEl.textContent = pretty(expression);
  resultEl.classList.remove("error");

  if (!expression) {
    resultEl.textContent = "0";
    return;
  }

  try {
    resultEl.textContent = format(evaluate(expression));
  } catch {
    // Keep the last displayed value while the expression is incomplete.
    // For example, after typing "5 +", the display still shows "5 +".
  }
}

  function insert(text) {
    if (
      justCalculated &&
      !["+", "-", "*", "/", "%", "^", "!"].includes(text)
    ) {
      expression = "";
    }

    justCalculated = false;

    const endsValue =
      /[\d.)!]$/.test(expression) || /\b(pi|e|ans)$/.test(expression);

    if (
      (text === "(" || ["pi", "e", "ans"].includes(text)) &&
      endsValue
    ) {
      expression += "*";
    }

    expression += text;
    render();
  }

  function addDigit(digit) {
    if (justCalculated) expression = "";
    justCalculated = false;

    if (expression === "0") expression = digit;
    else expression += digit;

    render();
  }

  function addDecimal() {
    if (justCalculated) expression = "";
    justCalculated = false;

    const lastPart = expression.split(/[+\-*/%^()]/).pop();

    if (!lastPart.includes(".")) {
      expression += lastPart ? "." : "0.";
    }

    render();
  }

  function addFunction(name) {
    if (justCalculated) justCalculated = false;

    if (expression) expression = `${name}(${expression})`;
    else expression = `${name}(`;

    render();
  }

  function showHistory() {
    const list = document.querySelector("#historyList");
    list.replaceChildren();

    history.slice(0, 6).forEach(item => {
      const row = document.createElement("div");
      row.className = "history-item";

      const calculation = document.createElement("span");
      calculation.textContent = item.expression;

      const value = document.createElement("span");
      value.className = "history-answer";
      value.textContent = item.answer;

      row.append(calculation, value);
      list.append(row);
    });
  }

  function calculate() {
    if (!expression) return;

    try {
      const value = evaluate(expression);
      const displayed = format(value);

      history.unshift({
        expression: pretty(expression),
        answer: displayed
      });
      history = history.slice(0, 20);

      try {
        localStorage.setItem(
          "scientificCalculatorHistory",
          JSON.stringify(history)
        );
      } catch {
        // The calculator still works if browser storage is unavailable.
      }

      answer = value;
      expressionEl.textContent = pretty(expression) + " =";
      resultEl.classList.remove("error");
      resultEl.textContent = displayed;
      expression = String(value);
      justCalculated = true;
      showHistory();
    } catch (error) {
      resultEl.classList.add("error");
      resultEl.textContent =
        error.message === "Cannot divide by zero"
          ? "Cannot divide by zero"
          : error.message === "Invalid factorial"
            ? "Invalid factorial"
            : "Invalid expression";
    }
  }

  document.querySelector("#keys").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    const { action, value } = button.dataset;

    if (action === "digit") addDigit(value);
    if (action === "decimal") addDecimal();

    if (action === "operator") {
      if (value === "ans") {
        insert("ans");
      } else if (!expression && value === "-") {
        insert("-");
      } else if (expression) {
        justCalculated = false;

        if (/[+\-*/%^]$/.test(expression)) {
          expression = expression.slice(0, -1) + value;
        } else {
          expression += value;
        }

        render();
      }
    }

    if (action === "constant") insert(value);
    if (action === "func") addFunction(value);
    if (action === "equals") calculate();

    if (action === "clear") {
      expression = "";
      justCalculated = false;
      render();
    }

    if (action === "delete") {
      if (justCalculated) expression = "";
      else expression = expression.slice(0, -1);

      justCalculated = false;
      render();
    }

    if (action === "paren") {
      const opens = (expression.match(/\(/g) || []).length;
      const closes = (expression.match(/\)/g) || []).length;
      const endsValue =
        /[\d.)!]$/.test(expression) || /\b(pi|e|ans)$/.test(expression);

      insert(opens > closes && endsValue ? ")" : "(");
    }

    if (action === "square" && expression) {
      expression = `(${expression})^2`;
      justCalculated = false;
      render();
    }

    if (action === "power" && expression) {
      expression += "^";
      justCalculated = false;
      render();
    }

    if (action === "reciprocal" && expression) {
      expression = `1/(${expression})`;
      justCalculated = false;
      render();
    }

    if (action === "sign") {
      expression = expression ? `-(${expression})` : "-";
      justCalculated = false;
      render();
    }
  });

  document.querySelectorAll("[data-angle]").forEach(button => {
    button.addEventListener("click", () => {
      angleMode = button.dataset.angle;
      modeEl.textContent = angleMode;

      document.querySelectorAll("[data-angle]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      render();
    });
  });

  document.querySelector("#clearHistory").addEventListener("click", () => {
    history = [];
    localStorage.removeItem("scientificCalculatorHistory");
    showHistory();
  });

  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (/^\d$/.test(event.key)) {
      addDigit(event.key);
    } else if (event.key === ".") {
      addDecimal();
    } else if (["+", "-", "*", "/", "%", "^"].includes(event.key)) {
      if (expression) {
        expression += event.key;
        justCalculated = false;
        render();
      }
    } else if (event.key === "Enter" || event.key === "=") {
      calculate();
      event.preventDefault();
    } else if (event.key === "Backspace") {
      expression = expression.slice(0, -1);
      justCalculated = false;
      render();
      event.preventDefault();
    } else if (event.key === "Escape") {
      expression = "";
      justCalculated = false;
      render();
    } else if (event.key === "!") {
      insert("!");
    } else if (event.key === "(" || event.key === ")") {
      insert(event.key);
    }
  });

  showHistory();
  render();
})();