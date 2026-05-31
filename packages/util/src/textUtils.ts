interface Named {
  name: string;
}

/**
 * Produce a unique "<base> duplicate" name not already present in `layers`.
 * Strips an existing " duplicate" suffix first so repeated duplication stays
 * tidy (`Layer duplicate`, `Layer duplicate 2`, ...).
 */
export function DuplicateName(name: string, layers: Named[]): string {
  const existingNames = new Set(layers.map((layer) => layer.name));
  const nameExists = (n: string) => existingNames.has(n);

  let baseName = name;
  const duplicateIndex = name.indexOf(" duplicate");
  if (duplicateIndex !== -1) baseName = name.substring(0, duplicateIndex);

  let newName = baseName + " duplicate";
  if (!nameExists(newName)) return newName;

  let counter = 2;
  do {
    newName = `${baseName} duplicate ${counter}`;
    counter++;
  } while (nameExists(newName));

  return newName;
}
