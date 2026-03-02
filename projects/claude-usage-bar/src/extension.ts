import * as vscode from 'vscode';

const PAGES = [
  {
    label: '$(graph) Usage — API 토큰 사용량',
    url: 'https://platform.claude.com/analytics/usage',
  },
  {
    label: '$(credit-card) Cost — 비용',
    url: 'https://platform.claude.com/analytics/cost',
  },
  {
    label: '$(list-unordered) Logs — API 로그',
    url: 'https://platform.claude.com/analytics/logs',
  },
  {
    label: '$(terminal) Claude Code Usage',
    url: 'https://platform.claude.com/claude-code/usage',
  },
];

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    90
  );
  statusBar.text = '$(pulse) Claude';
  statusBar.tooltip = '클릭하여 콘솔 열기';
  statusBar.command = 'claudeUsage.openMenu';
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeUsage.openMenu', async () => {
      const picked = await vscode.window.showQuickPick(PAGES, {
        title: 'Claude Console — 어느 페이지를 열까요?',
        placeHolder: '항목 선택...',
      });
      if (picked) {
        vscode.env.openExternal(vscode.Uri.parse(picked.url));
      }
    })
  );
}

export function deactivate() {}
