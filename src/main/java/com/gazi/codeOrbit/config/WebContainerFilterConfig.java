package com.gazi.codeOrbit.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

@Configuration
public class WebContainerFilterConfig {

    @Bean
    public Filter crossOriginIsolationFilter() {
        return new Filter() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                    throws IOException, ServletException {
                
                HttpServletResponse httpResponse = (HttpServletResponse) response;
                // Required for WebContainers API and xterm.js (SharedArrayBuffer support)
                httpResponse.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                httpResponse.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
                
                chain.doFilter(request, response);
            }
        };
    }
}
