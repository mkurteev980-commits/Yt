# Music bed + SFX for "Grandpa's House", synthesized with numpy (no samples), mixed under the voice.
import numpy as np, soundfile as sf, json
SR, DUR = 48000, 15.3
N = int(SR * DUR); t = np.arange(N) / SR
def env(n, a=0.005, d=0.3):
    x = np.arange(n) / SR; return np.minimum(1, x / a) * np.exp(-x / d)
def tone(f, dur, d=0.3, harm=(1, .5, .25)):
    n = int(dur * SR); x = np.arange(n) / SR
    return sum(h * np.sin(2 * np.pi * f * (k + 1) * x) for k, h in enumerate(harm)) * env(n, d=d)
def put(buf, sig, at, g=1.0):
    i = int(at * SR); j = min(len(buf), i + len(sig)); 
    if i < len(buf): buf[i:j] += g * sig[: j - i]
music = np.zeros(N); sfx = np.zeros(N)
bpm = 124; beat = 60 / bpm
chords = [[261.6, 329.6, 392.0], [196.0, 246.9, 293.7], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6]]  # C G Am F
nb = int(DUR / beat) + 1
for b in range(nb):
    c = chords[(b // 4) % 4]
    put(music, tone(c[0] / 2, 0.5, 0.25, (1, .3)), b * beat, 0.35)              # bass
    for k, f in enumerate(c): put(music, tone(f * 2, 0.35, 0.12, (1, .4, .2)), b * beat + k * beat / 3, 0.12)  # pluck arp
    kick = np.sin(2 * np.pi * (60 + 80 * np.exp(-np.arange(int(.15 * SR)) / SR / .03)) * np.arange(int(.15 * SR)) / SR) * env(int(.15 * SR), .001, .06)
    put(music, kick, b * beat, 0.5)
    if b % 2: put(music, np.random.default_rng(b).normal(0, 1, int(.06 * SR)) * env(int(.06 * SR), .001, .015), b * beat, 0.08)  # hat
# the reveal: music drops out for a beat, then a "dun-dun" sting
music[int(11.4 * SR):int(13.25 * SR)] *= 0.35
for k, f in enumerate([110, 103.8]): put(sfx, tone(f, 0.9, 0.5, (1, .6, .4, .2)), 13.3 + k * 0.38, 0.6)
# block pops during the timelapse, roof thud + dust, door pop, mailbox ding, cut whooshes
rng = np.random.default_rng(1)
for k, tt in enumerate(np.linspace(6.0, 7.15, 18)): put(sfx, tone(700 + 60 * (k % 5), 0.08, 0.03, (1, .3)), tt, 0.35)
put(sfx, tone(4.2e2, 0.1, .04), 4.66, 0.4)  # grandpa picks up the block
thud = np.sin(2 * np.pi * 55 * np.arange(int(.4 * SR)) / SR) * env(int(.4 * SR), .002, .12) + rng.normal(0, .3, int(.4 * SR)) * env(int(.4 * SR), .001, .05)
put(sfx, thud, 8.78, 0.9)
put(sfx, tone(520, .12, .05), 8.84, 0.4)
for k, f in enumerate([1318.5, 1760]): put(sfx, tone(f, .6, .25, (1, .2)), 9.36 + k * 0.09, 0.25)
for c in [2.95, 3.9, 5.95, 7.35, 10.0, 11.4]:
    n = int(.25 * SR); w = rng.normal(0, 1, n); w = np.convolve(w, np.ones(30) / 30, "same") * np.sin(np.linspace(0, np.pi, n)) ** 2
    put(sfx, w, c - 0.12, 0.25)
voice, sr = sf.read("voice/voice.wav"); assert sr == SR
vo = np.zeros(N); vo[: min(N, len(voice))] = voice[:N]
# duck the music under the voice (envelope follower)
e = np.convolve(np.abs(vo), np.ones(2400) / 2400, "same"); duck = 1 - 0.55 * np.clip(e / (e.max() * 0.25), 0, 1)
mix = vo * 1.0 + music * 0.5 * duck + sfx * 0.6
fade = np.ones(N); fade[-int(.5 * SR):] = np.linspace(1, 0, int(.5 * SR)); mix *= fade
mix /= np.abs(mix).max() * 1.05
sf.write("mix_raw.wav", mix.astype(np.float32), SR)
print("ok", len(mix) / SR)
