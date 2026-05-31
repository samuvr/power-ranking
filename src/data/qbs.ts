export type Qb = {
  id: string;
  name: string;
  teamAbbr: string;
};

// Lista provisional de QBs titulares de la NFL 2026.
// Editar libremente cuando se confirmen titulares definitivos.
export const QBS: Qb[] = [
  { id: "jacoby-brisset", name: "Jacoby Brisset", teamAbbr: "ARI" },
  { id: "penix-tua", name: "Michael Penix Jr.", teamAbbr: "ATL" },
  { id: "lamar-jackson", name: "Lamar Jackson", teamAbbr: "BAL" },
  { id: "josh-allen", name: "Josh Allen", teamAbbr: "BUF" },
  { id: "bryce-young", name: "Bryce Young", teamAbbr: "CAR" },
  { id: "caleb-williams", name: "Caleb Williams", teamAbbr: "CHI" },
  { id: "joe-burrow", name: "Joe Burrow", teamAbbr: "CIN" },
  { id: "cle-qb-room", name: "Deshaun Watson", teamAbbr: "CLE" },
  { id: "dak-prescott", name: "Dak Prescott", teamAbbr: "DAL" },
  { id: "bo-nix", name: "Bo Nix", teamAbbr: "DEN" },
  { id: "jared-goff", name: "Jared Goff", teamAbbr: "DET" },
  { id: "jordan-love", name: "Jordan Love", teamAbbr: "GB" },
  { id: "c-j-stroud", name: "C.J. Stroud", teamAbbr: "HOU" },
  { id: "daniel-jones", name: "Daniel Jones", teamAbbr: "IND" },
  { id: "trevor-lawrence", name: "Trevor Lawrence", teamAbbr: "JAX" },
  { id: "patrick-mahomes", name: "Patrick Mahomes", teamAbbr: "KC" },
  { id: "mendoza-cousins", name: "Fernando Mendoza", teamAbbr: "LV" },
  { id: "justin-herbert", name: "Justin Herbert", teamAbbr: "LAC" },
  { id: "matthew-stafford", name: "Matthew Stafford", teamAbbr: "LAR" },
  { id: "malik-willis", name: "Malik Willis", teamAbbr: "MIA" },
  { id: "mccarthy-murray", name: "J.J. McCarthy", teamAbbr: "MIN" },
  { id: "drake-maye", name: "Drake Maye", teamAbbr: "NE" },
  { id: "tyler-shough", name: "Tyler Shough", teamAbbr: "NO" },
  { id: "jaxson-dart", name: "Jaxson Dart", teamAbbr: "NYG" },
  { id: "geno-smith", name: "Geno Smith", teamAbbr: "NYJ" },
  { id: "jalen-hurts", name: "Jalen Hurts", teamAbbr: "PHI" },
  { id: "aaron-rodgers", name: "Aaron Rodgers", teamAbbr: "PIT" },
  { id: "brock-purdy", name: "Brock Purdy", teamAbbr: "SF" },
  { id: "sam-darnold", name: "Sam Darnold", teamAbbr: "SEA" },
  { id: "baker-mayfield", name: "Baker Mayfield", teamAbbr: "TB" },
  { id: "cam-ward", name: "Cam Ward", teamAbbr: "TEN" },
  { id: "jayden-daniels", name: "Jayden Daniels", teamAbbr: "WAS" },
];

const QB_BY_ID = new Map(QBS.map((q) => [q.id, q]));

export function getAllQbs(): Qb[] {
  return QBS;
}

export function getQbById(id: string): Qb | undefined {
  return QB_BY_ID.get(id);
}

export function getQbIds(): string[] {
  return QBS.map((q) => q.id);
}

export const TOTAL_QBS = QBS.length;
