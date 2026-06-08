import { test, expect } from "bun:test";
import { computeDelta } from "./movement";
import { ValidationError } from "../../../shared/errors";

test("in : delta = +quantity (stock courant ignoré)", () => {
  expect(computeDelta("in", 10, 0)).toBe(10);
  expect(computeDelta("in", 5, 3)).toBe(5);
});

test("out : delta = −quantity", () => {
  expect(computeDelta("out", 3, 10)).toBe(-3);
  expect(computeDelta("out", 4, 0)).toBe(-4); // négatif autorisé (pas de blocage)
});

test("adjustment : delta = cible − stock courant", () => {
  expect(computeDelta("adjustment", 5, 7)).toBe(-2);
  expect(computeDelta("adjustment", 12, 5)).toBe(7);
  expect(computeDelta("adjustment", 0, 4)).toBe(-4); // cible 0 autorisée
  expect(computeDelta("adjustment", 6, 6)).toBe(0); // déjà à jour
});

test("in/out : quantité ≤ 0 ou non entière -> ValidationError", () => {
  expect(() => computeDelta("in", 0, 0)).toThrow(ValidationError);
  expect(() => computeDelta("out", 0, 5)).toThrow(ValidationError);
  expect(() => computeDelta("in", 1.5, 0)).toThrow(ValidationError);
});

test("adjustment : cible négative ou non entière -> ValidationError", () => {
  expect(() => computeDelta("adjustment", -1, 0)).toThrow(ValidationError);
  expect(() => computeDelta("adjustment", 2.5, 0)).toThrow(ValidationError);
});
