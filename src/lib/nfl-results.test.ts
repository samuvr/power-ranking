import { describe, expect, it } from "vitest";
import {
  computeStandings,
  normalizeTeamAbbr,
  parseGamesCsv,
  playedGames,
  splitCsvLine,
  standingsOrder,
  type GameRow,
} from "./nfl-results";

const HEADER = "game_id,season,game_type,week,away_team,away_score,home_team,home_score,stadium";
const row = (
  season: number,
  type: string,
  week: number,
  away: string,
  awayScore: string,
  home: string,
  homeScore: string,
) => `${season}_${week}_${away}_${home},${season},${type},${week},${away},${awayScore},${home},${homeScore},Un Estadio`;

const game = (over: Partial<GameRow> = {}): GameRow => ({
  season: 2026,
  gameType: "REG",
  week: 1,
  awayTeam: "BUF",
  homeTeam: "KC",
  awayScore: 10,
  homeScore: 20,
  ...over,
});

describe("splitCsvLine", () => {
  it("parte por comas", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("respeta las comas dentro de comillas", () => {
    expect(splitCsvLine('a,"Estadio, El",c')).toEqual(["a", "Estadio, El", "c"]);
  });

  it("entiende las comillas escapadas", () => {
    expect(splitCsvLine('a,"dice ""hola""",c')).toEqual(["a", 'dice "hola"', "c"]);
  });

  it("conserva los campos vacíos", () => {
    expect(splitCsvLine('a,"",,d')).toEqual(["a", "", "", "d"]);
  });
});

describe("normalizeTeamAbbr", () => {
  it("traduce el LA de nflverse al LAR de teams.ts", () => {
    expect(normalizeTeamAbbr("LA")).toBe("LAR");
  });

  it("traduce las reubicaciones antiguas", () => {
    expect(normalizeTeamAbbr("OAK")).toBe("LV");
    expect(normalizeTeamAbbr("SD")).toBe("LAC");
  });

  it("deja igual las que ya coinciden", () => {
    expect(normalizeTeamAbbr("KC")).toBe("KC");
    expect(normalizeTeamAbbr("LAC")).toBe("LAC");
  });
});

describe("parseGamesCsv", () => {
  it("lee las filas y normaliza los equipos", () => {
    const games = parseGamesCsv(
      [HEADER, row(2026, "REG", 1, "LA", "17", "SEA", "24")].join("\n"),
    );
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      season: 2026,
      gameType: "REG",
      week: 1,
      awayTeam: "LAR",
      awayScore: 17,
      homeTeam: "SEA",
      homeScore: 24,
    });
  });

  it("deja el marcador en null si el partido no se ha jugado", () => {
    const [g] = parseGamesCsv([HEADER, row(2026, "REG", 5, "BUF", "", "KC", "")].join("\n"));
    expect(g.awayScore).toBeNull();
    expect(g.homeScore).toBeNull();
  });

  it("localiza las columnas por nombre, no por posición", () => {
    // Mismas columnas en otro orden y con una extra por delante.
    const header = "extra,home_team,home_score,away_team,away_score,week,game_type,season";
    const [g] = parseGamesCsv([header, "x,KC,31,BUF,28,3,REG,2026"].join("\n"));
    expect(g).toMatchObject({
      season: 2026,
      week: 3,
      homeTeam: "KC",
      homeScore: 31,
      awayTeam: "BUF",
      awayScore: 28,
    });
  });

  it("devuelve vacío si falta alguna columna que necesitamos", () => {
    expect(parseGamesCsv(["season,week,home_team", "2026,1,KC"].join("\n"))).toEqual([]);
  });

  it("aguanta un CSV vacío o solo con cabecera", () => {
    expect(parseGamesCsv("")).toEqual([]);
    expect(parseGamesCsv(HEADER)).toEqual([]);
  });

  it("ignora las líneas en blanco del final", () => {
    const games = parseGamesCsv(
      [HEADER, row(2026, "REG", 1, "BUF", "10", "KC", "20"), "", ""].join("\n"),
    );
    expect(games).toHaveLength(1);
  });
});

describe("computeStandings", () => {
  it("cuenta victorias, derrotas y puntos", () => {
    const standings = computeStandings(
      [
        game({ awayTeam: "BUF", awayScore: 10, homeTeam: "KC", homeScore: 20 }),
        game({ week: 2, awayTeam: "KC", awayScore: 30, homeTeam: "BUF", homeScore: 14 }),
      ],
      { season: 2026 },
    );

    const kc = standings.find((r) => r.teamAbbr === "KC")!;
    expect(kc).toMatchObject({
      wins: 2,
      losses: 0,
      ties: 0,
      played: 2,
      pointsFor: 50,
      pointsAgainst: 24,
      pointDiff: 26,
    });
    expect(kc.winPct).toBe(1);

    const buf = standings.find((r) => r.teamAbbr === "BUF")!;
    expect(buf).toMatchObject({ wins: 0, losses: 2, pointDiff: -26 });
  });

  it("cuenta el empate como media victoria", () => {
    const [first] = computeStandings(
      [
        game({ awayScore: 17, homeScore: 17 }),
        game({ week: 2, awayScore: 0, homeScore: 10 }),
      ],
      { season: 2026 },
    );
    // KC: 1 victoria y 1 empate en 2 partidos → (1 + 0.5) / 2.
    expect(first.teamAbbr).toBe("KC");
    expect(first.ties).toBe(1);
    expect(first.winPct).toBe(0.75);
  });

  it("ignora los partidos sin jugar, de otra temporada o de playoffs", () => {
    const standings = computeStandings(
      [
        game({ awayScore: null, homeScore: null }),
        game({ season: 2025 }),
        game({ gameType: "SB" }),
      ],
      { season: 2026 },
    );
    expect(standings).toEqual([]);
  });

  it("puede incluir los playoffs si se le pide", () => {
    const standings = computeStandings([game({ gameType: "WC" })], {
      season: 2026,
      gameTypes: ["REG", "WC"],
    });
    expect(standings).toHaveLength(2);
  });

  it("descarta equipos que no están en teams.ts", () => {
    const standings = computeStandings([game({ awayTeam: "XXX" })], { season: 2026 });
    expect(standings.map((r) => r.teamAbbr)).toEqual(["KC"]);
  });

  it("ordena por porcentaje y desempata por diferencia de puntos", () => {
    const order = standingsOrder(
      computeStandings(
        [
          // KC y SEA ganan uno; KC gana por más.
          game({ awayTeam: "BUF", awayScore: 0, homeTeam: "KC", homeScore: 40 }),
          game({ week: 1, awayTeam: "ARI", awayScore: 20, homeTeam: "SEA", homeScore: 21 }),
        ],
        { season: 2026 },
      ),
    );
    expect(order).toEqual(["KC", "SEA", "ARI", "BUF"]);
  });

  it("desempata por abbr para que el orden sea estable", () => {
    // Dos partidos idénticos: los dos ganadores empatan en todo.
    const order = standingsOrder(
      computeStandings(
        [
          game({ awayTeam: "BUF", awayScore: 0, homeTeam: "KC", homeScore: 10 }),
          game({ awayTeam: "ARI", awayScore: 0, homeTeam: "ATL", homeScore: 10 }),
        ],
        { season: 2026 },
      ),
    );
    expect(order.slice(0, 2)).toEqual(["ATL", "KC"]);
  });
});

describe("playedGames", () => {
  it("cuenta solo los de temporada regular ya jugados", () => {
    const games = [
      game(),
      game({ week: 2, awayScore: null, homeScore: null }),
      game({ gameType: "SB" }),
      game({ season: 2025 }),
    ];
    expect(playedGames(games, 2026)).toBe(1);
  });

  it("da cero antes de que empiece la temporada", () => {
    expect(playedGames([game({ awayScore: null, homeScore: null })], 2026)).toBe(0);
  });
});
