export function urlWithoutSearchParams(url: string) {
  return new URL(url.split("?")[0]);
}
