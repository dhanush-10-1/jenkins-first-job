import React from 'react';
import Editor from '@monaco-editor/react';

interface YamlEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
}

export function YamlEditor({ value, onChange }: YamlEditorProps) {
  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Editor
        height="100%"
        defaultLanguage="yaml"
        theme="vs-dark"
        value={value}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}
