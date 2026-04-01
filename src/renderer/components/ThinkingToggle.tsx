/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Tooltip } from '@arco-design/web-react';
import { Brain } from '@icon-park/react';
import { iconColors } from '@/renderer/styles/colors';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type ThinkingToggleProps = {
  conversationId: string;
  modelName?: string;
};

const STORAGE_KEY = 'aionui_thinking_mode';

/**
 * Models that support thinking mode control.
 * Only these models will show the thinking toggle.
 * Pattern matches against lowercased model name.
 */
const THINKING_SUPPORTED_PATTERNS = [
  /qwen3(?!\.5).*thinking/i, // qwen3 with "thinking" tag (not qwen3.5)
  /deepseek-r1/i, // DeepSeek R1
  /qwq/i, // QwQ reasoning model
  /o1/i, // OpenAI o1
  /o3/i, // OpenAI o3
];

/**
 * Check if a model supports thinking mode control.
 */
const supportsThinkingControl = (modelName?: string): boolean => {
  if (!modelName) return false;
  const lower = modelName.toLowerCase();
  return THINKING_SUPPORTED_PATTERNS.some((pattern) => pattern.test(lower));
};

const getThinkingEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'false') return false;
    return true;
  } catch {
    return true;
  }
};

const setThinkingStored = (enabled: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Toggle button for enabling/disabling model thinking/reasoning mode.
 * Only shown for models that support thinking control (e.g. Qwen3 thinking, DeepSeek R1).
 * Hidden for models that don't support it (e.g. Qwen3.5, Llama, Gemma).
 */
const ThinkingToggle: React.FC<ThinkingToggleProps> = ({ conversationId: _conversationId, modelName }) => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(getThinkingEnabled);

  useEffect(() => {
    setEnabled(getThinkingEnabled());
  }, []);

  const handleToggle = useCallback(() => {
    const newValue = !enabled;
    setEnabled(newValue);
    setThinkingStored(newValue);
  }, [enabled]);

  // Don't render if model doesn't support thinking control
  if (!supportsThinkingControl(modelName)) {
    return null;
  }

  const label = enabled
    ? t('thinkingToggle.on', { defaultValue: 'Thinking' })
    : t('thinkingToggle.off', { defaultValue: 'Thinking Off' });

  const tooltip = enabled
    ? t('thinkingToggle.disableTooltip', {
        defaultValue: 'Thinking mode is ON. Click to disable for faster responses.',
      })
    : t('thinkingToggle.enableTooltip', {
        defaultValue: 'Thinking mode is OFF. Click to enable for deeper reasoning.',
      });

  return (
    <Tooltip content={tooltip} mini>
      <Button
        type='text'
        size='mini'
        onClick={handleToggle}
        className='flex items-center gap-2px px-6px'
        style={{
          opacity: enabled ? 1 : 0.5,
          color: enabled ? iconColors.primary : iconColors.secondary,
        }}
      >
        <Brain
          theme={enabled ? 'filled' : 'outline'}
          size='14'
          fill={enabled ? iconColors.primary : iconColors.secondary}
        />
        <span className='text-12px'>{label}</span>
      </Button>
    </Tooltip>
  );
};

export default ThinkingToggle;

/**
 * Check if thinking mode is currently enabled.
 * Used by sendbox handlers to decide whether to prepend /no_think.
 */
export const isThinkingEnabled = (): boolean => getThinkingEnabled();

/**
 * Check if a model supports thinking control.
 * Exported for use by sendbox components.
 */
export { supportsThinkingControl };
