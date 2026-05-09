package com.gazi.codeOrbit.service;

import com.gazi.codeOrbit.dto.ExecuteRequest;
import com.gazi.codeOrbit.dto.ExecuteResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.concurrent.*;
import java.util.UUID;

@Service
@Slf4j
public class CodeExecutionService {

    private static final long DEFAULT_TIMEOUT_SECONDS = 30;
    private static final long MAX_TIMEOUT_SECONDS = 60;

    private final ExecutorService executor = Executors.newCachedThreadPool();

    public String[] getSupportedLanguages() {
        return new String[] { "python", "javascript", "typescript", "c", "cpp", "rust", "go", "java" };
    }

    public ExecuteResponse execute(ExecuteRequest request) {
        long startTime = System.currentTimeMillis();
        String language = request.getLanguage() != null ? request.getLanguage().toLowerCase()
                : detectLanguage(request.getFileName());

        log.info("Executing {} code", language);

        switch (language) {
            case "python":
            case "py":
                return executePython(request, startTime);
            case "javascript":
            case "js":
                return executeJavaScript(request, startTime);
            case "typescript":
            case "ts":
                return executeTypeScript(request, startTime);
            case "c":
                return executeC(request, startTime);
            case "cpp":
            case "c++":
                return executeCpp(request, startTime);
            case "rust":
            case "rs":
                return executeRust(request, startTime);
            case "go":
            case "golang":
                return executeGo(request, startTime);
            case "java":
                return executeJava(request, startTime);
            default:
                return ExecuteResponse.builder()
                        .success(false)
                        .error("Unsupported language: " + language)
                        .language(language)
                        .executionTimeMs(System.currentTimeMillis() - startTime)
                        .build();
        }
    }

    private String detectLanguage(String fileName) {
        if (fileName == null)
            return "unknown";
        String ext = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
        switch (ext) {
            case "py":
                return "python";
            case "js":
                return "javascript";
            case "ts":
                return "typescript";
            case "c":
                return "c";
            case "cpp":
            case "cc":
            case "cxx":
                return "cpp";
            case "rs":
                return "rust";
            case "go":
                return "go";
            case "java":
                return "java";
            default:
                return ext;
        }
    }

    private ExecuteResponse executePython(ExecuteRequest request, long startTime) {
        String workDir = createTempDir();
        try {
            String fileName = request.getFileName() != null ? request.getFileName() : "main.py";
            Path filePath = Paths.get(workDir, fileName);
            Files.writeString(filePath, request.getCode());

            ProcessResult result = runProcess(
                    new String[] { "python3", filePath.toString() },
                    workDir,
                    request.getStdin(),
                    getTimeout(request));

            return buildResponse(result, "python", startTime);
        } catch (Exception e) {
            return errorResponse(e, "python", startTime);
        } finally {
            cleanup(workDir);
        }
    }

    private ExecuteResponse executeJavaScript(ExecuteRequest request, long startTime) {
        String workDir = createTempDir();
        try {
            String fileName = request.getFileName() != null ? request.getFileName() : "main.js";
            Path filePath = Paths.get(workDir, fileName);
            Files.writeString(filePath, request.getCode());

            ProcessResult result = runProcess(
                    new String[] { "node", filePath.toString() },
                    workDir,
                    request.getStdin(),
                    getTimeout(request));

            return buildResponse(result, "javascript", startTime);
        } catch (Exception e) {
            return errorResponse(e, "javascript", startTime);
        } finally {
            cleanup(workDir);
        }
    }

    private ExecuteResponse executeTypeScript(ExecuteRequest request, long startTime) {
        String workDir = createTempDir();
        try {
            String fileName = request.getFileName() != null ? request.getFileName() : "main.ts";
            Path filePath = Paths.get(workDir, fileName);
            Files.writeString(filePath, request.getCode());

            // Try ts-node first, fallback to tsc + node
            ProcessResult result = runProcess(
                    new String[] { "npx", "ts-node", filePath.toString() },
                    workDir,
                    request.getStdin(),
                    getTimeout(request));

            if (result.exitCode != 0 && result.output.contains("ts-node")) {
                // Fallback: compile then run
                ProcessResult compileResult = runProcess(
                        new String[] { "npx", "tsc", filePath.toString(), "--outDir", workDir },
                        workDir,
                        null,
                        getTimeout(request));

                if (compileResult.exitCode == 0) {
                    String jsFile = fileName.replace(".ts", ".js");
                    result = runProcess(
                            new String[] { "node", Paths.get(workDir, jsFile).toString() },
                            workDir,
                            request.getStdin(),
                            getTimeout(request));
                } else {
                    result = compileResult;
                }
            }

            return buildResponse(result, "typescript", startTime);
        } catch (Exception e) {
            return errorResponse(e, "typescript", startTime);
        } finally {
            cleanup(workDir);
        }
    }

    private ExecuteResponse executeC(ExecuteRequest request, long startTime) {
        return executeCompiled(request, startTime, "c", "gcc",
                new String[] { "gcc", "-o", "main", "main.c", "-std=c99", "-Wall" }, "./main");
    }

    private ExecuteResponse executeCpp(ExecuteRequest request, long startTime) {
        return executeCompiled(request, startTime, "cpp", "g++",
                new String[] { "g++", "-o", "main", "main.cpp", "-std=c++17", "-Wall" }, "./main");
    }

    private ExecuteResponse executeRust(ExecuteRequest request, long startTime) {
        String workDir = createTempDir();
        try {
            String fileName = request.getFileName() != null ? request.getFileName() : "main.rs";
            Path filePath = Paths.get(workDir, fileName);
            Files.writeString(filePath, request.getCode());

            // Compile
            ProcessResult compileResult = runProcess(
                    new String[] { "rustc", filePath.toString(), "-o", "main" },
                    workDir,
                    null,
                    getTimeout(request) * 2 // Compilation may take longer
            );

            if (compileResult.exitCode != 0) {
                return buildResponse(compileResult, "rust", startTime);
            }

            // Run
            ProcessResult runResult = runProcess(
                    new String[] { "./main" },
                    workDir,
                    request.getStdin(),
                    getTimeout(request));

            return buildResponse(runResult, "rust", startTime);
        } catch (Exception e) {
            return errorResponse(e, "rust", startTime);
        } finally {
            cleanup(workDir);
        }
    }

    private ExecuteResponse executeGo(ExecuteRequest request, long startTime) {
        String workDir = createTempDir();
        try {
            String fileName = request.getFileName() != null ? request.getFileName() : "main.go";
            Path filePath = Paths.get(workDir, fileName);
            Files.writeString(filePath, request.getCode());

            // Go run compiles and runs in one step
            ProcessResult result = runProcess(
                    new String[] { "go", "run", filePath.toString() },
                    workDir,
                    request.getStdin(),
                    getTimeout(request));

            return buildResponse(result, "go", startTime);
        } catch (Exception e) {
            return errorResponse(e, "go", startTime);
        } finally {
            cleanup(workDir);
        }
    }

    private ExecuteResponse executeJava(ExecuteRequest request, long startTime) {
        String workDir = createTempDir();
        try {
            // Determine class name from file name or code
            String className = "Main";
            String fileName = request.getFileName();

            if (fileName != null && fileName.endsWith(".java")) {
                className = fileName.substring(0, fileName.length() - 5);
            } else {
                // Try to extract class name from code
                String code = request.getCode();
                if (code.contains("public class ")) {
                    int idx = code.indexOf("public class ") + 13;
                    int endIdx = code.indexOf(" ", idx);
                    if (endIdx == -1)
                        endIdx = code.indexOf("{", idx);
                    if (endIdx > idx) {
                        className = code.substring(idx, endIdx).trim();
                    }
                }
            }

            Path filePath = Paths.get(workDir, className + ".java");
            Files.writeString(filePath, request.getCode());

            // Compile
            ProcessResult compileResult = runProcess(
                    new String[] { "javac", filePath.toString() },
                    workDir,
                    null,
                    getTimeout(request));

            if (compileResult.exitCode != 0) {
                return buildResponse(compileResult, "java", startTime);
            }

            // Run
            ProcessResult runResult = runProcess(
                    new String[] { "java", className },
                    workDir,
                    request.getStdin(),
                    getTimeout(request));

            return buildResponse(runResult, "java", startTime);
        } catch (Exception e) {
            return errorResponse(e, "java", startTime);
        } finally {
            cleanup(workDir);
        }
    }

    private ExecuteResponse executeCompiled(ExecuteRequest request, long startTime, String language,
            String compiler, String[] compileCmd, String runCmd) {
        String workDir = createTempDir();
        try {
            String sourceFile = language.equals("c") ? "main.c" : "main.cpp";
            Path filePath = Paths.get(workDir, sourceFile);
            Files.writeString(filePath, request.getCode());

            // Compile
            ProcessResult compileResult = runProcess(
                    compileCmd,
                    workDir,
                    null,
                    getTimeout(request) * 2);

            if (compileResult.exitCode != 0) {
                return buildResponse(compileResult, language, startTime);
            }

            // Run
            ProcessResult runResult = runProcess(
                    new String[] { runCmd },
                    workDir,
                    request.getStdin(),
                    getTimeout(request));

            return buildResponse(runResult, language, startTime);
        } catch (Exception e) {
            return errorResponse(e, language, startTime);
        } finally {
            cleanup(workDir);
        }
    }

    private ProcessResult runProcess(String[] cmd, String workDir, String stdin, long timeoutSeconds) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(new File(workDir));
        pb.redirectErrorStream(true);

        // Security: clear environment
        pb.environment().clear();
        pb.environment().put("PATH", System.getenv("PATH"));
        pb.environment().put("HOME", workDir);

        Process process = pb.start();

        // Write stdin if provided
        if (stdin != null && !stdin.isEmpty()) {
            try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()))) {
                writer.write(stdin);
            }
        }

        // Read output with timeout
        Future<String> outputFuture = executor.submit(() -> {
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            return output.toString();
        });

        String output;
        int exitCode;

        try {
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new ProcessResult(-1, "Execution timed out after " + timeoutSeconds + " seconds", true);
            }

            exitCode = process.exitValue();
            output = outputFuture.get(5, TimeUnit.SECONDS); // Wait for output reading

        } catch (TimeoutException e) {
            process.destroyForcibly();
            outputFuture.cancel(true);
            return new ProcessResult(-1, "Execution timed out", true);
        }

        return new ProcessResult(exitCode, output, false);
    }

    private String createTempDir() {
        String workDir = "/tmp/codeorbit_" + UUID.randomUUID().toString().substring(0, 8);
        new File(workDir).mkdirs();
        return workDir;
    }

    private void cleanup(String workDir) {
        try {
            Files.walk(Paths.get(workDir))
                    .sorted((a, b) -> -a.compareTo(b))
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException e) {
                            // Ignore
                        }
                    });
        } catch (IOException e) {
            log.warn("Failed to cleanup {}: {}", workDir, e.getMessage());
        }
    }

    private long getTimeout(ExecuteRequest request) {
        long timeout = request.getTimeoutSeconds() != null ? request.getTimeoutSeconds() : DEFAULT_TIMEOUT_SECONDS;
        return Math.min(timeout, MAX_TIMEOUT_SECONDS);
    }

    private ExecuteResponse buildResponse(ProcessResult result, String language, long startTime) {
        return ExecuteResponse.builder()
                .success(result.exitCode == 0 && !result.timedOut)
                .output(result.output)
                .error(result.timedOut ? "Execution timed out" : null)
                .exitCode(result.exitCode)
                .executionTimeMs(System.currentTimeMillis() - startTime)
                .language(language)
                .build();
    }

    private ExecuteResponse errorResponse(Exception e, String language, long startTime) {
        return ExecuteResponse.builder()
                .success(false)
                .error(e.getMessage())
                .executionTimeMs(System.currentTimeMillis() - startTime)
                .language(language)
                .build();
    }

    @lombok.AllArgsConstructor
    private static class ProcessResult {
        int exitCode;
        String output;
        boolean timedOut;
    }
}
