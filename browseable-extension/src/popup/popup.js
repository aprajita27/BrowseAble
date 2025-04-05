import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
            if (data.options)
                setOptions(data.options);
        });
    }, []);
    const toggleOption = (key) => {
        const updated = { ...options, [key]: !options[key] };
        setOptions(updated);
        chrome.storage.sync.set({ options: updated });
    };
    return (_jsxs("div", { style: { padding: 10 }, children: [_jsx("h2", { children: "BrowseAble" }), Object.entries(options).map(([key, value]) => (_jsx("div", { children: _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: value, onChange: () => toggleOption(key) }), key] }) }, key)))] }));
}
export default Popup;
