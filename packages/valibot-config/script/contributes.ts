export async function writePackageJsonConfig(packageJsonData: any) {
  const data = JSON.parse(packageJsonData);
  data['contributes']['configuration'] = await getConfig();
  return data;
}

async function getConfig() {
  const { TestConfigDefine } = await import('../test/bootstrap/test.config');
  const { valibotToVscodeConfig } = await import('../valibot-to-vscode-config');
  return valibotToVscodeConfig(TestConfigDefine, {
    title: '测试',
    prefix: 'test',
  });
}
