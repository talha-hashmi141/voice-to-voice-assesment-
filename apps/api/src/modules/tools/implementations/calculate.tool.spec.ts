import { CalculateTool } from './calculate.tool';

describe('CalculateTool', () => {
  const tool = new CalculateTool();

  it('evaluates arithmetic exactly', async () => {
    await expect(tool.execute({ expression: '20 - 7 - 5' })).resolves.toMatchObject({ data: { result: '8' }, summary: '20 - 7 - 5 = 8' });
    await expect(tool.execute({ expression: '75 * 3 + 95 * 2' })).resolves.toMatchObject({ data: { result: '415' } });
    await expect(tool.execute({ expression: '(9 - 3) / 2' })).resolves.toMatchObject({ data: { result: '3' } });
  });

  it('rejects anything that is not plain arithmetic', async () => {
    await expect(tool.execute({ expression: 'import("fs")' })).rejects.toThrow(/Only numbers/u);
    await expect(tool.execute({ expression: 'a + 1' })).rejects.toThrow();
  });
});
