// Unit test for parseTranslations with nested-key recovery
import { parseTranslations } from '../src/main/llm/json-repair'

let passed = 0, failed = 0
function test(name: string, fn: () => boolean) {
  try {
    const ok = fn()
    if (ok) { passed++; console.log('PASS -', name) }
    else    { failed++; console.log('FAIL -', name) }
  } catch (e) {
    failed++
    console.log('ERROR -', name, ':', e instanceof Error ? e.message : String(e))
  }
}

const keys = ['value.info0.0', 'value.info1.0']
const keys2 = ['block.stone', 'item.sword']
const keys3 = ['value.info0.0', 'other.key']

// Case 1: LLM nests value.info0.0 as {"value":{"info0":{"0":"..."}}}
test('nested response recovered via tree walk', () => {
  const raw = parseTranslations(JSON.stringify({
    translations: {
      "value.info0.0": { info0: { "0": "[译] 嵌套翻译" } },
      "value.info1.0": { info1: { "0": "[译] 另一个" } }
    }
  }), keys)
  console.log('  raw:', JSON.stringify(raw))
  return raw["value.info0.0"] === "[译] 嵌套翻译"
      && raw["value.info1.0"] === "[译] 另一个"
})

// Case 2: Flat response works normally
test('flat response returns keys as-is', () => {
  const raw = parseTranslations(JSON.stringify({
    translations: {
      "value.info0.0": "[译] 正确平铺",
      "other.key": "ok"
    }
  }), keys3)
  return raw["value.info0.0"] === "[译] 正确平铺"
      && raw["other.key"] === "ok"
})

// Case 3: requestedKeys filter strips unknown keys
test('requestedKeys filter keeps only known keys', () => {
  const raw = parseTranslations(JSON.stringify({
    translations: {
      "value.info0.0": "[译] 正确平铺",
      "value": "spurious-prefix",
      "value.info1": "spurious-mid",
      "other.key": "ok"
    }
  }), keys3)
  console.log('  filtered:', JSON.stringify(raw))
  return Object.keys(raw).length === 2
      && raw["value.info0.0"] === "[译] 正确平铺"
      && raw["other.key"] === "ok"
})

// Case 4: Array values at top level -> flattened to key.0, key.1
test('array values flatten to indexed keys', () => {
  const raw = parseTranslations(JSON.stringify({
    translations: {
      "block.stone": ["石头", "圆石"],
      "item.sword": "铁剑"
    }
  }), keys2)
  console.log('  raw4:', JSON.stringify(raw))
  return raw["block.stone"] === undefined  // array, not string -> not returned
      && raw["item.sword"] === "铁剑"
})

// Case 5: No requestedKeys -> backward compat, returns all leaf strings
test('no requestedKeys returns all flat string values', () => {
  const raw = parseTranslations(JSON.stringify({
    translations: {
      "a": "hello",
      "b": ["x", "y"],
      "c": { nested: "should-skip" }
    }}))
  console.log('  raw5:', JSON.stringify(raw))
  return raw["a"] === "hello"
      && raw["b.0"] === "x"
      && raw["b.1"] === "y"
      && !("c" in raw)  // nested object skipped
})

// Case 6: Deep nesting with array of objects (without requestedKeys)
test('deep nesting flattens correctly without requestedKeys', () => {
  const raw = parseTranslations(JSON.stringify({
    translations: {
      "entries": [
        { "0": "条目A", "1": "条目B" },
        { "0": "条目C" }
      ]
    }}))
  console.log('  raw6:', JSON.stringify(raw))
  return raw["entries.0.0"] === "条目A"
      && raw["entries.0.1"] === "条目B"
      && raw["entries.1.0"] === "条目C"
})

// Case 7: Mixed — some keys exact, some nested (LLM splits on dots), some missing
test('mixed: exact + nested + missing', () => {
  const raw = parseTranslations(JSON.stringify({
    translations: {
      "exact.key": "直接翻译",
      "nested.key": { nested: { "key": "嵌套翻译" } },  // LLM nests as {"nested":{"key":"..."}}
      // "missing.key" not present at all
    }
  }), ['exact.key', 'nested.key', 'missing.key'])
  console.log('  raw7:', JSON.stringify(raw))
  return raw["exact.key"] === "直接翻译"
      && raw["nested.key"] === "嵌套翻译"
      && !("missing.key" in raw)
})

// Case 8: Original bug scenario — value.info0.0 nested
test('original bug: value.info0.0 nested as {"value":{"info0":{"0":"..."}}}', () => {
  const raw = parseTranslations(JSON.stringify({
    translations: {
      "value.info0.0": { value: { info0: { "0": "OK" } } }
    }
  }), ['value.info0.0'])
  console.log('  raw8:', JSON.stringify(raw))
  return raw["value.info0.0"] === "OK"
})

console.log(`\n${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
