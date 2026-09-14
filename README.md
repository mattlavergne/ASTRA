# ASTRA Studio

A browser beat production studio. Create patterns, write chords and basslines, play a drum kit and a piano keyboard on screen, arrange sections into a song, mix tracks, and export audio.

This replaces the September 9 gravity playground. The opening session, **After hours**, is a complete editable downtempo beat. House and trap sessions and an empty project are also included.

The studio has two faces. **Easy mode** is the default: pick a vibe, press one button, and get a whole arrangement written in a key you chose, then shape it with controls that say what they do. **Pro mode** is the full step sequencer, piano roll, mixer, and channel strip. Both edit the same project, so switching converts nothing and loses nothing.

## Run

Serve the repository with any static HTTP server. No dependencies, install, API keys, paid services, or build step are required.

```sh
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. Use a server because module scripts and the clock worker require HTTP. The root `index.html` forwards to `dist/`, so the same files work with branch-based GitHub Pages at the repository root.

Press Play to unlock browser audio. Start with the volume low and use headphones when checking your mix.

## Easy mode

Easy mode is for making music without knowing music theory. It writes notes into the same project the pro editors use — there is no separate "beginner file format", and any song made here opens in Pro mode as ordinary patterns, notes, and mixer settings.

1. **Pick a vibe.** Lo-fi chill, boom bap, house, trap, drum & bass, afro groove, pop, or ambient. A vibe sets the tempo, the swing, the drum feel, and a starting mix. Picking one writes a fresh arrangement.
2. **Set the feeling.** Key is the note everything comes home to; mood picks the scale behind it — bright (major), dreamy (lydian), warm (mixolydian), chill (dorian), sad (minor), or dark (phrygian). Changing either one afterwards *moves the music you already wrote* into the new key instead of discarding it: every note keeps its position in the scale.
3. **Shape your parts.** Drums, bass, chords, and melody each get one card. "How busy" rewrites that part with more or fewer notes. "New idea" rerolls it. The other sliders are the sound itself — loudness, brightness, punch, space, shape — each one driving several real mixer parameters at once (brightness is filter cutoff plus high shelf; punch is attack, drive, and decay; space is reverb and delay sends).
4. **Edit the notes.** Drums are one bar of squares, left to right, with the beats numbered. Bass, chords, and melody use a grid whose rows are only the notes in your key, so every square you can click is in tune. Long notes show their tail, and adding a note plays it.
5. **Play it yourself.** A drum kit and a piano keyboard sit in the page. Every kit piece has a letter printed on it — tap the piece or press the letter. Faded pieces are sounds you do not have yet: tapping one adds it and writes it a part, and hovering a piece you own gives you a ✕ to take it back out. With "Stay in key" on, the piano only lets you press notes that belong to your song. Turn on Record to write what you play into the section, quantized to the nearest 1/16.
6. **Take the challenge.** Press *Start challenge* and the notes already in the section fall down lanes, with the key to press under each lane. Start on **Easy**: three parts, on the beat, never two keys at the same moment, and generous timing. Perfect / Great / Okay / miss are judged on the audio clock, runs build a combo, and the result is a percentage and a rank from S down to D. "Mute the part I play" drops the recorded part for the run so what you hear is what you played.
7. **Build a song.** Sections are named — Main groove, Lift, Breakdown, Big drop — rather than lettered A–D. Pick a song shape, then reorder, add, or remove sections, and switch playback between the loop and the whole song.
8. **Finish.** Export audio and Save project work identically in both modes.

Nothing is random for its own sake. Chords come from progressions built out of the chosen scale, basslines follow the kick and the chord roots, and melodies are one short idea repeated and varied rather than a scatter of notes — which is why two rolls of the same vibe sound like two different tracks instead of the same track twice. Every generated melodic note is in key: that property is asserted over every vibe, scale, root, and energy level in the test suite.

The mode toggle lives in the header and is remembered on the device. Easy mode is the default for a new visitor.

## Playing and the challenge

The play stage is the same in both modes — easy mode gives it a card of its own, pro mode puts it under **Perform** — and it edits the same project as everything else.

- **Drum kit.** Twelve pieces laid out as a kit: crash, hi-hat and open hat, ride, cowbell, clap, rim, tom, snare, kick, conga, and shaker. The stands, legs, hi-hat pedal and floor are drawn from the same coordinates the pieces use, so the hardware stays in step with the layout. A piece backed by a track plays that track. A piece with no track behind it is faded and adding it is one tap: the sound joins the session with a part already written for the sections you are using, rather than arriving silent. Hovering or focusing a piece you own reveals a ✕ that removes it, as does the "Add a sound" list, and either is undoable.
- **Kit keys.** `Q W E R T` across the cymbals and cowbell, `A S D F G H J` across the drums and pads — the two keyboard rows in the same left-to-right order as the two rows of the kit, with each letter printed on the piece it plays. These letters apply only while the kit is on screen; everywhere else `A`–`K` keeps its usual meaning of tracks one to eight.
- **Keyboard.** Two octaves of real piano keys for the selected bass, chords, or melody sound, movable up and down by octave. Keys that belong to your key are tinted; with "Stay in key" on, the rest are unavailable, which is the same promise the easy-mode note grid makes. The existing `Q 2 W 3 E T 6 Y 7 U 8 I O` row plays the same notes from the computer keyboard.
- **Recording.** The stage's Record button is the transport's record arm. With it on, what you play is written into the selected section, snapped to the nearest 1/16 — the same path the pads and MIDI use, so it is undoable and saved like any other edit.
- **The challenge.** Lanes are ordered to match the kit, one per drum, or one per pitch when you are on the keyboard, and each lane shows the key to press beneath it. It runs for four passes of the current loop in pattern playback, starting at the next loop boundary. A hit resolves the nearest unjudged target in its lane: Perfect under 55 ms, Great under 100 ms, Okay to 160 ms. Hits with nothing in range are counted as off-beat and break the run. Judging uses the audio clock minus the device's reported output latency, so it scores when a sound was heard rather than which animation frame the click landed in. The challenge never writes notes, and stopping it stops the beat it started — if you were already playing, playback carries on.
- **Difficulty.** Three levels move three things at once.

  | Level | Parts | Notes kept | Timing windows |
  | --- | --- | --- | --- |
  | Easy | 3 | On the beat, and never two parts at the same moment | 45% wider |
  | Medium | 5 | Eighth notes and wider | 15% wider |
  | Hard | 7 | Every note in the section | As listed above |

  When the challenge cannot show every part it keeps the ones a drummer would miss first — kick, snare, hi-hat, then clap and the rest. Thinning keeps the first note of a run rather than dropping a lane, so a sixteenth-note hi-hat becomes something you can hit instead of disappearing. Easy is the default.
- **Scores.** The result is a percentage of the maximum score, a longest run, and a rank: S at 95%, A at 85%, B at 70%, C at 50%, D below. Your best percentage is remembered on the device per section and per level, so an Easy run never overwrites a Hard one.

## Production workflow

1. **Program a beat.** Click or paint the 16-step grid. Edit patterns A–H, each one, two, or four bars long. Switch bar pages for longer patterns.
2. **Write notes.** Select an instrument and open Piano roll. Add chords, move notes, resize durations, and edit pitch, velocity, probability, timing delay, and retriggers. Right-click sequencer hits or double-click piano notes for precise values.
3. **Perform.** Open Perform for the drum kit, the keyboard, and the quick pads. Click a kit piece or a piano key to play it; the same pieces and keys light up as the sequencer passes through their notes. Play the first eight tracks with A/S/D/F/G/H/J/K. Use Q/2/W/3/E/T/6/Y/7/U/8/I/O for a chromatic octave on the selected instrument. Arm recording to write quantized notes into the selected pattern. Held synth notes sustain until release, up to 30 seconds. MIDI note-on, note-off, pitch, and velocity are supported after you enable MIDI input.
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

Twelve synthesized percussion voices: analog kick, snare, closed hat, open hat, clap, rimshot, tom, conga, shaker, cowbell, ride cymbal, and crash cymbal. Seven polyphonic melodic voices: sub bass, electric keys, analog lead, soft pad, pluck, bell, and organ. A chromatic sampler supports imported audio. Twenty instruments in all, every one of them available in both modes — pro mode from the library, easy mode from "Add a sound" or by tapping an empty piece on the kit.

Each melodic voice is a different stack of oscillators with its own sustain level, which is what separates a pluck that dies away from an organ that holds. Every vibe writes its own ride, crash, and shaker rows alongside the kick, snare, hat, open hat, clap, and percussion it already wrote, so a generated beat uses the wider kit rather than doubling the parts it had.

Synthesized drum buffers use deterministic noise and bounded envelopes. Melodic instruments use native oscillators and scheduled amplitude envelopes. The UI waveform for a synth is an illustrative instrument waveform; the master scope and channel meters read the real audio graph.

The safety compressor is a native dynamics compressor set to -2 dB threshold, 20:1 ratio, 3 ms attack, and 150 ms release. It is not a true-peak limiter. Attack/release controls apply to melodic instruments and samples; synthesized drums retain their built-in envelopes.

## Saving and privacy

- Autosave uses IndexedDB on the current device and origin. A restore action appears when a previous session exists.
- The studio mode and your best challenge percentage per section are kept in this browser's local storage. Nothing about them leaves the device, and clearing site data removes them.
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
| Q W E R T / A S D F G H J | The drum kit, while the kit is on screen |
| Enter/Space on a kit piece or a piano key | Play it, or add that sound if the piece is empty |
| Enter/Space on a grid cell | Toggle the hit |
| Enter on an arrangement section | Edit section, including keyboard reordering |
| Enter on a piano note | Edit note |
| Delete/Backspace on a piano note | Remove note |
| Escape | Close dialog |

Controls use native buttons, sliders, selects, visible focus states, accessible names, and pressed states. Kit pieces and piano keys are native buttons too, each with an accessible name saying what it plays, so the stage is reachable by keyboard and by a screen reader rather than being a picture you can only click. The detailed note dialog provides a keyboard alternative to dragging. Narrow screens scroll the sequencer, piano roll, and mixer horizontally. CSS transitions respect reduced-motion preferences.

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
- The challenge plays the current loop in pattern playback. It has no song-length run, no note-accuracy scoring on the keyboard beyond hitting the right pitch lane, and no leaderboard or sharing: the best percentage is a number in your own browser.
- The stage shows one kit piece per percussion voice and one keyboard for one melodic track at a time. A second snare or a second keys track is reached from the sequencer, the pads, or Pro mode.
- The challenge shows at most seven lanes. On a full kit the quieter parts are left out by design rather than scrolled to.
- Judging subtracts the browser's reported output latency. Browsers that do not report it, and input latency from the mouse, touch digitizer, or keyboard, are not compensated, so absolute timing scores are not comparable between devices.
- Easy mode edits the currently selected section, and its note grid edits the first track of a part — a second keys or pad track is still reached from Pro mode. It has no pad performance, MIDI recording, per-note velocity, or probability editing; those stay in Pro mode.
- "How busy" is a setting for the generator, not stored project data, so it returns to its default when the page reloads. The notes it wrote are saved normally.

## Source

| File | Responsibility |
| --- | --- |
| `dist/index.html`, `dist/styles.css` | Studio workspace and responsive theme |
| `dist/app.js` | Editors, transport UI, mixer, performance, easy-mode workspace, file workflows |
| `dist/easy.js` | Beginner music engine: scales, chord movements, part generators, plain-language macros |
| `dist/play.js` | Kit layout and drawn hardware, keyboard layout, difficulty, challenge targets, timing judgement, falling-note canvas |
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

Twenty-nine tests check project schema round-trips and malicious input, arrangement boundaries, tempo/swing timing, mute/solo/probability/retrigger selection, undo/redo, actual synthesized PCM for all twelve percussion voices, 16/24-bit WAV handling, ZIP integrity, embedded project assets, graph routing, sampler trimming, scheduler stall recovery, and offline render parameters.

Two cover the widened instrument set: every one of the twenty instruments has a synthesis path, a mixer starting point, an easy-mode group, and survives the project schema; and the melodic voices each layer their own oscillator partials rather than sharing one.

Six cover the play stage: the kit holds every percussion voice exactly once with no two pieces overlapping, gives each a unique key, escapes track names into its markup, and draws its hardware from real coordinates; the keyboard lays out two real octaves with the black keys inside the span and marks exactly the pitches in the chosen key; challenge targets follow the pattern's swing, microtiming, and every repeat of the loop; the timing windows, combo, stray, miss, accuracy, and rank rules hold at their boundaries; the difficulty levels are ordered so each is harder than the last, drop the least important parts first, thin a dense row without emptying it, leave one target per step on Easy, and widen the windows exactly as far as their tolerance says; and the falling-note canvas emits only finite geometry and draws only the notes inside its lead window.

Six of them cover easy mode: drum templates are well formed and the scale tables agree with the project schema; generated parts are in key, inside the loop, and pass validation unchanged; a seed reproduces its music exactly while new seeds do not; the plain-language macros map onto in-range mixer values and read back where they were set; a key or mood change never leaves a note outside the new key and round-trips notes that were already in it; and the note grids and song shapes stay inside the project's limits.

The audio API contract double verifies scheduling and routing calls. It does not render browser effects or prove audible output. No browser, visual, or end-to-end verification is claimed.

## Hosting

The existing `.openai/hosting.json` identity and static `dist/` output are retained. The connected Site publication and GitHub Pages are separate destinations. Source changes do not by themselves update the existing Sites publication.
