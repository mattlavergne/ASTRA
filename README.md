# ASTRA Studio

A browser beat production studio. Create patterns, write chords and basslines, perform on pads or MIDI, arrange sections into a song, mix tracks, and export audio.

This replaces the September 9 gravity playground. The opening session, **After hours**, is a complete editable downtempo beat. House and trap sessions and an empty project are also included.

## Run

Serve the repository with any static HTTP server. No dependencies, install, API keys, paid services, or build step are required.

```sh
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. Use a server because module scripts and the clock worker require HTTP. The root `index.html` forwards to `dist/`, so the same files work with branch-based GitHub Pages at the repository root.

Press Play to unlock browser audio. Start with the volume low and use headphones when checking your mix.

## Production workflow

1. **Program a beat.** Click or paint the 16-step grid. Edit patterns A–H, each one, two, or four bars long. Switch bar pages for longer patterns.
2. **Write notes.** Select an instrument and open Piano roll. Add chords, move notes, resize durations, and edit pitch, velocity, probability, timing delay, and retriggers. Right-click sequencer hits or double-click piano notes for precise values.
3. **Perform.** Play the first eight tracks with A/S/D/F/G/H/J/K. Use Q/2/W/3/E/T/6/Y/7/U/8/I/O for a chromatic octave on the selected instrument. Arm recording to write quantized notes into the selected pattern. Held synth notes sustain until release, up to 30 seconds. MIDI note-on, note-off, pitch, and velocity are supported after you enable MIDI input.
4. **Use your sounds.** Import audio as a sampler track, trim start and end, reverse it, or play it chromatically. C4/MIDI 60 is the original pitch. Sample playback is gated by note duration plus release; use long notes for loops. Audio format decoding depends on the browser. PCM WAV is the most portable choice.
5. **Arrange.** Add pattern sections, set repeats, and reorder sections by dragging or by the dialog's Move left/right buttons. Select Song playback to hear the arrangement. Pattern mode loops the selected pattern.
6. **Mix.** Set channel level, pan, mute/solo, low/mid/high EQ, low-pass cutoff and resonance, attack/release, room reverb send, and tempo-synchronized dotted-eighth delay send. The master has gain, metering, and optional safety compression.
7. **Save and finish.** Download a portable `.astra` project containing notes, settings, and original imported sample files. Open it on another computer. Export a stereo WAV master or a ZIP of aligned stereo stems.

## Audio export

- Stereo PCM WAV at 44.1 or 48 kHz, 16-bit with deterministic TPDF dither or 24-bit.
- Offline rendering uses the same Web Audio graph, instruments, event selection, EQ, and effect sends as playback.
- Export the arrangement or selected pattern, with zero, two, or four seconds of tail.
- Optional master sample-peak normalization to -1 dBFS. This does not measure LUFS or true peak and does not replace mastering checks.
- Without normalization, exports that exceed 0 dBFS are blocked with a level-adjustment message. A clipped WAV is not silently downloaded.
- Stems preserve channel level/pan/EQ and isolated effect sends. Master gain, master compression, and normalization are bypassed. Only currently audible tracks export, honoring mute and solo. Every stem has the same start and duration. A JSON manifest includes tempo and export settings.
- Summed stems can differ from a master processed through nonlinear master compression. Reapply master processing in your destination DAW.
- Metronome and live pad audition are excluded from offline exports.
- Probability decisions are deterministic for reproducible renders. The same pattern loop repeats the same decisions; arrangement sections use their absolute song positions.

## Instruments and mixing

Seven synthesized drum voices: analog kick, snare, closed hat, open hat, clap, rimshot, and tom. Four polyphonic melodic voices: sub bass, electric keys, analog lead, and soft pad. A chromatic sampler supports imported audio.

Synthesized drum buffers use deterministic noise and bounded envelopes. Melodic instruments use native oscillators and scheduled amplitude envelopes. The UI waveform for a synth is an illustrative instrument waveform; the master scope and channel meters read the real audio graph.

The safety compressor is a native dynamics compressor set to -2 dB threshold, 20:1 ratio, 3 ms attack, and 150 ms release. It is not a true-peak limiter. Attack/release controls apply to melodic instruments and samples; synthesized drums retain their built-in envelopes.

## Saving and privacy

- Autosave uses IndexedDB on the current device and origin. A restore action appears when a previous session exists.
- Download project files for durable backups. Clearing browser data or changing origin removes access to that device's autosave.
- Failed or pending local saves trigger the browser's normal unsaved-work prompt when leaving.
- Project changes support 60 undo states. Removed sample buffers stay in memory so undo can restore them; saving and reopening a project discards unused buffers.
- There is no analytics, account system, remote audio upload, external font request, or application backend.
- MIDI access is requested only when Connect MIDI is clicked, without SysEx access.
- Built-in sounds are generated by this application without third-party recordings. You may use those generated sounds in your music. Imported audio retains its existing licensing obligations.

## Keyboard and accessibility

| Control | Action |
| --- | --- |
| Space | Play/stop, when outside inputs or buttons |
| R | Arm/disarm recording |
| A S D F G H J K | First eight tracks |
| Q 2 W 3 E T 6 Y 7 U 8 I O | Chromatic C4–C5 on selected instrument |
| Ctrl/Cmd S | Download project, outside form inputs |
| Ctrl/Cmd Z | Undo |
| Ctrl/Cmd Shift Z | Redo |
| Enter/Space on a grid cell | Toggle the hit |
| Enter on an arrangement section | Edit section, including keyboard reordering |
| Enter on a piano note | Edit note |
| Delete/Backspace on a piano note | Remove note |
| Escape | Close dialog |

Controls use native buttons, sliders, selects, visible focus states, accessible names, and pressed states. The detailed note dialog provides a keyboard alternative to dragging. Narrow screens scroll the sequencer, piano roll, and mixer horizontally. CSS transitions respect reduced-motion preferences.

## Scope and limits

This is a self-contained beat studio and a substantial first production workflow. It has not been validated as a replacement for a mature desktop DAW.

- 16 tracks, 8 patterns, 512 notes per track per pattern, 64 arrangement sections, and 128 arrangement bars.
- Tempo 40–240 BPM, 4/4 meter, sixteenth-note placement with per-note positive timing offsets and up to four retriggers.
- Six-minute offline render limit; stem archives are capped at 180 MB before packaging.
- Individual imports: 20 MB / 120 seconds. Embedded sample data in a project: 64 MB. Decoded audio: 128 MB.
- No VST/AU hosting, multitrack microphone recording, audio time-stretching, MIDI-file import/export, tempo automation, or general parameter automation lanes.
- Live MIDI playback supports note-on/off and velocity. Pitch bend, sustain pedal, MIDI clock, and controller mapping are not implemented.
- Browser background throttling and device latency can affect performance. Keep the tab active while recording. The scheduling worker has a main-thread timer fallback when worker creation is unavailable.
- Stereo rendering, browser audio decoding, MIDI permissions, touch interactions, and visual layout still need real-browser/device verification. They were not exercised by the automated Node checks.

## Source

| File | Responsibility |
| --- | --- |
| `dist/index.html`, `dist/styles.css` | Studio workspace and responsive theme |
| `dist/app.js` | Editors, transport UI, mixer, performance, file workflows |
| `dist/model.js` | Validated project model, musical timing, event selection, history |
| `dist/audio.js` | Web Audio graph, synthesis, scheduling, offline rendering |
| `dist/clock.js` | Worker heartbeat for the look-ahead scheduler |
| `dist/files.js` | WAV, ZIP, project serialization, device autosave |
| `tests/studio.test.js` | Musical logic, actual drum PCM, file formats, audio API contracts |
| `scripts/check-assets.js` | Syntax, references, controls, labels, and Site identity checks |

Implementation reference: [W3C Web Audio API specification](https://www.w3.org/TR/webaudio/), including AudioContext scheduling, AudioParam automation, AudioBufferSourceNode, and OfflineAudioContext.

## Verification

With Node 22 or newer:

```sh
node scripts/check-assets.js
node --test tests/studio.test.js
```

Fifteen tests check project schema round-trips and malicious input, arrangement boundaries, tempo/swing timing, mute/solo/probability/retrigger selection, undo/redo, actual synthesized drum PCM, 16/24-bit WAV handling, ZIP integrity, embedded project assets, graph routing, sampler trimming, scheduler stall recovery, and offline render parameters.

The audio API contract double verifies scheduling and routing calls. It does not render browser effects or prove audible output. No browser, visual, or end-to-end verification is claimed.

## Hosting

The existing `.openai/hosting.json` identity and static `dist/` output are retained. The connected Site publication and GitHub Pages are separate destinations. Source changes do not by themselves update the existing Sites publication.
