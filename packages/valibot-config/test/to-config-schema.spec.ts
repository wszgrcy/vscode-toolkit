import { expect } from 'chai';
import * as v from 'valibot';
import { valibotToVscodeConfig, writePackageJsonConfig } from '..';
import { asVirtualGroup } from '@piying/valibot-visit';
import { JsonSchema } from '@valibot/to-json-schema';
import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

describe('valibot-config', () => {
  const defaultOptions = { title: 'test', prefix: 'test' };

  it('should handle v.object with required fields', () => {
    const schema = v.object({
      name: v.string(),
      age: v.number(),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result).to.have.property('title', 'test');
    expect(result).to.have.property('properties');
    expect(result.properties).to.have.property('test.name');
    expect(result.properties).to.have.property('test.age');
    // Required fields should be included
    if (result.required) {
      expect(result.required).to.include('test.name');
      expect(result.required).to.include('test.age');
    }
  });

  it('should handle v.optional fields', () => {
    const schema = v.object({
      name: v.optional(v.string()),
      age: v.number(),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    if (result.required) {
      expect(result.required).to.not.include('test.name');
      expect(result.required).to.include('test.age');
    }
  });

  it('should handle v.nullable fields', () => {
    const schema = v.object({
      name: v.nullable(v.string()),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.name');
  });

  it('should handle v.nullish fields', () => {
    const schema = v.object({
      name: v.nullish(v.string()),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should handle v.array', () => {
    const schema = v.object({
      tags: v.array(v.string()),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.tags');
  });

  it('should handle v.tuple', () => {
    const schema = v.object({
      coords: v.tuple([v.number(), v.number()]),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.coords');
  });

  it('should handle v.tupleWithRest', () => {
    const schema = v.object({
      values: v.tupleWithRest([v.number()], v.number()),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should handle v.looseObject', () => {
    const schema = v.looseObject({
      name: v.string(),
      age: v.number(),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.name');
  });

  it('should handle v.strictObject', () => {
    const schema = v.strictObject({
      name: v.string(),
      age: v.number(),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should handle v.objectWithRest', () => {
    const schema = v.objectWithRest(
      {
        name: v.string(),
      },
      v.string(),
    );

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should handle nested objects', () => {
    const schema = v.object({
      user: v.object({
        name: v.string(),
        address: v.object({
          street: v.string(),
          city: v.string(),
        }),
      }),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.user');
  });

  it('should handle v.record', () => {
    const schema = v.object({
      metadata: v.record(v.string(), v.string()),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.metadata');
  });

  it('should handle v.union', () => {
    const schema = v.object({
      value: v.union([v.string(), v.number()]),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should handle v.variant', () => {
    const schema = v.object({
      event: v.variant('type', [
        v.object({ type: v.literal('click'), x: v.number(), y: v.number() }),
        v.object({ type: v.literal('hover'), duration: v.number() }),
      ]),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should handle v.intersect', () => {
    const schema = v.object({
      config: v.intersect([
        v.object({ a: v.number() }),
        v.object({ b: v.string() }),
      ]),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should handle v.pipe with minLength', () => {
    const schema = v.object({
      code: v.pipe(v.string(), v.minLength(3)),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.code');
  });

  it('should handle v.nullable and v.optional together', () => {
    const schema = v.object({
      name: v.nullable(v.optional(v.string())),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should apply prefix to all property keys', () => {
    const schema = v.object({
      name: v.string(),
      age: v.number(),
      email: v.string(),
    });

    const result = valibotToVscodeConfig(schema, {
      title: 'user',
      prefix: 'user.config',
    });

    expect(result.properties).to.have.property('user.config.name');
    expect(result.properties).to.have.property('user.config.age');
    expect(result.properties).to.have.property('user.config.email');
    // Original keys without prefix should not exist
    expect(result.properties).to.not.have.property('name');
  });

  it('should set title and remove $schema', () => {
    const schema = v.object({
      name: v.string(),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result.title).to.equal('test');
    expect(result).to.not.have.property('$schema');
  });

  it('should handle custom id and order options', () => {
    const schema = v.object({
      name: v.string(),
    });

    const result = valibotToVscodeConfig(schema, {
      title: 'test',
      prefix: 'test',
      id: 'test.schema.json',
      order: 1,
    });

    expect((result as any).id).to.equal('test.schema.json');
    expect((result as any).order).to.equal(1);
  });

  it('should handle v.boolean, v.literal, v.enum', () => {
    const schema = v.object({
      active: v.boolean(),
      status: v.literal('active'),
      priority: v.picklist(['high', 'medium', 'low']),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.active');
    expect(result.properties).to.have.property('test.status');
    expect(result.properties).to.have.property('test.priority');
  });

  it('should handle v.string with constraints', () => {
    const schema = v.object({
      email: v.string(),
      code: v.pipe(v.string(), v.minLength(3)),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.email');
    expect(result.properties).to.have.property('test.code');
  });

  it('should handle v.number with constraints', () => {
    const schema = v.object({
      age: v.number(),
      score: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.age');
    expect(result.properties).to.have.property('test.score');
  });

  it('should handle loose_object with additional properties', () => {
    const schema = v.looseObject({
      name: v.string(),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result).to.have.property('properties');
    expect(result.properties).to.have.property('test.name');
  });

  it('should handle strict_object without additional properties', () => {
    const schema = v.strictObject({
      name: v.string(),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.name');
  });

  it('should handle tuple_with_rest with additional items', () => {
    const schema = v.object({
      values: v.tupleWithRest([v.string()], v.number()),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.values');
  });

  it('should handle object_with_rest with additional properties', () => {
    const schema = v.objectWithRest(
      {
        name: v.string(),
      },
      v.unknown(),
    );

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.name');
  });

  it('should handle empty object', () => {
    const schema = v.object({});

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.be.an('object');
    expect(Object.keys(result.properties!).length).to.equal(0);
  });

  it('should handle deeply nested optional fields', () => {
    const schema = v.object({
      user: v.object({
        name: v.optional(v.string()),
        profile: v.object({
          bio: v.nullable(v.string()),
          avatar: v.optional(v.string()),
        }),
      }),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.user');
  });

  it('should handle array of objects', () => {
    const schema = v.object({
      users: v.array(
        v.object({
          name: v.string(),
          age: v.number(),
        }),
      ),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.users');
  });

  it('should handle nullable array', () => {
    const schema = v.object({
      tags: v.nullable(v.array(v.string())),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
  });

  it('should handle optional array', () => {
    const schema = v.object({
      tags: v.optional(v.array(v.string())),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    if (result.required) {
      expect(result.required).to.not.include('test.tags');
    }
  });

  it('should handle record with object values', () => {
    const schema = v.object({
      users: v.record(
        v.string(),
        v.object({
          name: v.string(),
        }),
      ),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.users');
  });
  it('虚拟group', () => {
    const schema = v.object({
      o1: v.pipe(
        v.intersect([
          v.object({ a1: v.string() }),
          v.object({ a2: v.string() }),
        ]),
        asVirtualGroup(),
      ),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.o1');
    expect(
      Object.keys((result.properties!['test.o1'] as JsonSchema)!.properties!)
        .length,
    ).eq(2);
    expect((result.properties!['test.o1'] as JsonSchema)!.required).deep.eq([
      'a1',
      'a2',
    ]);
  });
  it('多级group', () => {
    const schema = v.object({
      o1: v.pipe(
        v.intersect([
          v.pipe(
            v.intersect([
              v.object({ a1: v.string() }),
              v.object({ a2: v.string() }),
            ]),
            asVirtualGroup(),
          ),
        ]),
        asVirtualGroup(),
      ),
    });

    const result = valibotToVscodeConfig(schema, defaultOptions);

    expect(result).to.be.an('object');
    expect(result.properties).to.have.property('test.o1');
    expect(
      Object.keys((result.properties!['test.o1'] as JsonSchema)!.properties!)
        .length,
    ).eq(2);
    expect((result.properties!['test.o1'] as JsonSchema)!.required).deep.eq([
      'a1',
      'a2',
    ]);
  });
});
describe('空定义过滤', () => {
  it('直接', () => {
    const schema = v.object({
      a1: v.optional(v.void()),
    });
    const result = valibotToVscodeConfig(schema, { title: '', prefix: '' });
    expect(Object.keys(result.properties ?? {}).length).eq(0);
  });
  it('tuple', () => {
    const schema = v.object({
      a1: v.tuple([v.optional(v.void())]),
    });
    const result = valibotToVscodeConfig(schema, { title: '', prefix: '' });
    expect((result.properties!['.a1'] as any)!.items.length).eq(0);
  });
});
describe('元数据', () => {
  it('isOptional', () => {
    const schema = v.object({
      o1: v.object({
        a1: v.pipe(v.string(), v.metadata({ isOptional: false })),
      }),
    });
    const result = valibotToVscodeConfig(schema, { title: '', prefix: '' });
    expect((result.properties!['.o1'] as any).required.length).eq(1);
  });
  it('isOptional2', () => {
    const schema = v.object({
      o1: v.object({
        a1: v.pipe(v.string(), v.metadata({ isOptional: true })),
      }),
    });
    const result = valibotToVscodeConfig(schema, { title: '', prefix: '' });
    expect((result.properties!['.o1'] as any).required.length).eq(0);
  });
  it('enumOptions', () => {
    const schema = v.object({
      a1: v.pipe(
        v.string(),
        v.metadata({
          enumOptions: [
            {
              label: 'label1',
              description: 'description1',
            },
          ],
        }),
      ),
    });
    const result = valibotToVscodeConfig(schema, { title: '', prefix: '' });
    expect((result.properties!['.a1'] as any).enumItemLabels).deep.eq([
      'label1',
    ]);
    expect((result.properties!['.a1'] as any).markdownEnumDescriptions).deep.eq(
      ['description1'],
    );
  });
  it('description', () => {
    const schema = v.object({
      a1: v.pipe(v.string(), v.description('description1')),
    });
    const result = valibotToVscodeConfig(schema, { title: '', prefix: '' });
    expect((result.properties!['.a1'] as any).markdownDescription).eq(
      'description1',
    );
    expect((result.properties!['.a1'] as any).description).not.ok;
  });
});

describe('writePackageJsonConfig', () => {
  const testSchema = v.object({
    name: v.string(),
    age: v.number(),
  });

  const tempDir = path.join(tmpdir(), 'write-package-json-config-test');

  before(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return a function that accepts a file path', () => {
    const writeFn = writePackageJsonConfig(testSchema, {
      title: 'test',
      prefix: 'test',
    });

    expect(writeFn).to.be.a('function');
  });

  it('should return a function that accepts a package.json object', () => {
    const writeFn = writePackageJsonConfig(testSchema, {
      title: 'test',
      prefix: 'test',
    });

    const packageJson = { contributes: {} as any };
    writeFn(packageJson);

    expect(packageJson.contributes).to.have.property('configuration');
    expect(packageJson.contributes.configuration).to.have.property('title');
    expect(packageJson.contributes.configuration.title).to.equal('test');
  });

  it('should write configuration to package.json object', () => {
    const writeFn = writePackageJsonConfig(testSchema, {
      title: 'user-config',
      prefix: 'user',
    });

    const packageJson = { contributes: {} as any };
    writeFn(packageJson);

    expect(packageJson.contributes).to.have.property('configuration');
    const config = packageJson.contributes.configuration;
    expect(config.properties).to.have.property('user.name');
    expect(config.properties).to.have.property('user.age');
  });

  it('should write configuration to package.json file', () => {
    const writeFn = writePackageJsonConfig(testSchema, {
      title: 'file-test',
      prefix: 'file',
    });

    const packageJsonPath = path.join(tempDir, 'package.json');
    const initialData = {
      name: 'test-extension',
      contributes: {},
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(initialData, null, 2));

    writeFn(packageJsonPath);

    const writtenData = JSON.parse(
      require('fs').readFileSync(packageJsonPath, 'utf-8'),
    );
    expect(writtenData.contributes).to.have.property('configuration');
    expect(writtenData.contributes.configuration.title).to.equal('file-test');
    expect(writtenData.contributes.configuration.properties).to.have.property(
      'file.name',
    );
    expect(writtenData.contributes.configuration.properties).to.have.property(
      'file.age',
    );
  });

  it('should preserve existing package.json fields when writing to file', () => {
    const writeFn = writePackageJsonConfig(testSchema, {
      title: 'preserve-test',
      prefix: 'pres',
    });

    const packageJsonPath = path.join(tempDir, 'package2.json');
    const initialData = {
      name: 'test-extension',
      version: '1.0.0',
      activationEvents: ['onStartupFinished'],
      contributes: {},
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(initialData, null, 2));

    writeFn(packageJsonPath);

    const writtenData = JSON.parse(
      require('fs').readFileSync(packageJsonPath, 'utf-8'),
    );
    expect(writtenData.name).to.equal('test-extension');
    expect(writtenData.version).to.equal('1.0.0');
    expect(writtenData.activationEvents).to.deep.equal(['onStartupFinished']);
  });

  it('should correctly set configuration with id and order', () => {
    const writeFn = writePackageJsonConfig(testSchema, {
      title: 'typed-config',
      prefix: 'typed',
      id: 'my.schema.json',
      order: 42,
    });

    const packageJson = { contributes: {} as any };
    writeFn(packageJson);

    const config = packageJson.contributes.configuration;
    expect((config as any).id).to.equal('my.schema.json');
    expect((config as any).order).to.equal(42);
  });
});
