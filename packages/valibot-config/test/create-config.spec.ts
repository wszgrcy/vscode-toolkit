import * as vscode from 'vscode';
import { expect } from 'chai';
import { TestConfigDefine } from './bootstrap/test.config';
import { ConfigProxy, createConfig, ResolveConfig } from '../create-config';
import * as v from 'valibot';
const TEST_SUFFIX = Date.now().toString(36);

describe('createConfig', () => {
  let vsConfig: vscode.WorkspaceConfiguration;
  let proxy: ConfigProxy<typeof TestConfigDefine>;
  let freshConfig: ResolveConfig<v.InferOutput<typeof TestConfigDefine>>;

  beforeEach(async () => {
    vsConfig = vscode.workspace.getConfiguration('test');
    proxy = createConfig(TestConfigDefine, 'test');
    freshConfig = proxy.root();
  });

  afterEach(async () => {
    proxy.dispose();
    await vsConfig.update('str1', null, vscode.ConfigurationTarget.Workspace);
    await vsConfig.update('num1', null, vscode.ConfigurationTarget.Workspace);
    await vsConfig.update('bool1', null, vscode.ConfigurationTarget.Workspace);
    await vsConfig.update('arr1', null, vscode.ConfigurationTarget.Workspace);
    await vsConfig.update('obj1', null, vscode.ConfigurationTarget.Workspace);
    await vsConfig.update(
      'deepObj',
      null,
      vscode.ConfigurationTarget.Workspace,
    );
    await vsConfig.update('uni1', null, vscode.ConfigurationTarget.Workspace);
  });

  it('should return a signal with set method for updating values', async () => {
    const proxy = createConfig(TestConfigDefine, 'test');
    const freshConfigLocal = proxy.root();
    await vsConfig.update(
      'str1',
      `hello_${TEST_SUFFIX}`,
      vscode.ConfigurationTarget.Workspace,
    );

    expect(vsConfig.inspect('str1')!.workspaceValue).to.equal(
      `hello_${TEST_SUFFIX}`,
    );
    const str1Signal = freshConfigLocal.str1;

    await str1Signal.set(`world_${TEST_SUFFIX}`);
    const newValue = vsConfig.inspect('str1')!.workspaceValue;
    expect(newValue).to.equal(`world_${TEST_SUFFIX}`);
    proxy.dispose();
  });

  it('should update string value using .update()', async () => {
    await freshConfig.str1.set(`prefix_${TEST_SUFFIX}`);
    await freshConfig.str1.update((v: string) => v + '_suffix');
    const newValue = vsConfig.inspect('str1')!.workspaceValue;
    expect(newValue).to.equal(`prefix_${TEST_SUFFIX}_suffix`);
  });

  it('should set number value using .set()', async () => {
    await freshConfig.num1.set(42);
    const newValue = vsConfig.inspect('num1')!.workspaceValue;
    expect(newValue).to.equal(42);
  });

  it('should update number value using .update()', async () => {
    await freshConfig.num1.set(10);
    await freshConfig.num1.update((v: number) => v * 3);
    const newValue = vsConfig.inspect('num1')!.workspaceValue;
    expect(newValue).to.equal(30);
  });

  it('should set boolean value using .set()', async () => {
    await freshConfig.bool1.set(true);
    const newValue = vsConfig.inspect('bool1')!.workspaceValue;
    expect(newValue).to.be.true;
  });

  it('should update boolean value using .update()', async () => {
    await freshConfig.bool1.set(false);
    await freshConfig.bool1.update((v: boolean) => !v);
    const newValue = vsConfig.inspect('bool1')!.workspaceValue;
    expect(newValue).to.be.true;
  });

  it('should set array value using .set()', async () => {
    await freshConfig.arr1.set(['a', 'b', 'c']);
    const newValue = vsConfig.inspect('arr1')!.workspaceValue;
    expect(newValue).to.deep.equal(['a', 'b', 'c']);
  });

  it('should update array value using .update()', async () => {
    await freshConfig.arr1.set(['x']);
    await freshConfig.arr1.update((v: string[]) => [...v, 'y', 'z']);
    const newValue = vsConfig.inspect('arr1')!.workspaceValue;
    expect(newValue).to.deep.equal(['x', 'y', 'z']);
  });

  it('should set nested object using .set()', async () => {
    await freshConfig.obj1.set({ num1: 100 });
    const newValue = vsConfig.inspect('obj1')!.workspaceValue;
    expect(newValue).to.deep.equal({ num1: 100 });
  });

  it('should update nested object using .update()', async () => {
    await freshConfig.obj1.set({ num1: 5 });
    await freshConfig.obj1.update((v: { num1: number }) => ({
      ...v,
      num1: v.num1 + 5,
    }));
    const newValue = vsConfig.inspect('obj1')!.workspaceValue;
    expect(newValue).to.deep.equal({ num1: 10 });
  });

  it('should set deep nested object using .set()', async () => {
    await freshConfig.deepObj.set({ level1: { level2: 'deep_value' } });
    const newValue = vsConfig.inspect('deepObj')!.workspaceValue;
    expect(newValue).to.deep.equal({ level1: { level2: 'deep_value' } });
  });

  it('should read deep nested value from signal', async () => {
    await freshConfig.deepObj.set({ level1: { level2: 'test_deep' } });
    const currentValue = freshConfig.deepObj();
    expect(currentValue).to.deep.equal({ level1: { level2: 'test_deep' } });
  });

  it('should set union type variant 1 using .set()', async () => {
    await freshConfig.uni1.set({ k1: 'value1' });
    const newValue = vsConfig.inspect('uni1')!.workspaceValue;
    expect(newValue).to.deep.equal({ k1: 'value1' });
  });

  it('should set union type variant 2 using .set()', async () => {
    await freshConfig.uni1.set({ k2: 'value2' });
    const newValue = vsConfig.inspect('uni1')!.workspaceValue;
    expect(newValue).to.deep.equal({ k2: 'value2' });
  });

  it('should switch between union variants using .set()', async () => {
    await freshConfig.uni1.set({ k1: 'first' });
    expect(vsConfig.inspect('uni1')!.workspaceValue).to.deep.equal({
      k1: 'first',
    });

    await freshConfig.uni1.set({ k2: 'second' });
    expect(vsConfig.inspect('uni1')!.workspaceValue).to.deep.equal({
      k2: 'second',
    });
  });

  it('should access union member property and use .set()', async () => {
    await freshConfig.uni1.k1.set('prop_value');
    const newValue = vsConfig.inspect('uni1')!.workspaceValue;
    expect(newValue).to.deep.equal({ k1: 'prop_value' });
    expect(freshConfig.uni1.k1()).equal('prop_value');
    expect(freshConfig.uni1()).deep.equal({ k1: 'prop_value' });
  });

  it('should not trigger update when value is the same (signal)', async () => {
    await freshConfig.obj1.set({ num1: 10 });
    const currentValue = freshConfig.obj1();
    expect(currentValue).to.deep.equal({ num1: 10 });

    // Setting same value should not cause issues
    await freshConfig.obj1.set({ num1: 10 });
    const unchanged = freshConfig.obj1();
    expect(unchanged).to.deep.equal({ num1: 10 });
  });

  it('should handle multiple .set() calls sequentially', async () => {
    await freshConfig.str1.set(`version1_${TEST_SUFFIX}`);
    expect(vsConfig.inspect('str1')!.workspaceValue).to.equal(
      `version1_${TEST_SUFFIX}`,
    );

    await freshConfig.str1.set(`version2_${TEST_SUFFIX}`);
    expect(vsConfig.inspect('str1')!.workspaceValue).to.equal(
      `version2_${TEST_SUFFIX}`,
    );

    await freshConfig.str1.set(`version3_${TEST_SUFFIX}`);
    expect(vsConfig.inspect('str1')!.workspaceValue).to.equal(
      `version3_${TEST_SUFFIX}`,
    );
  });

  it('should handle multiple .update() calls sequentially', async () => {
    await freshConfig.str1.set(`base`);
    await freshConfig.str1.update((v: string) => v + `_1`);
    await freshConfig.str1.update((v: string) => v + `_2`);
    await freshConfig.str1.update((v: string) => v + `_3`);

    const newValue = vsConfig.inspect('str1')!.workspaceValue;
    expect(newValue).to.equal(`base_1_2_3`);
  });

  it('should interleave .set() and .update() calls', async () => {
    await freshConfig.str1.set(`start`);
    await freshConfig.str1.update((v: string) => v + `_a`);
    await freshConfig.str1.set(`reset`);
    await freshConfig.str1.update((v: string) => v + `_b`);

    const newValue = vsConfig.inspect('str1')!.workspaceValue;
    expect(newValue).to.equal(`reset_b`);
  });

  it('should reflect .set() value in signal immediately', async () => {
    await freshConfig.num1.set(100);
    expect(freshConfig.num1()).to.equal(100);

    await freshConfig.num1.set(200);
    expect(freshConfig.num1()).to.equal(200);
  });

  it('should reflect .update() value in signal immediately', async () => {
    await freshConfig.num1.set(5);
    await freshConfig.num1.update((v: number) => v * 10);
    expect(freshConfig.num1()).to.equal(50);
  });
});
