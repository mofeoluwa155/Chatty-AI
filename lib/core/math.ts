export type MathOutcome = {
  kind: "calculation" | "equation";
  answer: string;
  explanation: string;
};

type Token =
  | { kind: "number"; value: number }
  | { kind: "variable"; value: "x" }
  | { kind: "function"; value: "sqrt" }
  | { kind: "operator"; value: "+" | "-" | "*" | "/" | "^" }
  | { kind: "left" | "right" };

type Expression =
  | { kind: "number"; value: number }
  | { kind: "variable" }
  | { kind: "unary"; operator: "+" | "-"; operand: Expression }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/" | "^"; left: Expression; right: Expression }
  | { kind: "sqrt"; operand: Expression };

type Affine = { coefficient: number; constant: number };

class MathInputError extends Error {}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)|(sqrt)|([a-z]+)|([()+\-*/^]))/iy;
  let position = 0;

  while (position < source.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(source);
    if (!match) {
      if (source.slice(position).trim() === "") break;
      throw new MathInputError("I could not understand part of that expression. Use numbers, x, brackets and +, −, ×, ÷ or powers.");
    }
    position = pattern.lastIndex;

    if (match[1]) {
      const value = Number(match[1]);
      if (!Number.isFinite(value)) throw new MathInputError("That number is outside the supported range.");
      tokens.push({ kind: "number", value });
    } else if (match[2]) {
      tokens.push({ kind: "function", value: "sqrt" });
    } else if (match[3]) {
      if (match[3] !== "x") throw new MathInputError("At the moment, equations can use x as their variable.");
      tokens.push({ kind: "variable", value: "x" });
    } else if (match[4] === "(") {
      tokens.push({ kind: "left" });
    } else if (match[4] === ")") {
      tokens.push({ kind: "right" });
    } else if (match[4]) {
      tokens.push({ kind: "operator", value: match[4] as "+" | "-" | "*" | "/" | "^" });
    }
  }

  if (!tokens.length) throw new MathInputError("Enter a mathematical expression first.");
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Expression {
    const result = this.parseExpression(0);
    if (this.index !== this.tokens.length) {
      throw new MathInputError("There are extra symbols in that expression. Check the brackets and operators.");
    }
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private take(): Token {
    const token = this.tokens[this.index];
    if (!token) throw new MathInputError("The expression ends too early.");
    this.index += 1;
    return token;
  }

  private parseExpression(minimumPrecedence: number): Expression {
    let left = this.parsePrefix();

    while (true) {
      const next = this.peek();
      if (!next || next.kind === "right") break;

      let operator: "+" | "-" | "*" | "/" | "^";
      let precedence: number;
      let implicit = false;

      if (next.kind === "operator") {
        operator = next.value;
        precedence = operator === "+" || operator === "-" ? 1 : operator === "*" || operator === "/" ? 2 : 3;
      } else if (next.kind === "number" || next.kind === "variable" || next.kind === "left" || next.kind === "function") {
        operator = "*";
        precedence = 2;
        implicit = true;
      } else {
        break;
      }

      if (precedence < minimumPrecedence) break;
      if (!implicit) this.take();
      const right = this.parseExpression(precedence + (operator === "^" ? 0 : 1));
      left = { kind: "binary", operator, left, right };
    }

    return left;
  }

  private parsePrefix(): Expression {
    const token = this.take();

    if (token.kind === "operator" && (token.value === "+" || token.value === "-")) {
      return { kind: "unary", operator: token.value, operand: this.parseExpression(4) };
    }
    if (token.kind === "number") return { kind: "number", value: token.value };
    if (token.kind === "variable") return { kind: "variable" };

    if (token.kind === "function") {
      const opening = this.take();
      if (opening.kind !== "left") throw new MathInputError("Write square roots as sqrt(number), for example sqrt(81).");
      const operand = this.parseExpression(0);
      const closing = this.take();
      if (closing.kind !== "right") throw new MathInputError("A closing bracket is missing.");
      return { kind: "sqrt", operand };
    }

    if (token.kind === "left") {
      const value = this.parseExpression(0);
      const closing = this.take();
      if (closing.kind !== "right") throw new MathInputError("A closing bracket is missing.");
      return value;
    }

    throw new MathInputError("I expected a number, x or an opening bracket.");
  }
}

function evaluate(expression: Expression): number {
  if (expression.kind === "number") return expression.value;
  if (expression.kind === "variable") throw new MathInputError("This expression contains x. Use an equation such as 2x + 3 = 7.");
  if (expression.kind === "unary") {
    const value = evaluate(expression.operand);
    return expression.operator === "-" ? -value : value;
  }
  if (expression.kind === "sqrt") {
    const value = evaluate(expression.operand);
    if (value < 0) throw new MathInputError("This engine currently works with real-number square roots, so the value inside sqrt must not be negative.");
    return Math.sqrt(value);
  }

  const left = evaluate(expression.left);
  const right = evaluate(expression.right);
  let result: number;
  switch (expression.operator) {
    case "+": result = left + right; break;
    case "-": result = left - right; break;
    case "*": result = left * right; break;
    case "/":
      if (right === 0) throw new MathInputError("Division by zero is undefined.");
      result = left / right;
      break;
    case "^": result = left ** right; break;
  }
  if (!Number.isFinite(result)) throw new MathInputError("The result is outside the supported numeric range.");
  return result;
}

function toAffine(expression: Expression): Affine {
  if (expression.kind === "number") return { coefficient: 0, constant: expression.value };
  if (expression.kind === "variable") return { coefficient: 1, constant: 0 };

  if (expression.kind === "unary") {
    const value = toAffine(expression.operand);
    const sign = expression.operator === "-" ? -1 : 1;
    return { coefficient: sign * value.coefficient, constant: sign * value.constant };
  }

  if (expression.kind === "sqrt") {
    const value = toAffine(expression.operand);
    if (value.coefficient !== 0) throw new MathInputError("That is not a linear equation because x appears inside a square root.");
    if (value.constant < 0) throw new MathInputError("The square root of a negative number is not a real number.");
    return { coefficient: 0, constant: Math.sqrt(value.constant) };
  }

  const left = toAffine(expression.left);
  const right = toAffine(expression.right);

  switch (expression.operator) {
    case "+":
      return { coefficient: left.coefficient + right.coefficient, constant: left.constant + right.constant };
    case "-":
      return { coefficient: left.coefficient - right.coefficient, constant: left.constant - right.constant };
    case "*":
      if (left.coefficient !== 0 && right.coefficient !== 0) throw new MathInputError("This is not a linear equation because it multiplies x by x.");
      return {
        coefficient: left.coefficient * right.constant + right.coefficient * left.constant,
        constant: left.constant * right.constant,
      };
    case "/":
      if (right.coefficient !== 0) throw new MathInputError("A linear equation cannot divide by an expression containing x.");
      if (right.constant === 0) throw new MathInputError("Division by zero is undefined.");
      return { coefficient: left.coefficient / right.constant, constant: left.constant / right.constant };
    case "^":
      if (right.coefficient !== 0) throw new MathInputError("The power cannot contain x in this equation.");
      if (right.constant === 1) return left;
      if (left.coefficient !== 0) throw new MathInputError("This engine currently solves linear equations, not equations where x is raised to a power.");
      return { coefficient: 0, constant: left.constant ** right.constant };
  }
}

function normaliseMathText(input: string): string {
  let value = input.toLowerCase().replace(/[×·]/g, "*").replace(/[÷]/g, "/");
  value = value.replace(/(?<=\d),(?=\d{3}\b)/g, "");
  value = value.replace(/square root of\s*(\d+(?:\.\d+)?)/g, "sqrt($1)");
  value = value.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*/g, "$1/100*");
  value = value.replace(/(\d+(?:\.\d+)?)\s+percent of\s+/g, "$1/100*");

  const subtractFrom = value.match(/subtract\s+(\d+(?:\.\d+)?)\s+from\s+(\d+(?:\.\d+)?)/);
  if (subtractFrom) value = value.replace(subtractFrom[0], subtractFrom[2] + "-" + subtractFrom[1]);

  value = value
    .replace(/to the power of/g, "^")
    .replace(/multiplied by|times/g, "*")
    .replace(/divided by/g, "/")
    .replace(/\bplus\b|\badded to\b/g, "+")
    .replace(/\bminus\b/g, "-")
    .replace(/\bwhat is\b|\bwhat's\b|\bcalculate\b|\bcompute\b|\bevaluate\b|\bwork out\b|\bsolve\b|\bplease\b|\bthe value of\b/g, "")
    .replace(/\?/g, "")
    .replace(/\s+/g, "");

  return value;
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) return "0";
  return Number(value.toPrecision(12)).toString();
}

function solveEquation(source: string): MathOutcome {
  const parts = source.split("=");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new MathInputError("Write one equation with one equals sign, for example 2x + 3 = 7.");

  const left = toAffine(new Parser(tokenize(parts[0])).parse());
  const right = toAffine(new Parser(tokenize(parts[1])).parse());
  const coefficient = left.coefficient - right.coefficient;
  const constant = right.constant - left.constant;

  if (coefficient === 0) {
    if (constant === 0) return { kind: "equation", answer: "Every value of x satisfies this equation.", explanation: "Both sides simplify to the same expression, so there are infinitely many solutions." };
    return { kind: "equation", answer: "There is no solution.", explanation: "The x terms cancel, leaving a false statement. No value of x can make both sides equal." };
  }

  const solution = constant / coefficient;
  if (!Number.isFinite(solution)) throw new MathInputError("The solution is outside the supported numeric range.");

  const answer = "x = " + formatNumber(solution);
  const leftText = formatNumber(left.coefficient) + "x + " + formatNumber(left.constant);
  const rightText = formatNumber(right.coefficient) + "x + " + formatNumber(right.constant);
  const explanation = [
    "I collected the x terms on the left and the number terms on the right.",
    "Simplified form: " + formatNumber(coefficient) + "x = " + formatNumber(constant) + ".",
    "Divide both sides by " + formatNumber(coefficient) + ".",
    "Check: substituting x = " + formatNumber(solution) + " makes both sides equal.",
  ].join("\n");
  return { kind: "equation", answer, explanation: "Equation: " + source + "\n" + explanation };
}

export function trySolveMath(question: string): MathOutcome | null {
  const lowered = question.toLowerCase();
  const looksMathematical = /\d/.test(lowered) && /(=|[+*/^×÷]|\bplus\b|\bminus\b|\btimes\b|\bdivided by\b|\bmultiplied by\b|\bpercent\b|\bsquare root\b|\bsolve\b|\bcalculate\b|\bwork out\b)/.test(lowered);
  if (!looksMathematical) return null;

  try {
    const normalised = normaliseMathText(question);
    if (normalised.includes("=")) return solveEquation(normalised);

    const tree = new Parser(tokenize(normalised)).parse();
    const result = evaluate(tree);
    const answer = formatNumber(result);
    return {
      kind: "calculation",
      answer,
      explanation: "Expression: " + normalised + "\nUsing the order of operations, the result is " + answer + ".",
    };
  } catch (error) {
    return {
      kind: "calculation",
      answer: "I could not solve that expression yet.",
      explanation: error instanceof MathInputError ? error.message : "Check the expression and try again.",
    };
  }
}
