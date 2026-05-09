import { useState, useCallback } from 'react';
import { projectFileService } from '../services/api';

const LANGUAGE_CONFIG = {
    js: { name: 'JavaScript', ext: ['js', 'mjs'] },
    ts: { name: 'TypeScript', ext: ['ts', 'tsx'] },
    py: { name: 'Python', ext: ['py'] },
    c: { name: 'C', ext: ['c'] },
    cpp: { name: 'C++', ext: ['cpp', 'cc', 'cxx'] },
    rs: { name: 'Rust', ext: ['rs'] },
    go: { name: 'Go', ext: ['go'] },
    java: { name: 'Java', ext: ['java'] },
    rb: { name: 'Ruby', ext: ['rb'] },
    php: { name: 'PHP', ext: ['php'] },
};

const useBackendRunner = (terminalRef) => {
    const [isExecuting, setIsExecuting] = useState(false);

    const detectLanguage = useCallback((filePath) => {
        const ext = filePath.split('.').pop().toLowerCase();
        for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
            if (config.ext.includes(ext)) {
                return { lang, config };
            }
        }
        return { lang: ext, config: { name: ext.toUpperCase(), ext: [ext] } };
    }, []);

    const writeToTerminal = useCallback((text, isError = false) => {
        // Try to write directly to xterm instance if available
        const term = terminalRef.current?._term || terminalRef.current?.term;
        if (term && term.write) {
            const prefix = isError ? '\r\n[Error] ' : '\r\n';
            const lines = text.split('\n');
            lines.forEach(line => {
                if (line.trim() || line === '') {
                    term.write(prefix + line);
                }
            });
            return;
        }
        
        // Fallback: use runCommand with echo (may have issues in WebContainer)
        if (terminalRef.current?.runCommand) {
            const prefix = isError ? '[Error] ' : '';
            const lines = text.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const safeLine = line.replace(/"/g, '\\"').replace(/`/g, '\\`');
                    terminalRef.current.runCommand(`echo "${prefix}${safeLine}"`);
                }
            });
        }
    }, [terminalRef]);

    const execute = useCallback(async (filePath, code, stdin = '') => {
        setIsExecuting(true);
        
        try {
            const { lang, config } = detectLanguage(filePath);
            
            // Clear terminal
            terminalRef.current?.clear?.();
            
            // Show what's running
            writeToTerminal(`Running ${config.name}...`, false);
            writeToTerminal(`File: ${filePath}`, false);
            writeToTerminal('---', false);

            const response = await projectFileService.executeCode(
                lang,
                code,
                filePath.split('/').pop(), // Just the filename
                stdin,
                30 // 30 second timeout
            );

            const result = response.data;

            if (result.success) {
                if (result.output) {
                    writeToTerminal(result.output, false);
                }
                writeToTerminal('---', false);
                writeToTerminal(`✓ Execution completed in ${result.executionTimeMs || '?'}ms`, false);
            } else {
                if (result.output) {
                    writeToTerminal(result.output, false);
                }
                if (result.error) {
                    writeToTerminal(result.error, true);
                }
                writeToTerminal('---', false);
                const exitCodeStr = result.exitCode !== undefined ? result.exitCode : '?';
                writeToTerminal(`✗ Execution failed (exit code: ${exitCodeStr})`, true);
            }

            return {
                success: result.success,
                output: result.output,
                error: result.error,
                executionTimeMs: result.executionTimeMs
            };

        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Execution failed';
            writeToTerminal(`Request failed: ${errorMsg}`, true);
            console.error('Execution error:', err);
            return { success: false, error: errorMsg };
        } finally {
            setIsExecuting(false);
        }
    }, [detectLanguage, writeToTerminal, terminalRef]);

    const getSupportedLanguages = useCallback(async () => {
        try {
            const response = await projectFileService.getSupportedLanguages();
            return response.data;
        } catch (err) {
            console.error('Failed to get supported languages:', err);
            return Object.keys(LANGUAGE_CONFIG);
        }
    }, []);

    return {
        execute,
        detectLanguage,
        getSupportedLanguages,
        isExecuting,
        LANGUAGE_CONFIG
    };
};

export { useBackendRunner, LANGUAGE_CONFIG };
export default useBackendRunner;
