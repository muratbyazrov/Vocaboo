export function normalize(str) {
  return (str || '').toString().toLowerCase().trim().split('ё').join('е');
}

export function titleCase(s) {
  return (s || '')
    .split(/(\s|-)/)
    .map((part) => {
      if (part === ' ' || part === '-') return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}
