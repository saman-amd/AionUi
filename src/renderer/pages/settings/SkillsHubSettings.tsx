import { ipcBridge } from '@/common';
import { Button, Message, Modal, Input } from '@arco-design/web-react';
import { Delete, EditTwo, FolderOpen, Search, Refresh } from '@icon-park/react';
import MarkdownView from '@/renderer/components/Markdown';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsPageWrapper from './components/SettingsPageWrapper';

type SkillInfo = {
  name: string;
  description: string;
  location: string;
  isCustom: boolean;
};

const getAvatarColorClass = (name: string) => {
  if (!name) return 'bg-[#165DFF] text-white';
  const colors = [
    'bg-[#165DFF] text-white', // Blue
    'bg-[#00B42A] text-white', // Green
    'bg-[#722ED1] text-white', // Purple
    'bg-[#F5319D] text-white', // Pink
    'bg-[#F77234] text-white', // Orange
    'bg-[#14C9C9] text-white', // Cyan
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const SkillsHubSettings: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [skillPaths, setSkillPaths] = useState<{ userSkillsDir: string; builtinSkillsDir: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Skill editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorSkill, setEditorSkill] = useState<SkillInfo | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorOriginalContent, setEditorOriginalContent] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState<'edit' | 'preview'>('edit');

  const editorHasChanges = editorContent !== editorOriginalContent;

  const VISIBLE_SKILLS = ['company-analyzer'];

  const visibleSkills = useMemo(
    () => availableSkills.filter((s) => VISIBLE_SKILLS.includes(s.name)),
    [availableSkills]
  );

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return visibleSkills;
    const lowerQuery = searchQuery.toLowerCase();
    return visibleSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) || (s.description && s.description.toLowerCase().includes(lowerQuery))
    );
  }, [visibleSkills, searchQuery]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const skills = await ipcBridge.fs.listAvailableSkills.invoke();
      setAvailableSkills(skills);

      const paths = await ipcBridge.fs.getSkillPaths.invoke();
      setSkillPaths(paths);
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      Message.error(t('settings.skillsHub.fetchError', { defaultValue: 'Failed to fetch skills' }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleDelete = async (skillName: string) => {
    try {
      const result = await ipcBridge.fs.deleteSkill.invoke({ skillName });
      if (result.success) {
        Message.success(result.msg || t('settings.skillsHub.deleteSuccess', { defaultValue: 'Skill deleted' }));
        void fetchData();
      } else {
        Message.error(result.msg || t('settings.skillsHub.deleteFailed', { defaultValue: 'Failed to delete skill' }));
      }
    } catch (error) {
      console.error('Failed to delete skill:', error);
      Message.error(t('settings.skillsHub.deleteError', { defaultValue: 'Error deleting skill' }));
    }
  };

  const handleOpenEditor = useCallback(async (skill: SkillInfo) => {
    setEditorSkill(skill);
    setEditorVisible(true);
    setEditorLoading(true);
    setEditorViewMode('edit');
    try {
      const content = await ipcBridge.fs.readFile.invoke({ path: skill.location });
      const text = content ?? '';
      setEditorContent(text);
      setEditorOriginalContent(text);
    } catch (error) {
      console.error('Failed to read skill file:', error);
      Message.error(t('settings.skillsHub.readError', { defaultValue: 'Failed to read skill file' }));
      setEditorVisible(false);
    } finally {
      setEditorLoading(false);
    }
  }, [t]);

  const handleSaveSkill = useCallback(async () => {
    if (!editorSkill) return;
    setEditorSaving(true);
    try {
      await ipcBridge.fs.writeFile.invoke({ path: editorSkill.location, data: editorContent });
      setEditorOriginalContent(editorContent);
      Message.success(t('settings.skillsHub.saveSuccess', { defaultValue: 'Skill saved successfully' }));
      void fetchData();
    } catch (error) {
      console.error('Failed to save skill file:', error);
      Message.error(t('settings.skillsHub.saveError', { defaultValue: 'Failed to save skill' }));
    } finally {
      setEditorSaving(false);
    }
  }, [editorSkill, editorContent, t, fetchData]);

  const handleCloseEditor = useCallback(() => {
    if (editorHasChanges) {
      Modal.confirm({
        title: t('settings.skillsHub.unsavedTitle', { defaultValue: 'Unsaved Changes' }),
        content: t('settings.skillsHub.unsavedContent', { defaultValue: 'You have unsaved changes. Discard them?' }),
        okText: t('common.confirm', { defaultValue: 'Discard' }),
        cancelText: t('common.cancel', { defaultValue: 'Cancel' }),
        okButtonProps: { status: 'danger' },
        onOk: () => {
          setEditorVisible(false);
          setEditorSkill(null);
          setEditorContent('');
          setEditorOriginalContent('');
        },
      });
    } else {
      setEditorVisible(false);
      setEditorSkill(null);
      setEditorContent('');
      setEditorOriginalContent('');
    }
  }, [editorHasChanges, t]);

  return (
    <>
      <SettingsPageWrapper>
        <div className='flex flex-col h-full w-full'>
          <div className='space-y-16px pb-24px'>
            {/* ======== My Skills ======== */}
            <div className='px-[16px] md:px-[32px] py-32px bg-base rd-16px md:rd-24px shadow-sm border border-b-base relative overflow-hidden transition-all'>
              {/* Toolbar */}
              <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-16px mb-24px relative z-10'>
                <div className='flex items-center gap-10px shrink-0'>
                  <span className='text-16px md:text-18px text-t-primary font-bold tracking-tight'>
                    {t('settings.skillsHub.mySkillsTitle', { defaultValue: 'My Skills' })}
                  </span>
                  <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 text-12px px-10px py-2px rd-[100px] font-medium ml-4px'>
                    {visibleSkills.length}
                  </span>
                  <button
                    className='outline-none border-none bg-transparent cursor-pointer p-6px text-t-tertiary hover:text-primary-6 transition-colors rd-full hover:bg-fill-2 ml-4px'
                    onClick={async () => {
                      await fetchData();
                      Message.success(t('common.refreshSuccess', { defaultValue: 'Refreshed' }));
                    }}
                    title={t('common.refresh', { defaultValue: 'Refresh' })}
                  >
                    <Refresh theme='outline' size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className='relative group shrink-0 w-full lg:w-[240px]'>
                  <div className='absolute left-12px top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary-6 flex pointer-events-none transition-colors'>
                    <Search size={15} />
                  </div>
                  <input
                    type='text'
                    className='w-full bg-fill-1 hover:bg-fill-2 border border-border-1 focus:border-primary-5 focus:bg-base outline-none rd-8px py-6px pl-36px pr-12px text-13px text-t-primary placeholder:text-t-tertiary transition-all shadow-sm box-border m-0'
                    placeholder={t('settings.skillsHub.searchPlaceholder', { defaultValue: 'Search skills...' })}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Path Display */}
              {skillPaths && (
                <div className='flex items-center gap-8px text-12px text-t-tertiary font-mono bg-transparent py-4px mb-16px relative z-10 pt-4px border-t border-t-transparent'>
                  <FolderOpen size={16} className='shrink-0' />
                  <span className='truncate' title={skillPaths.userSkillsDir}>
                    {skillPaths.userSkillsDir}
                  </span>
                </div>
              )}

              {visibleSkills.length > 0 ? (
                <div className='w-full flex flex-col gap-6px relative z-10'>
                  {filteredSkills.map((skill) => (
                    <div
                      key={skill.name}
                      className='group flex flex-col sm:flex-row gap-16px p-16px bg-base border border-transparent hover:border-border-1 hover:bg-fill-1 hover:shadow-sm rd-12px transition-all duration-200'
                    >
                      <div className='shrink-0 flex items-start sm:mt-2px'>
                        <div
                          className={`w-40px h-40px rd-10px flex items-center justify-center font-bold text-16px shadow-sm text-transform-uppercase ${getAvatarColorClass(skill.name)}`}
                        >
                          {skill.name.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      <div className='flex-1 min-w-0 flex flex-col justify-center gap-6px'>
                        <div className='flex items-center gap-10px flex-wrap'>
                          <h3 className='text-14px font-semibold text-t-primary/90 truncate m-0'>{skill.name}</h3>
                          {skill.isCustom ? (
                            <span className='bg-[rgba(var(--orange-6),0.08)] text-orange-6 border border-[rgba(var(--orange-6),0.2)] text-11px px-6px py-1px rd-4px font-medium'>
                              {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
                            </span>
                          ) : (
                            <span className='bg-[rgba(var(--blue-6),0.08)] text-blue-6 border border-[rgba(var(--blue-6),0.2)] text-11px px-6px py-1px rd-4px font-medium'>
                              {t('settings.skillsHub.builtin', { defaultValue: 'Built-in' })}
                            </span>
                          )}
                        </div>
                        {skill.description && (
                          <p
                            className='text-13px text-t-secondary leading-relaxed line-clamp-2 m-0'
                            title={skill.description}
                          >
                            {skill.description}
                          </p>
                        )}
                      </div>

                      <div className='shrink-0 sm:self-center flex items-center justify-end gap-6px mt-12px sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity pl-4px'>
                        <button
                          className='p-8px hover:bg-primary-1 hover:text-primary-6 text-t-tertiary rd-6px outline-none flex items-center justify-center border border-transparent cursor-pointer transition-colors shadow-sm bg-base sm:bg-transparent sm:shadow-none'
                          onClick={() => void handleOpenEditor(skill)}
                          title={t('common.edit', { defaultValue: 'Edit' })}
                        >
                          <EditTwo size={16} />
                        </button>
                        {skill.isCustom && (
                          <button
                            className='p-8px hover:bg-danger-1 hover:text-danger-6 text-t-tertiary rd-6px outline-none flex items-center justify-center border border-transparent cursor-pointer transition-colors shadow-sm bg-base sm:bg-transparent sm:shadow-none'
                            onClick={() => {
                              Modal.confirm({
                                title: t('settings.skillsHub.deleteConfirmTitle', { defaultValue: 'Delete Skill' }),
                                content: t('settings.skillsHub.deleteConfirmContent', {
                                  name: skill.name,
                                  defaultValue: `Are you sure you want to delete "${skill.name}"?`,
                                }),
                                okButtonProps: { status: 'danger' },
                                onOk: () => void handleDelete(skill.name),
                              });
                            }}
                            title={t('common.delete', { defaultValue: 'Delete' })}
                          >
                            <Delete size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center text-t-secondary text-13px py-40px bg-fill-1 rd-12px border border-b-base border-dashed relative z-10'>
                  {loading
                    ? t('common.loading', { defaultValue: 'Please wait...' })
                    : t('settings.skillsHub.noSkills', {
                        defaultValue: 'No skills found.',
                      })}
                </div>
              )}
            </div>
          </div>
        </div>
      </SettingsPageWrapper>

      {/* Skill Editor Modal */}
      <Modal
        title={
          <div className='flex items-center gap-10px'>
            <span>{editorSkill?.name ?? t('settings.skillsHub.editSkill', { defaultValue: 'Edit Skill' })}</span>
            {editorSkill && (
              <span
                className={`text-11px px-6px py-1px rd-4px font-medium ${editorSkill.isCustom ? 'bg-[rgba(var(--orange-6),0.08)] text-orange-6 border border-[rgba(var(--orange-6),0.2)]' : 'bg-[rgba(var(--blue-6),0.08)] text-blue-6 border border-[rgba(var(--blue-6),0.2)]'}`}
              >
                {editorSkill.isCustom
                  ? t('settings.skillsHub.custom', { defaultValue: 'Custom' })
                  : t('settings.skillsHub.builtin', { defaultValue: 'Built-in' })}
              </span>
            )}
          </div>
        }
        visible={editorVisible}
        onCancel={handleCloseEditor}
        autoFocus={false}
        focusLock
        style={{ width: '80vw', maxWidth: 900 }}
        footer={
          <div className='flex items-center justify-between w-full'>
            <div className='flex items-center gap-8px text-12px text-t-tertiary font-mono truncate max-w-[60%]'>
              <FolderOpen size={14} className='shrink-0' />
              <span className='truncate' title={editorSkill?.location}>
                {editorSkill?.location}
              </span>
            </div>
            <div className='flex items-center gap-8px'>
              <Button onClick={handleCloseEditor}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button
                type='primary'
                loading={editorSaving}
                disabled={!editorHasChanges}
                onClick={() => void handleSaveSkill()}
              >
                {t('common.save', { defaultValue: 'Save' })}
              </Button>
            </div>
          </div>
        }
      >
        {editorLoading ? (
          <div className='flex items-center justify-center py-60px text-t-secondary'>
            {t('common.loading', { defaultValue: 'Loading...' })}
          </div>
        ) : (
          <div className='flex flex-col gap-0'>
            {/* Edit / Preview tabs */}
            <div className='flex border-b border-b-base mb-0'>
              <div
                className={`flex items-center px-16px py-8px cursor-pointer transition-all text-13px font-medium ${editorViewMode === 'edit' ? 'text-primary border-b-2 border-primary' : 'text-t-secondary hover:text-t-primary'}`}
                onClick={() => setEditorViewMode('edit')}
              >
                {t('common.edit', { defaultValue: 'Edit' })}
              </div>
              <div
                className={`flex items-center px-16px py-8px cursor-pointer transition-all text-13px font-medium ${editorViewMode === 'preview' ? 'text-primary border-b-2 border-primary' : 'text-t-secondary hover:text-t-primary'}`}
                onClick={() => setEditorViewMode('preview')}
              >
                {t('settings.skillsHub.preview', { defaultValue: 'Preview' })}
              </div>
            </div>

            {editorViewMode === 'edit' ? (
              <Input.TextArea
                value={editorContent}
                onChange={(value) => setEditorContent(value)}
                placeholder={t('settings.skillsHub.editorPlaceholder', {
                  defaultValue: 'Enter skill content in Markdown format...',
                })}
                autoSize={false}
                style={{
                  height: '60vh',
                  maxHeight: 600,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  resize: 'none',
                }}
              />
            ) : (
              <div
                className='p-16px text-14px leading-7 overflow-y-auto border border-border-1 rd-4px bg-fill-1'
                style={{ height: '60vh', maxHeight: 600 }}
              >
                {editorContent ? (
                  <MarkdownView hiddenCodeCopyButton>{editorContent}</MarkdownView>
                ) : (
                  <div className='text-t-secondary text-center py-32px'>
                    {t('settings.skillsHub.previewEmpty', { defaultValue: 'No content to preview' })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default SkillsHubSettings;
