export type Team = {
  abbr: string;
  name: string;
  location: string;
  primaryColor: string;
  secondaryColor: string;
};

export const TEAMS: Team[] = [
  { abbr: "ARI", name: "Cardinals", location: "Arizona", primaryColor: "#97233F", secondaryColor: "#000000" },
  { abbr: "ATL", name: "Falcons", location: "Atlanta", primaryColor: "#A71930", secondaryColor: "#000000" },
  { abbr: "BAL", name: "Ravens", location: "Baltimore", primaryColor: "#241773", secondaryColor: "#9E7C0C" },
  { abbr: "BUF", name: "Bills", location: "Buffalo", primaryColor: "#00338D", secondaryColor: "#C60C30" },
  { abbr: "CAR", name: "Panthers", location: "Carolina", primaryColor: "#0085CA", secondaryColor: "#101820" },
  { abbr: "CHI", name: "Bears", location: "Chicago", primaryColor: "#0B162A", secondaryColor: "#C83803" },
  { abbr: "CIN", name: "Bengals", location: "Cincinnati", primaryColor: "#FB4F14", secondaryColor: "#000000" },
  { abbr: "CLE", name: "Browns", location: "Cleveland", primaryColor: "#311D00", secondaryColor: "#FF3C00" },
  { abbr: "DAL", name: "Cowboys", location: "Dallas", primaryColor: "#003594", secondaryColor: "#869397" },
  { abbr: "DEN", name: "Broncos", location: "Denver", primaryColor: "#FB4F14", secondaryColor: "#002244" },
  { abbr: "DET", name: "Lions", location: "Detroit", primaryColor: "#0076B6", secondaryColor: "#B0B7BC" },
  { abbr: "GB", name: "Packers", location: "Green Bay", primaryColor: "#203731", secondaryColor: "#FFB612" },
  { abbr: "HOU", name: "Texans", location: "Houston", primaryColor: "#03202F", secondaryColor: "#A71930" },
  { abbr: "IND", name: "Colts", location: "Indianapolis", primaryColor: "#002C5F", secondaryColor: "#A2AAAD" },
  { abbr: "JAX", name: "Jaguars", location: "Jacksonville", primaryColor: "#101820", secondaryColor: "#D7A22A" },
  { abbr: "KC", name: "Chiefs", location: "Kansas City", primaryColor: "#E31837", secondaryColor: "#FFB81C" },
  { abbr: "LV", name: "Raiders", location: "Las Vegas", primaryColor: "#000000", secondaryColor: "#A5ACAF" },
  { abbr: "LAC", name: "Chargers", location: "Los Angeles", primaryColor: "#0080C6", secondaryColor: "#FFC20E" },
  { abbr: "LAR", name: "Rams", location: "Los Angeles", primaryColor: "#003594", secondaryColor: "#FFA300" },
  { abbr: "MIA", name: "Dolphins", location: "Miami", primaryColor: "#008E97", secondaryColor: "#FC4C02" },
  { abbr: "MIN", name: "Vikings", location: "Minnesota", primaryColor: "#4F2683", secondaryColor: "#FFC62F" },
  { abbr: "NE", name: "Patriots", location: "New England", primaryColor: "#002244", secondaryColor: "#C60C30" },
  { abbr: "NO", name: "Saints", location: "New Orleans", primaryColor: "#D3BC8D", secondaryColor: "#101820" },
  { abbr: "NYG", name: "Giants", location: "New York", primaryColor: "#0B2265", secondaryColor: "#A71930" },
  { abbr: "NYJ", name: "Jets", location: "New York", primaryColor: "#125740", secondaryColor: "#000000" },
  { abbr: "PHI", name: "Eagles", location: "Philadelphia", primaryColor: "#004C54", secondaryColor: "#A5ACAF" },
  { abbr: "PIT", name: "Steelers", location: "Pittsburgh", primaryColor: "#FFB612", secondaryColor: "#101820" },
  { abbr: "SF", name: "49ers", location: "San Francisco", primaryColor: "#AA0000", secondaryColor: "#B3995D" },
  { abbr: "SEA", name: "Seahawks", location: "Seattle", primaryColor: "#002244", secondaryColor: "#69BE28" },
  { abbr: "TB", name: "Buccaneers", location: "Tampa Bay", primaryColor: "#D50A0A", secondaryColor: "#34302B" },
  { abbr: "TEN", name: "Titans", location: "Tennessee", primaryColor: "#0C2340", secondaryColor: "#4B92DB" },
  { abbr: "WAS", name: "Commanders", location: "Washington", primaryColor: "#5A1414", secondaryColor: "#FFB612" },
];

const TEAMS_BY_ABBR = new Map(TEAMS.map((t) => [t.abbr, t]));

export function getTeamByAbbr(abbr: string): Team {
  const team = TEAMS_BY_ABBR.get(abbr);
  if (!team) throw new Error(`Unknown team abbr: ${abbr}`);
  return team;
}

export function findTeamByAbbr(abbr: string): Team | undefined {
  return TEAMS_BY_ABBR.get(abbr);
}

export function getAllTeams(): Team[] {
  return TEAMS;
}

export function getTeamAbbrs(): string[] {
  return TEAMS.map((t) => t.abbr);
}

export const TOTAL_TEAMS = TEAMS.length;

// ESPN usa "wsh" para Washington en vez de "was".
const ESPN_ABBR_OVERRIDES: Record<string, string> = {
  WAS: "wsh",
};

export function teamLogoUrl(abbr: string): string {
  const espnAbbr = ESPN_ABBR_OVERRIDES[abbr] ?? abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnAbbr}.png`;
}
