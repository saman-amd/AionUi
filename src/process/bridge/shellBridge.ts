/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { shell } from 'electron';
import { ipcBridge } from '@/common';

export function initShellBridge(): void {
  ipcBridge.shell.openFile.provider(async (path) => {
    try {
      const errorMessage = await shell.openPath(path);
      if (errorMessage) {
        console.warn(`[shellBridge] Failed to open path: ${errorMessage}`);
      }
    } catch (error) {
      console.warn(`[shellBridge] Failed to open path:`, (error as Error).message);
    }
  });

  ipcBridge.shell.showItemInFolder.provider((path) => {
    shell.showItemInFolder(path);
    return Promise.resolve();
  });

  ipcBridge.shell.openExternal.provider((url) => {
    // [Local-Only] Only allow file:// URLs — block all http/https external links
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'file:') {
        return shell.openExternal(url);
      }
    } catch {
      // Invalid URL — block
    }
    console.warn(`[Local-Only] Blocked shell.openExternal: ${url}`);
    return Promise.resolve();
  });
}
