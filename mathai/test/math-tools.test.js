'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runMathTool } = require('../lib/math-tools');

test('calculator evaluates a basic expression', function () {
    const result = runMathTool('calculate', { expression: '(18/24)*100' });
    assert.equal(result.result, 75);
});

test('symbolic solver finds roots of a quadratic', function () {
    const result = runMathTool('solve_equation', { equation: 'x^2-5*x+6=0', variable: 'x' });
    assert.equal(result.solutions.length, 2);
});

test('differentiation returns a symbolic derivative', function () {
    const result = runMathTool('differentiate', { expression: '3*x^2+4*x-7', variable: 'x' });
    assert.ok(result.derivative.length > 0);
});

test('statistics calculates the mean', function () {
    const result = runMathTool('statistics', { values: [4, 7, 7, 9, 13], operation: 'mean' });
    assert.equal(result.result, 8);
});

test('calculator rejects assignments and unsafe syntax', function () {
    assert.throws(function () {
        runMathTool('calculate', { expression: 'x=2' });
    });
});
