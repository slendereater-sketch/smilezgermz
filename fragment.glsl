precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mids;
uniform float u_highs;
uniform float u_glitch; // High-frequency transient trigger

#define ITERATIONS 8

// Pseudo-random for glitch offsets
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
    
    // Horizontal Scanline Jitter (Glitch)
    if (u_glitch > 0.6) {
        float jitter = hash(vec2(floor(uv.y * 20.0), u_time)) * u_glitch * 0.1;
        uv.x += jitter;
    }

    // Initial rotation and scale
    float ang = u_time * 0.1 + u_mids * 0.5;
    float s = cos(ang), c = sin(ang);
    uv *= mat2(c, -s, s, c);
    uv *= 1.0 + u_bass * 0.3;

    vec3 col = vec3(0.0);
    
    // KIFS Iterations
    float scale = 1.6 + u_bass * 0.4;
    for(int i = 0; i < ITERATIONS; i++) {
        uv = abs(uv);
        if (uv.x < uv.y) uv.yx = uv.xy;
        uv *= scale;
        uv -= vec2(0.5, 0.8) * (1.0 + u_highs * 0.2);
        
        ang += u_mids * 0.1;
        s = cos(ang); c = sin(ang);
        uv *= mat2(c, -s, s, c);
    }

    float d = length(uv) * exp(-length(uv * 0.15));
    
    // Toxic Biopunk Palette
    vec3 void_purple = vec3(0.08, 0.0, 0.15);
    vec3 neon_green = vec3(0.3, 1.0, 0.2);
    
    // Chromatic Aberration on Glitch
    float shift = u_glitch * 0.05;
    float r = mix(void_purple.r, neon_green.r, smoothstep(0.1, 0.0, abs(sin(d + u_time + shift))));
    float g = mix(void_purple.g, neon_green.g, smoothstep(0.1, 0.0, abs(sin(d + u_time))));
    float b = mix(void_purple.b, neon_green.b, smoothstep(0.1, 0.0, abs(sin(d + u_time - shift))));
    
    col = vec3(r, g, b);
    
    // Glow edges
    float glow = (0.015 + u_glitch * 0.02) / abs(sin(d * 2.0 + u_time));
    col += neon_green * glow;
    
    // Scanlines
    col *= 0.9 + 0.1 * sin(gl_FragCoord.y * 1.5);
    
    // Vignette
    col *= 1.0 - length(uv * 0.005);

    gl_FragColor = vec4(col, 1.0);
}
