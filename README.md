# Web Games

A home for ridiculous browser games with serious leaderboards. Players create
one account (unique name + password) that works across every game and every
device; scores, unlocked levels and funny rank titles are saved to it in a
SQLite database.

| Game | Path | Tech |
| --- | --- | --- |
| 🐄 **Cow vs UFO** | [`games/cow-vs-ufo/`](games/cow-vs-ufo/) | Three.js, ES modules, Web Audio |
| 🥊 **Office Brawl** | [`games/office-brawl/`](games/office-brawl/) | Three.js fighting game, AI, Web Audio |

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173/. `npm run dev` runs everything: the pages,
the API in `api/` (served by a small Vite plugin) and a local SQLite database
at `data/web-games.db`, which is created automatically.

> A plain static server (`python3 -m http.server`) won't work: the game needs
> Vite to resolve its imports, and the player system needs the API.

The dev server also listens on your local network, so you can open the printed
**Network** URL on a phone on the same Wi-Fi to try the touch controls.

## Players, saves and the database

- **Accounts** are created on the home page before playing: a player name
  (3–16 letters, numbers or `_`, starting with a letter, unique regardless of
  case) and a password (8–72 characters). Passwords are hashed with scrypt
  (random salt) and never stored or logged in plain text.
- **Log in on any device** with the same name and password. Each device gets
  its own session token (only its SHA-256 hash is stored); logging out ends
  only that device's session. Five wrong passwords lock the account for five
  minutes, and errors never reveal whether the name or the password was wrong.
- Each finished run is stored in `scores`. The per-game `progress` row keeps
  best score, highest unlocked level (the game offers **Continue**), games
  played, wins and total snacks. The leaderboard is built from `progress`.
- Rank titles (`src/shared/titles.js`) go from *Confused Calf* to
  *Supreme Bovine Overlord*, are earned live in-game as your score climbs, and
  appear on the home page and leaderboard.

| Endpoint | Description |
| --- | --- |
| `POST /api/users` `{ username, password }` | Create a player (409 if the name is taken) |
| `POST /api/session` `{ username, password }` | Log in on this device |
| `DELETE /api/session` (Bearer token) | Log out this device |
| `POST /api/password` (Bearer token) | Set or change the password |
| `GET /api/username-check?username=` | Live availability check |
| `GET /api/me` (Bearer token) | The player and their saved progress |
| `POST /api/scores` (Bearer token) | Save a finished run, update progress |
| `GET /api/leaderboard?game=cow-vs-ufo` | Top 10 players for a game (`office-brawl` too) |

The database is SQLite via [libSQL](https://github.com/tursodatabase/libsql-client-ts):

- **Locally:** a SQLite file at `data/web-games.db` (git-ignored).
- **In production:** [Turso](https://turso.tech) (hosted SQLite). Set
  `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Tables are created on first
  request.
- **On Vercel without Turso:** a temporary SQLite file in `/tmp`. The site
  works, but players and scores reset whenever Vercel recycles the function.

## Deploying to Vercel

The repo is ready for Vercel (`vercel.json`): Vite builds the pages into
`dist/`, and each file in `api/` becomes a serverless function.

To make saves permanent:

1. Create a free database at https://turso.tech and copy its URL
   (`libsql://…`) and an auth token.
2. In Vercel, go to **Project → Settings → Environment Variables** and add
   `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for Production.
3. Redeploy.

## Project structure

```
web-games/
├── index.html              # Home page: game list, player signup, leaderboard
├── api/                    # Vercel serverless functions (users, scores, leaderboard)
├── server/                 # Shared API code: SQLite (libSQL) client + schema, HTTP helpers
├── src/
│   ├── home/               # Home page script + styles
│   └── shared/             # Session/API client and rank titles, used by home and games
├── public/thumbnails/      # Game card images
├── vite.config.js          # Multi-page build + dev API middleware
├── vercel.json
└── games/
    └── cow-vs-ufo/
        ├── index.html      # Game page: canvas + all menu/HUD markup
        └── src/
            ├── main.js             # Entry point (requires a player session)
            ├── styles.css          # Menus, HUD, touch controls
            ├── game/               # Game (orchestrator), GameLoop, GameState, Levels
            ├── player/             # Cow model, Player, PlayerController (input), PlayerPhysics
            ├── enemies/UFO.js      # UFO model, tractor beam and attack state machine
            ├── world/              # Terrain, Environment, Props, World, Obstacles, Collectibles, Critters
            ├── systems/            # Collision, FunnyEvents, Score, Audio, Settings
            ├── camera/             # Third-person follow/orbit camera
            ├── ui/                 # UIManager, MainMenu, HUD, PauseMenu, GameOverScreen, TouchControls
            └── utils/              # Effects (particles + floating text), materials, math
```

To add another game: create `games/<name>/index.html`, add it to
`build.rollupOptions.input` in `vite.config.js` and to `GAMES` in
`server/http.js`, then add a card to the home page.

---

# 🐄 Cow vs UFO

You are a cow. A UFO wants you. Eat enough snacks to clear each level before the
aliens beam you up.

## How to play

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | `W A S D` / arrow keys | Cow-nose joystick (gets happier the harder you push) |
| Jump | `Space` | **BOING!** button (YEET! / HOP! / WHEE!…) |
| Moo (scares chickens) | `M` or `F` | **MOO** button (says something new every time) |
| Rotate camera | Drag the mouse, or `Q` / `E` | Drag on the screen |
| Pause | `Esc` or `P` | ⏸ button |

- **Eat snacks** (apple, corn, clover) to finish the level. Eating them quickly
  builds a combo multiplier, up to ×4. **Golden corn** rides the balloon rafts
  at the island's edges and is worth 500.
- **The tractor beam:** a red pulsing ring means the UFO is about to fire.
  Standing in the beam fills the abduction meter. Escaping late gives a
  *Close call* bonus.
- **Barns** hide you from the UFO. Hide too long and it steals the roof and
  wears it as a hat.
- You have **3 hearts**. You lose one when you are abducted, flattened by an
  anvil, or fall off the island.
- Clearing a level awards a speed bonus, 300 per heart left, and 1,000 for a
  flawless run. Every finished run is saved to your player profile.

### UFO attacks (escalate by level)

| Level | New attacks |
| --- | --- |
| 1 | Tractor beam, anvil drops |
| 2 | Rubber ducks, rolling hay wheels, spinning boxing-glove arm (jump it!) |
| 3+ | Giant magnet that pulls your cow bell, "FREE GRASS (not a trap)" cage trap |

Levels after 3 are generated automatically ("Bovine Overdrive 1, 2, …") with a
faster, angrier UFO.

### Random funny events

Low gravity, banana-peel rain, earthquakes, a giant revenge chicken, a rogue
rolling cheeseburger, a UFO disco break (everyone dances), the UFO abducting
the wrong cow (she comes back by parachute), and hiccups.

## Technical notes

- **Rendering:** Three.js with flat-shaded low-poly materials, PCF soft shadows
  that follow the player, ACES tone mapping, a gradient sky shader and fog.
  Every model (cows, UFO, chickens, barns, burger…) is built procedurally from
  primitives, so there are no model files to load or license.
- **Physics:** a custom arcade controller in `PlayerPhysics.js` (gravity,
  coyote time, jump buffering, floaty apex, knockback that keeps momentum while
  tumbling). Collisions are axis-aligned boxes plus vertical cylinders in
  `CollisionSystem.js`. A full physics engine like Rapier wasn't needed for
  this style of game, and leaving it out keeps the bundle small.
- **Audio:** every sound effect and both music loops are synthesized with the
  Web Audio API in `AudioSystem.js`. The audio context only starts after the
  first click or key press, to respect browser autoplay rules.
- **Performance:** particles share one pooled `InstancedMesh`, grass and flowers
  are instanced, floating text uses a pool of DOM nodes, and temporary vectors
  are reused instead of allocated in the main loop. Movement uses a clamped
  delta time. On phones and low-core machines (or with *Graphics: Low*) the
  game lowers the pixel ratio, shadow-map size, particle and foliage counts.
- **Settings** (sound, music, volume, camera speed, graphics, wardrobe) are
  saved per player in `localStorage`; scores and progress go to the database.
- `window.cowVsUfo` exposes the running game in the browser console for debugging.

## Extending the game

### Add or tune a level

Levels come from `levelConfig(n)` in `src/game/Levels.js`. Add a name to
`NAMES` and an entry to `ATTACKS` to hand-design a new level, or tweak the
formulas for snack target, UFO speed, beam timing, abduction time, how often
special attacks happen, how long hiding is tolerated, and how often events fire.

### Add a cow skin or accessory

- **Skin:** add an entry to `SKINS` in `src/player/Cow.js` (base color, spot
  color, snout and hoof colors; `metal: true` and `stars: true` are optional).
- **Accessory:** add a name to `ACCESSORIES` and a matching `case` in
  `Cow.setAccessory()` that builds the meshes. They're parented to the head.

Both show up in the Wardrobe automatically.

### Add an obstacle or UFO attack

1. Build the model and a small pool in the `Obstacles` constructor
   (`src/world/Obstacles.js`). Pools avoid allocations during play.
2. Add a `spawnX()` method and an `updateX(dt)` method, and call it from
   `Obstacles.update()`. Use `canHit()` before hurting the player, then either
   `game.hurtPlayer(reason)` (costs a heart) or `player.launch(dx, dz, power, up, reason)`
   (comedic knockback only).
3. Reset it in `Obstacles.reset()`.
4. To make it a UFO attack, add a `case` to the `switch` in `UFO.update()` that
   calls your spawn method and ends with `this.enter('cooldown')`, then add the
   attack name to `ATTACKS` in `Levels.js`.

### Add a funny event

Add an entry to `EVENTS` in `src/systems/FunnyEvents.js` (id, icon, title,
duration, weight, minLevel). Then handle its start in `start()`, any per-frame
behavior in `tick()`, and cleanup in `finish()` and `stop()`.

### Add a death message

Add a line to `FAIL` (or a new reason key) in `src/ui/GameOverScreen.js`. The
reason is the string passed to `hurtPlayer()` / `loseHeart()`.

---

# 🥊 Office Brawl — Fight for the Corner Office

A Street-Fighter-style 3D fighting game set in a software company. Every
fighter is a procedurally built 3D office worker with a full skeleton, a face
that reacts, signature props, two special moves, a super and a funny K.O.

| Fighter | Specials | Super (☕ full Caffeine meter) | K.O. |
| --- | --- | --- | --- |
| Jay, Junior Dev | Stack Overflow Paste, Works On My Machine (teleport) | Force Push to Main | Rage-quits on an office chair |
| Grumbles, Senior Dev | Changes Requested, Legacy Spaghetti (whip) | Rewrite It In Rust (giant crab) | "It's not a bug… it's a feature" |
| Quinn, QA | Bug Report (beetles), Edge Case (slide) | Regression Test (multi-hit rush) | Becomes a 404 sign |
| Holly, HR | Mandatory Training (slows you), Let's Circle Back (boomerang) | Pink Slip Storm | Files a formal complaint |
| Parker, Product Manager | Scope Creep (growing projectile), Pivot (spin) | Roadmap Rampage | Rescheduled to next sprint |
| Stan, Scrum Master | Daily Stand-up (stun), Sprint (dash) | Retrospective (sticky notes) | Buried in sticky notes |
| Ian, Intern | Coffee Run, Unpaid Overtime (power-up) | Reply All (email storm) | "Wait… is this paid?" |
| The Chairman (boss, unlockable) | Hostile Takeover (grab), Layoff Wave | Golden Parachute (dive) | Floats away on a golden parachute |

**Modes:** *Career Mode* climbs the org chart (7 rungs of rising AI
difficulty, the Chairman at the top; beating him unlocks him) and resumes at
your highest rung on any device. *Quick Match* is any fighter against any
rival. AI-vs-AI brawls play behind the menus.

**Combat:** best of 3 rounds, 60-second timer, blocking (hold away; crouch to
block lows, stand to block jump-ins), chip damage, hit-stop, knockdowns,
juggles, combo chains (slap → kick → special/super), projectile clashes
("MERGE CONFLICT!"), slow-motion K.O.s and a funny announcer (optional voice).
Career score earns job titles from *Unpaid Intern* to *CEO of Beating People Up*.

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move / jump / crouch | `A` `D` / `W` / `S` (or arrows) | Stress-ball joystick |
| Slap / Kick | `J` / `K` | ✋ SLAP / 🦶 KICK |
| Special 1 / 2 | `U` / `I` | Buttons named after your moves |
| Super | `O` | ☕ OVERTIME (glows when ready) |
| Pause | `Esc` / `P` | ⏸ |

Code lives in `games/office-brawl/src/`: `fighters/` (Body skeleton + looks,
Poses/animator, Roster data, Fighter state machine, Combat, Props),
`systems/` (Hazards for projectiles/supers, AI, Input, Audio, Effects),
`world/Arena.js` (three stages + crowd), `game/` (Game, Match, Titles) and
`ui/`. To add a fighter, add an entry to `ROSTER` in `fighters/Roster.js`
(look, stats, two specials built from the move kinds `projectile`, `melee`,
`teleport`, `buff`, `grab`, plus a super of kind `wave`, `rain`, `summon`,
`rush` or `dive`) and a K.O. gag in `game/Match.js`.
