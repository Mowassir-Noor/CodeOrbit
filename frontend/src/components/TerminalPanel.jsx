import React, { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

let webcontainerInstance = null;
let isBooting = false;
let bootPromise = null;

const TerminalPanel = React.forwardRef(({ files }, ref) => {
    const terminalRef = useRef(null);
    const [status, setStatus] = useState('Booting WebContainer...');
    const termInstance = useRef(null);
    const fitAddon = useRef(null);
    const shellProcess = useRef(null);

    React.useImperativeHandle(ref, () => ({
        runCommand: (cmd) => {
            if (shellProcess.current) {
                const writer = shellProcess.current.input.getWriter();
                writer.write(cmd + '\n');
                writer.releaseLock();
            }
        },
        writeFile: async (path, content) => {
            if (webcontainerInstance) {
                await webcontainerInstance.fs.writeFile(path, content);
            }
        }
    }));

    useEffect(() => {
        // Initialize xterm
        const term = new Terminal({
            theme: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
            },
            fontFamily: '"Fira Code", monospace',
            fontSize: 13,
            cursorBlink: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(terminalRef.current);
        fit.fit();
        termInstance.current = term;
        fitAddon.current = fit;

        const boot = async () => {
            if (!webcontainerInstance && !bootPromise) {
                isBooting = true;
                bootPromise = WebContainer.boot();
            }
            if (bootPromise && !webcontainerInstance) {
                try {
                    webcontainerInstance = await bootPromise;
                } catch (e) {
                    setStatus('WebContainer failed to boot (check COOP/COEP headers).');
                    console.error(e);
                    bootPromise = null;
                    return;
                }
            }
            setStatus('WebContainer booted.');

            // Start a bash shell
            const process = await webcontainerInstance.spawn('jsh');
            process.output.pipeTo(new WritableStream({
                write(data) {
                    term.write(data);
                }
            }));

            shellProcess.current = process;

            // Send input from terminal to process
            term.onData((data) => {
                const writer = process.input.getWriter();
                writer.write(data);
                writer.releaseLock();
            });

            // Handle resize
            const onResize = () => {
                fit.fit();
                process.resize({ cols: term.cols, rows: term.rows });
            };
            window.addEventListener('resize', onResize);
            onResize();
        };

        boot();

        return () => {
            if (termInstance.current) {
                termInstance.current.dispose();
            }
        };
    }, []);

    // Sync files whenever they change
    useEffect(() => {
        if (!webcontainerInstance) return;

        const syncFiles = async () => {
            const tree = {};
            files.forEach(f => {
                const parts = f.filePath.split('/');
                let current = tree;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) {
                        current[parts[i]] = { directory: {} };
                    }
                    current = current[parts[i]].directory;
                }
                current[parts[parts.length - 1]] = {
                    file: {
                        contents: f.content || ''
                    }
                };
            });
            await webcontainerInstance.mount(tree);
        };
        
        syncFiles();
    }, [files]);

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <span>TERMINAL</span>
                <span style={styles.status}>{status}</span>
            </div>
            <div ref={terminalRef} style={styles.terminal} />
        </div>
    );
});

const styles = {
    container: {
        height: '30%',
        minHeight: '200px',
        backgroundColor: '#1e1e1e',
        borderTop: '1px solid #3c3c3c',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        padding: '5px 15px',
        backgroundColor: '#252526',
        color: '#cccccc',
        fontSize: '11px',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'space-between',
    },
    status: {
        color: '#858585',
        fontWeight: 'normal',
    },
    terminal: {
        flex: 1,
        padding: '8px',
        overflow: 'hidden',
    }
};

export default TerminalPanel;
