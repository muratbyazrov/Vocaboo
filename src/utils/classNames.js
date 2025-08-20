export default function classNames(...xs) {
  return xs.filter(Boolean).join(' ');
}
