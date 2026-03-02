"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
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
function activate(context) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    statusBar.text = '$(pulse) Claude';
    statusBar.tooltip = '클릭하여 콘솔 열기';
    statusBar.command = 'claudeUsage.openMenu';
    statusBar.show();
    context.subscriptions.push(statusBar);
    context.subscriptions.push(vscode.commands.registerCommand('claudeUsage.openMenu', async () => {
        const picked = await vscode.window.showQuickPick(PAGES, {
            title: 'Claude Console — 어느 페이지를 열까요?',
            placeHolder: '항목 선택...',
        });
        if (picked) {
            vscode.env.openExternal(vscode.Uri.parse(picked.url));
        }
    }));
}
function deactivate() { }
