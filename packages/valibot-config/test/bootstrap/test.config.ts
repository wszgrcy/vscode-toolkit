import * as v from 'valibot';
export const TestConfigDefine = v.object({
  str1: v.string(),
  num1: v.number(),
  bool1: v.boolean(),
  arr1: v.array(v.string()),
  obj1: v.object({ num1: v.number() }),
  deepObj: v.object({ level1: v.object({ level2: v.string() }) }),
  uni1: v.optional(
    v.union([v.object({ k1: v.string() }), v.object({ k2: v.string() })]),
  ),
});
