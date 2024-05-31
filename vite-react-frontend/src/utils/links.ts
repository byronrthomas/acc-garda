export function urlWithoutSearchParams(url: string) {
  return new URL(url.split("?")[0]);
}

export function urlForContract(contractAddress: string) {
  const url = urlWithoutSearchParams(window.location.href);
  url.searchParams.append("contractAddress", contractAddress);
  return url.toString();
}
