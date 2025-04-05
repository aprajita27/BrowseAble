import { useState, useEffect } from 'react';

function Popup() {
  const [options, setOptions] = useState({
    simplifyUI: false,
    textToSpeech: false,
    colorFilter: false,
    summary: false
  });

  useEffect(() => {
    chrome.storage.sync.get('options', (data) => {
      if (data.options) setOptions(data.options);
    });
  }, []);

  const toggleOption = (key: keyof typeof options) => {
    const updated = { ...options, [key]: !options[key] };
    setOptions(updated);
    chrome.storage.sync.set({ options: updated });
  };
  

  return (
    <div style={{ padding: 10 }}>
      <h2>BrowseAble</h2>
      {(Object.entries(options) as [keyof typeof options, boolean][]).map(([key, value]) => (
            <div key={key}>
                <label>
                <input
                    type="checkbox"
                    checked={value}
                    onChange={() => toggleOption(key)}
                />
                {key}
                </label>
            </div>
        ))}

    </div>
  );
}

export default Popup;
