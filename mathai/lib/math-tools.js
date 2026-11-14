'use strict';

const { create, all } = require('mathjs');
const nerdamer = require('nerdamer/all');
const math = create(all, {});

function assertExpression(value, label, allowEquals) {
    label = label || 'Expression';
    allowEquals = Boolean(allowEquals);
    if (typeof value !== 'string' || !value.trim() || value.length > 300) {
        throw new Error(label + ' must be a non-empty string under 300 characters.');
    }
    const pattern = allowEquals ? /^[0-9a-zA-Z_+\-*/^().=,\s]+$/ : /^[0-9a-zA-Z_+\-*/^().,\s%]+$/;
    if (!pattern.test(value) || /\b(import|evaluate|parse|config|createUnit|reviver|constructor|prototype|__proto__)\b/i.test(value)) {
        throw new Error(label + ' contains unsupported characters or operations.');
    }
    return value.trim();
}

function calculate(args) {
    const clean = assertExpression(args.expression);
    const result = math.evaluate(clean);
    if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('This calculator currently returns finite real-number results only.');
    }
    return { expression: clean, result: result, resultText: math.format(result, { precision: 14 }), verifiedBy: 'mathjs' };
}

function simplify(args) {
    const clean = assertExpression(args.expression, 'Expression', true);
    const result = nerdamer(clean).toString();
    return { expression: clean, simplified: result, verifiedBy: 'nerdamer' };
}

function solve(args) {
    const clean = assertExpression(args.equation, 'Equation', true);
    const variable = args.variable || 'x';
    if (!/^[a-zA-Z]$/.test(variable)) throw new Error('Use one letter as the variable, for example x.');
    const roots = nerdamer.solveEquations(clean, variable);
    return { equation: clean, variable: variable, solutions: roots, verifiedBy: 'nerdamer' };
}

function differentiate(args) {
    const clean = assertExpression(args.expression);
    const variable = args.variable || 'x';
    if (!/^[a-zA-Z]$/.test(variable)) throw new Error('Use one letter as the variable, for example x.');
    return { expression: clean, variable: variable, derivative: nerdamer.diff(clean, variable).toString(), verifiedBy: 'nerdamer' };
}

function integrate(args) {
    const clean = assertExpression(args.expression);
    const variable = args.variable || 'x';
    if (!/^[a-zA-Z]$/.test(variable)) throw new Error('Use one letter as the variable, for example x.');
    return { expression: clean, variable: variable, antiderivative: nerdamer.integrate(clean, variable).toString() + ' + C', verifiedBy: 'nerdamer' };
}

function statistics(args) {
    const values = args.values;
    if (!Array.isArray(values) || values.length < 1 || values.length > 500 ||
        values.some(function (value) { return typeof value !== 'number' || !Number.isFinite(value); })) {
        throw new Error('Provide an array containing 1–500 finite numbers.');
    }
    const actions = {
        mean: function () { return math.mean(values); },
        median: function () { return math.median(values); },
        mode: function () { return math.mode(values); },
        minimum: function () { return math.min(values); },
        maximum: function () { return math.max(values); },
        range: function () { return math.max(values) - math.min(values); },
        population_standard_deviation: function () { return math.std(values, 'uncorrected'); },
        sample_standard_deviation: function () { return values.length < 2 ? null : math.std(values, 'unbiased'); }
    };
    if (!Object.prototype.hasOwnProperty.call(actions, args.operation)) {
        throw new Error('Unsupported statistics operation.');
    }
    return { operation: args.operation, values: values, result: actions[args.operation](), verifiedBy: 'mathjs' };
}

function runMathTool(name, args) {
    switch (name) {
        case 'calculate': return calculate(args);
        case 'simplify': return simplify(args);
        case 'solve_equation': return solve(args);
        case 'differentiate': return differentiate(args);
        case 'integrate': return integrate(args);
        case 'statistics': return statistics(args);
        default: throw new Error('Unknown maths tool: ' + name);
    }
}

module.exports = { runMathTool: runMathTool };
