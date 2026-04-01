/**
 * SMILEZGERMZ // MAIN.JS (LOCAL FILE MODE)
 */

class SmilezGermz {
    constructor() {
        this.canvas = document.getElementById('gl-canvas');
        this.gl = this.canvas.getContext('webgl');
        this.audioCtx = null;
        this.analyser = null;
        this.tracks = [];
        this.activeTrackIndex = 0;
        this.uniforms = { time: 0, resolution: [0, 0], bass: 0, mids: 0, highs: 0, glitch: 0 };
        this.init();
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        document.getElementById('enter-store').addEventListener('click', () => this.toggleStore(true));
        document.getElementById('close-store').addEventListener('click', () => this.toggleStore(false));

        // Note: For local files, we fetch the fragment shader directly as a string or embed it
        await this.initWebGL();
        requestAnimationFrame((t) => this.render(t));
        window.addEventListener('mousedown', () => this.startEngine(), { once: true });
    }

    async startEngine() {
        await this.initAudio();
        this.setupAudioSwitcher();
    }

    async initWebGL() {
        const gl = this.gl;
        const vertexShaderSource = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
        
        // Local File Hack: We must embed the shader or it might fail CORS on some browsers
        const fragmentShaderSource = await fetch('fragment.glsl').then(r => r.text()).catch(e => {
            return `precision highp float; uniform float u_time; void main() { gl_FragColor = vec4(0.1, 0.0, 0.2, 1.0); }`;
        });

        const createShader = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        };

        const program = gl.createProgram();
        gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexShaderSource));
        gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
        gl.linkProgram(program);
        gl.useProgram(program);
        this.program = program;

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

        const posAttrib = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posAttrib);
        gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

        this.uLocs = {
            time: gl.getUniformLocation(program, 'u_time'),
            resolution: gl.getUniformLocation(program, 'u_resolution'),
            bass: gl.getUniformLocation(program, 'u_bass'),
            mids: gl.getUniformLocation(program, 'u_mids'),
            highs: gl.getUniformLocation(program, 'u_highs'),
            glitch: gl.getUniformLocation(program, 'u_glitch')
        };
    }

    async initAudio() {
        if (this.audioCtx) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        // HARDCODED TRACK LIST (Since fetch('tracks.json') fails locally)
        const trackFiles = ["789.mp3", "Chainsaw.mp3", "Event horizon .mp3", "Firestorm Run (Remastered).mp3", "High-Speed Projectile (Remix) (Remastered).mp3", "Scorpion .mp3", "Sunshine (Remastered).mp3", "The Binding Cog.mp3", "dunce cap.mp3", "golden ratio.mp3", "rust.mp3", "sonic.mp3", "soulful.mp3", "spark in the dark .mp3", "stone henge (1).mp3", "stone henge (2).mp3", "stone henge.mp3", "the golden ratio.mp3", "the only pull (Remix) (1).mp3"];
        
        this.tracks = trackFiles.map(filename => {
            const audio = new Audio(`music/${encodeURIComponent(filename)}`);
            audio.crossOrigin = "anonymous";
            audio.loop = true;
            const source = this.audioCtx.createMediaElementSource(audio);
            const gain = this.audioCtx.createGain();
            gain.gain.value = 0;
            source.connect(gain);
            gain.connect(this.analyser);
            gain.connect(this.audioCtx.destination);
            return { name: filename, audio, gain };
        });

        if (this.tracks.length > 0) this.switchTrack(0);
    }

    setupAudioSwitcher() {
        const switcher = document.getElementById('audio-switcher');
        switcher.innerHTML = '';
        this.tracks.forEach((track, i) => {
            const btn = document.createElement('button');
            btn.textContent = track.name;
            btn.onclick = () => this.switchTrack(i);
            switcher.appendChild(btn);
        });
    }

    switchTrack(index) {
        if (!this.audioCtx) return;
        this.tracks.forEach((t, i) => {
            const targetGain = (i === index) ? 1.0 : 0.0;
            t.gain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.5);
            if (i === index) t.audio.play(); else { t.audio.pause(); t.audio.currentTime = 0; }
        });
        this.activeTrackIndex = index;
    }

    toggleStore(show) { document.getElementById('store-overlay').classList.toggle('hidden', !show); }
    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; this.gl.viewport(0, 0, this.canvas.width, this.canvas.height); this.uniforms.resolution = [this.canvas.width, this.canvas.height]; }

    processAudio() {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        let bass=0, mids=0, highs=0;
        for(let i=0; i<15; i++) bass += this.dataArray[i];
        for(let i=15; i<120; i++) mids += this.dataArray[i];
        for(let i=120; i<256; i++) highs += this.dataArray[i];
        this.uniforms.bass = (bass/15)/255; this.uniforms.mids = (mids/105)/255; this.uniforms.highs = (highs/136)/255;
        this.uniforms.glitch = Math.max(...this.dataArray.slice(150, 256))/255 > 0.8 ? 1.0 : this.uniforms.glitch * 0.85;
    }

    render(t) {
        this.uniforms.time = t * 0.001; this.processAudio();
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.uniform1f(this.uLocs.time, this.uniforms.time);
        this.gl.uniform2f(this.uLocs.resolution, this.uniforms.resolution[0], this.uniforms.resolution[1]);
        this.gl.uniform1f(this.uLocs.bass, this.uniforms.bass);
        this.gl.uniform1f(this.uLocs.mids, this.uniforms.mids);
        this.gl.uniform1f(this.uLocs.highs, this.uniforms.highs);
        this.gl.uniform1f(this.uLocs.glitch, this.uniforms.glitch);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        requestAnimationFrame((t) => this.render(t));
    }
}
new SmilezGermz();
