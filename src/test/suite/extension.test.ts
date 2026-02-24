import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Astro Analytics Extension Test Suite', () => {
  test('Extension is present', async () => {
    const ext = vscode.extensions.getExtension('kieksme.astro-analytics');
    assert.ok(ext, 'Extension kieksme.astro-analytics should be found');
  });

  test('Extension activates', async () => {
    const ext = vscode.extensions.getExtension('kieksme.astro-analytics');
    assert.ok(ext);
    if (!ext.isActive) {
      await ext.activate();
    }
    assert.strictEqual(ext.isActive, true, 'Extension should be active');
  });

  test('Refresh command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes('astro-analytics.refresh'),
      'Command astro-analytics.refresh should be registered'
    );
  });

  test('Configure command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes('astro-analytics.configure'),
      'Command astro-analytics.configure should be registered'
    );
  });

  test('Test API Connection command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes('astro-analytics.testConnection'),
      'Command astro-analytics.testConnection should be registered'
    );
  });

  test('Show Dashboard command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes('astro-analytics.showDashboard'),
      'Command astro-analytics.showDashboard should be registered'
    );
  });

  test('Show Dashboard command executes without error', async () => {
    await vscode.commands.executeCommand('astro-analytics.showDashboard');
  });
});
