import { useEffect, useRef, useState } from 'react';
import { loadPyodide } from 'pyodide';

// Language runtimes singleton
let pyodideInstance = null;
let pyodideLoading = false;
let pyodidePromise = null;

const loadPyodideRuntime = async () => {
    if (pyodideInstance) return pyodideInstance;
    if (pyodideLoading) return pyodidePromise;
    
    pyodideLoading = true;
    pyodidePromise = loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
    });
    pyodideInstance = await pyodidePromise;
    pyodideLoading = false;
    return pyodideInstance;
};

const LANGUAGE_CONFIG = {
    js: { name: 'JavaScript', executor: 'webcontainer', ext: ['js', 'mjs'] },
    ts: { name: 'TypeScript', executor: 'webcontainer', ext: ['ts', 'tsx'] },
    py: { name: 'Python', executor: 'pyodide', ext: ['py'] },
    c: { name: 'C', executor: 'wasmer', ext: ['c'] },
    cpp: { name: 'C++', executor: 'wasmer', ext: ['cpp', 'cc', 'cxx'] },
    rs: { name: 'Rust', executor: 'wasmer', ext: ['rs'] },
    go: { name: 'Go', executor: 'wasmer', ext: ['go'] },
    java: { name: 'Java', executor: 'cheerpj', ext: ['java'] },
    rb: { name: 'Ruby', executor: 'wasmer', ext: ['rb'] },
    php: { name: 'PHP', executor: 'wasmer', ext: ['php'] },
};

const useMultiLanguageRunner = (terminalRef) => {
    const [runtimesReady, setRuntimesReady] = useState({
        pyodide: false,
        wasmer: false,
        cheerpj: false
    });
    const outputBuffer = useRef('');

    useEffect(() => {
        // Preload Pyodide
        loadPyodideRuntime()
            .then(() => {
                setRuntimesReady(prev => ({ ...prev, pyodide: true }));
                console.log('Pyodide loaded');
            })
            .catch(err => console.error('Pyodide failed to load:', err));
    }, []);

    const runPython = async (code, filePath) => {
        try {
            const pyodide = await loadPyodideRuntime();
            
            // Helper to write to terminal
            const writeToTerm = (text, isError = false) => {
                if (terminalRef.current?.runCommand) {
                    // Send as echo command to show in terminal
                    const prefix = isError ? '\r\n[Python Error] ' : '';
                    const lines = text.split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            terminalRef.current.runCommand(`echo "${prefix}${line.replace(/"/g, '\\"')}"`);
                        }
                    });
                }
            };
            
            // Capture stdout
            pyodide.setStdout({ batched: (text) => {
                writeToTerm(text, false);
            }});
            
            pyodide.setStderr({ batched: (text) => {
                writeToTerm(text, true);
            }});

            // Run the code
            await pyodide.runPythonAsync(code);
            
            return { success: true, output: 'Python execution completed' };
        } catch (err) {
            const errorMsg = err.toString();
            if (terminalRef.current?.runCommand) {
                terminalRef.current.runCommand(`echo "Python Error: ${errorMsg.replace(/"/g, '\\"')}"`);
            }
            return { success: false, error: errorMsg };
        }
    };

    const runWebContainer = async (filePath, content, terminalRef) => {
        // This is handled by the parent TerminalPanel
        const ext = filePath.split('.').pop();
        const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
        
        if (dir) {
            await terminalRef.current.mkdir(dir);
        }
        
        await terminalRef.current.writeFile(filePath, content);
        
        let cmd;
        if (ext === 'js' || ext === 'mjs') {
            cmd = `node ${filePath}`;
        } else if (ext === 'ts' || ext === 'tsx') {
            cmd = `npx ts-node ${filePath}`;
        } else {
            cmd = `./${filePath}`;
        }
        
        const success = terminalRef.current.runCommand(cmd);
        return { success, output: success ? 'Running...' : 'Failed to execute' };
    };

    const runWASI = async (code, filePath, lang) => {
        const msg = `${lang}: Client-side compilation not yet implemented. Use a backend compiler service.`;
        if (terminalRef.current?.runCommand) {
            terminalRef.current.runCommand(`echo "${msg}"`);
        }
        
        return { 
            success: false, 
            error: msg
        };
    };

    const runJava = async (code, filePath) => {
        const msg = 'Java: Requires CheerpJ or backend compilation service.';
        if (terminalRef.current?.runCommand) {
            terminalRef.current.runCommand(`echo "${msg}"`);
        }
        
        return {
            success: false,
            error: msg
        };
    };

    const detectLanguage = (filePath) => {
        const ext = filePath.split('.').pop().toLowerCase();
        for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
            if (config.ext.includes(ext)) {
                return { lang, config };
            }
        }
        return { lang: ext, config: { name: ext.toUpperCase(), executor: 'unknown', ext: [ext] } };
    };

    const execute = async (filePath, content, terminalRef) => {
        const { lang, config } = detectLanguage(filePath);
        
        console.log(`Executing ${config.name} (${lang})...`);
        
        switch (config.executor) {
            case 'pyodide':
                return runPython(content, filePath);
            case 'webcontainer':
                return runWebContainer(filePath, content, terminalRef);
            case 'wasmer':
                return runWASI(content, filePath, config.name);
            case 'cheerpj':
                return runJava(content, filePath);
            default:
                return { 
                    success: false, 
                    error: `Unknown language: ${config.name}. Supported: ${Object.values(LANGUAGE_CONFIG).map(c => c.name).join(', ')}` 
                };
        }
    };

    return {
        execute,
        detectLanguage,
        isReady: (lang) => {
            const config = Object.values(LANGUAGE_CONFIG).find(c => c.ext.includes(lang));
            if (!config) return false;
            if (config.executor === 'pyodide') return runtimesReady.pyodide;
            if (config.executor === 'wasmer') return runtimesReady.wasmer;
            if (config.executor === 'webcontainer') return !!terminalRef?.current;
            return false;
        },
        getSupportedLanguages: () => Object.values(LANGUAGE_CONFIG).map(c => c.name),
        LANGUAGE_CONFIG
    };
};

// Backward compatibility - functional component wrapper
const MultiLanguageRunner = (props) => useMultiLanguageRunner(props.terminalRef);

export { useMultiLanguageRunner, LANGUAGE_CONFIG };
export default MultiLanguageRunner;
